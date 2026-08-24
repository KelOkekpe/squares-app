-- Migration: take entrant contact details out of the participants blob
-- Run in the Supabase SQL Editor AFTER migration_pool_name_scope.sql
--
-- The squares half of the problem migration_pickem_privacy.sql fixed for
-- pick'em. `spaces_select` lets anyone read `type = 'participants'`, and every
-- entry in that blob carried the entrant's email, phone, payout method and
-- payout handle. One unauthenticated PostgREST call returned the contact
-- details and Cash App handles of every player in every space:
--
--   ['amount','email','name','payoutHandles','payoutMethod','phone','squares','time']
--
-- Unlike pick'em sheets, this blob has to stay publicly readable — the names
-- and square counts are drawn on the board and listed under Recent Entries. So
-- rather than gating the read, the contact fields leave the blob entirely.
--
-- Participants had no stable identifier (the admin console addresses them by
-- array index), so one is assigned here and written back, giving the contacts
-- something to hang off that survives a reorder.

-- ============================================================
-- 1. Contact details, out of the blob
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entry_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_code TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  payout_method TEXT,
  payout_handles JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_entry_contact UNIQUE (space_code, pool_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_contacts_pool
  ON public.entry_contacts(space_code, pool_id);

ALTER TABLE public.entry_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entry_contacts_admin" ON public.entry_contacts;

-- Admins only, for everything. Approval runs client-side as the admin, the
-- same way it already writes the participants blob, so this needs to be
-- writable by them rather than only by a SECURITY DEFINER function.
CREATE POLICY "entry_contacts_admin" ON public.entry_contacts
  FOR ALL USING (public.is_space_admin(space_code))
         WITH CHECK (public.is_space_admin(space_code));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_contacts TO authenticated;

-- ============================================================
-- 2. Give every existing entry an id, then move and strip
--
-- The id is written first and separately: the move reads it back, so both
-- steps have to agree on which entry is which.
-- ============================================================
UPDATE spaces s
   SET value = (
         SELECT coalesce(jsonb_agg(
                  CASE WHEN e ? 'id' THEN e
                       ELSE e || jsonb_build_object('id', gen_random_uuid()::text)
                  END ORDER BY ord), '[]'::jsonb)
           FROM jsonb_array_elements(s.value) WITH ORDINALITY AS t(e, ord)
       ),
       updated_at = now()
 WHERE s.type = 'participants'
   AND jsonb_typeof(s.value) = 'array'
   AND jsonb_array_length(s.value) > 0;

INSERT INTO public.entry_contacts
  (space_code, pool_id, entry_id, name, email, phone, payout_method, payout_handles)
SELECT s.space_code,
       s.pool_id,
       e ->> 'id',
       e ->> 'name',
       nullif(lower(trim(coalesce(e ->> 'email', ''))), ''),
       nullif(trim(coalesce(e ->> 'phone', '')), ''),
       nullif(e ->> 'payoutMethod', ''),
       CASE WHEN jsonb_typeof(e -> 'payoutHandles') = 'object' THEN e -> 'payoutHandles' END
  FROM spaces s
  CROSS JOIN LATERAL jsonb_array_elements(s.value) e
 WHERE s.type = 'participants'
   AND jsonb_typeof(s.value) = 'array'
   AND coalesce(e ->> 'id', '') <> ''
   AND (e ? 'email' OR e ? 'phone' OR e ? 'payoutMethod' OR e ? 'payoutHandles')
ON CONFLICT (space_code, pool_id, entry_id) DO NOTHING;

UPDATE spaces s
   SET value = (
         SELECT coalesce(jsonb_agg(
                  (e - 'email' - 'phone' - 'payoutMethod' - 'payoutHandles')
                  ORDER BY ord), '[]'::jsonb)
           FROM jsonb_array_elements(s.value) WITH ORDINALITY AS t(e, ord)
       ),
       updated_at = now()
 WHERE s.type = 'participants'
   AND jsonb_typeof(s.value) = 'array'
   AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(s.value) e
          WHERE e ? 'email' OR e ? 'phone' OR e ? 'payoutMethod' OR e ? 'payoutHandles'
       );

-- ============================================================
-- 3. Contacts go when their board or space does
--
-- Same completeness requirement as everything else keyed by pool_id: what the
-- purge forgets to sweep stays in the database forever.
-- ============================================================
CREATE OR REPLACE FUNCTION public.superadmin_purge_deleted_boards(
  p_older_than_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ids TEXT[];
  v_pools INT;
  v_spaces INT;
  v_contacts INT;
  v_entries INT;
  v_log INT;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_older_than_days IS NULL OR p_older_than_days < 0 THEN
    RAISE EXCEPTION 'retention window must be zero or more days';
  END IF;

  SELECT array_agg(id::text) INTO v_ids
    FROM pools
   WHERE deleted_at IS NOT NULL
     AND deleted_at < now() - make_interval(days => p_older_than_days);

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('pools', 0, 'state_rows', 0, 'contacts', 0,
                              'entry_contacts', 0, 'log_rows', 0);
  END IF;

  DELETE FROM spaces WHERE pool_id = ANY(v_ids);
  GET DIAGNOSTICS v_spaces = ROW_COUNT;

  DELETE FROM pickem_contacts WHERE pool_id = ANY(v_ids);
  GET DIAGNOSTICS v_contacts = ROW_COUNT;

  DELETE FROM entry_contacts WHERE pool_id = ANY(v_ids);
  GET DIAGNOSTICS v_entries = ROW_COUNT;

  DELETE FROM entry_request_log WHERE pool_id = ANY(v_ids);
  GET DIAGNOSTICS v_log = ROW_COUNT;

  DELETE FROM pools WHERE id::text = ANY(v_ids);
  GET DIAGNOSTICS v_pools = ROW_COUNT;

  PERFORM public.log_admin_action(
    'purge_deleted_boards', 'pool', NULL,
    jsonb_build_object('pools', v_pools, 'state_rows', v_spaces,
                       'contacts', v_contacts, 'entry_contacts', v_entries,
                       'log_rows', v_log, 'older_than_days', p_older_than_days));

  RETURN jsonb_build_object('pools', v_pools, 'state_rows', v_spaces,
                            'contacts', v_contacts, 'entry_contacts', v_entries,
                            'log_rows', v_log);
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_delete_space(p_space_code TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM spaces            WHERE space_code = p_space_code;
  DELETE FROM pickem_contacts   WHERE space_code = p_space_code;
  DELETE FROM entry_contacts    WHERE space_code = p_space_code;
  DELETE FROM entry_request_log WHERE space_code = p_space_code;
  DELETE FROM pools             WHERE space_code = p_space_code;
  DELETE FROM space_admins      WHERE space_code = p_space_code;
  DELETE FROM user_space_access WHERE space_code = p_space_code;
  DELETE FROM spaces_registry   WHERE code = p_space_code;
  PERFORM public.log_admin_action('delete_space', 'space', p_space_code, '{}'::jsonb);
END;
$$;

DO $$
DECLARE fn TEXT;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('superadmin_purge_deleted_boards', 'superadmin_delete_space')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- Verify:
--   -- should return 0 rows: no contact details left in any participants blob
--   SELECT s.space_code, s.pool_id
--     FROM spaces s CROSS JOIN LATERAL jsonb_array_elements(s.value) e
--    WHERE s.type = 'participants'
--      AND (e ? 'email' OR e ? 'phone' OR e ? 'payoutMethod' OR e ? 'payoutHandles');
--
--   -- moved contacts
--   SELECT space_code, count(*) FROM entry_contacts GROUP BY 1;
