-- Migration: take contact details out of the picks blob, and hide sheets
-- until kickoff
-- Run in the Supabase SQL Editor AFTER migration_pickem.sql
--
-- Two problems, both live before this ran:
--
--   1. `spaces_select` allowed anyone to read `type = 'picks'`, and every entry
--      in that blob carried the entrant's email and phone. A single
--      unauthenticated PostgREST call returned the contact details of every
--      pick'em entrant across every space.
--
--   2. The same read exposed everyone's picks before the first kickoff, so the
--      standings UI hiding them was decoration — the sheets were one devtools
--      panel away right up until they stopped mattering.
--
-- Contact details now live in their own admin-only table and never enter the
-- blob. Picks are read through list_picks(), which withholds the picks and the
-- tiebreaker guess until the slate locks. The blob keeps only an email hash,
-- which is what the one-sheet-per-email rule actually needs.

-- ============================================================
-- 1. Contact details, out of the blob
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pickem_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_code TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_pickem_contact UNIQUE (space_code, pool_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_pickem_contacts_pool
  ON public.pickem_contacts(space_code, pool_id);

ALTER TABLE public.pickem_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pickem_contacts_select" ON public.pickem_contacts;

-- Read-only, admins only. Every write goes through a SECURITY DEFINER function
-- below; there is deliberately no insert/update/delete policy.
CREATE POLICY "pickem_contacts_select" ON public.pickem_contacts
  FOR SELECT USING (public.is_space_admin(space_code));

GRANT SELECT ON public.pickem_contacts TO authenticated;

-- ============================================================
-- 2. Move what's already there, then strip it
-- ============================================================
INSERT INTO public.pickem_contacts (space_code, pool_id, entry_id, email, phone)
SELECT s.space_code,
       s.pool_id,
       e ->> 'id',
       lower(trim(e ->> 'email')),
       coalesce(e ->> 'phone', '')
  FROM spaces s
  CROSS JOIN LATERAL jsonb_array_elements(s.value) e
 WHERE s.type = 'picks'
   AND jsonb_typeof(s.value) = 'array'
   AND coalesce(e ->> 'id', '') <> ''
   AND coalesce(trim(e ->> 'email'), '') <> ''
ON CONFLICT (space_code, pool_id, entry_id) DO NOTHING;

-- The hash replaces the address for de-duplication. Entries that somehow have
-- no email keep no hash rather than the hash of an empty string, which would
-- collide every one of them together.
UPDATE spaces s
   SET value = (
         SELECT coalesce(
                  jsonb_agg(
                    CASE
                      WHEN coalesce(trim(e ->> 'email'), '') <> ''
                        THEN (e - 'email' - 'phone')
                             || jsonb_build_object('emailHash', md5(lower(trim(e ->> 'email'))))
                      ELSE (e - 'email' - 'phone')
                    END
                    ORDER BY ord
                  ),
                  '[]'::jsonb
                )
           FROM jsonb_array_elements(s.value) WITH ORDINALITY AS t(e, ord)
       ),
       updated_at = now()
 WHERE s.type = 'picks'
   AND jsonb_typeof(s.value) = 'array'
   AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(s.value) e
          WHERE e ? 'email' OR e ? 'phone'
       );

-- ============================================================
-- 3. Close the direct read
--
-- Mirrors how 'pending' is handled. Players reach picks through list_picks()
-- instead, which is the only thing that knows about the lock.
-- ============================================================
DROP POLICY IF EXISTS "spaces_select" ON spaces;

CREATE POLICY "spaces_select" ON spaces
  FOR SELECT
  USING (type NOT IN ('pending', 'picks') OR public.is_space_admin(space_code));

-- ============================================================
-- 4. Reading sheets
--
-- Callable by anyone, because players are anonymous — so it must be the thing
-- that enforces the lock. Before the first kickoff it returns who has entered
-- and nothing about what they chose. The tiebreaker guess is withheld too: it
-- is a competitive input, and seeing everyone else's lets a late entrant pick
-- around them.
--
-- The lock is read from the stored slate, never from the caller.
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_picks(
  p_space_code TEXT,
  p_pool_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_slate JSONB;
  v_entries JSONB;
  v_lock TIMESTAMPTZ;
  v_locked BOOLEAN;
BEGIN
  IF coalesce(trim(p_space_code), '') = '' OR coalesce(trim(p_pool_id), '') = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT value INTO v_slate FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'slate';

  SELECT value INTO v_entries FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'picks';

  IF v_entries IS NULL OR jsonb_typeof(v_entries) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT min((g ->> 'startsAt')::timestamptz) INTO v_lock
    FROM jsonb_array_elements(coalesce(v_slate -> 'games', '[]'::jsonb)) g;

  -- A slate with no kickoff times has nothing to lock on, so it stays closed
  -- rather than defaulting to open.
  v_locked := v_lock IS NOT NULL AND now() >= v_lock;

  SELECT coalesce(jsonb_agg(
           CASE WHEN v_locked
             THEN jsonb_build_object(
                    'id', e ->> 'id',
                    'name', e ->> 'name',
                    'paid', coalesce((e ->> 'paid')::boolean, false),
                    'submittedAt', (e ->> 'submittedAt')::bigint,
                    'picks', coalesce(e -> 'picks', '{}'::jsonb),
                    'tiebreak', (e ->> 'tiebreak')::int
                  )
             ELSE jsonb_build_object(
                    'id', e ->> 'id',
                    'name', e ->> 'name',
                    'paid', coalesce((e ->> 'paid')::boolean, false),
                    'submittedAt', (e ->> 'submittedAt')::bigint
                  )
           END
           ORDER BY ord
         ), '[]'::jsonb)
    INTO v_entries
    FROM jsonb_array_elements(v_entries) WITH ORDINALITY AS t(e, ord);

  RETURN v_entries;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_picks(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_picks(TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- 5. Admin mutations
--
-- The admin console used to load the whole blob, change one field and write it
-- all back. It can't any more — it only ever sees the sanitised view, and
-- writing that back would erase everyone's picks. These do the edit in place.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_pickem_paid(
  p_space_code TEXT,
  p_pool_id TEXT,
  p_entry_id TEXT,
  p_paid BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_entries JSONB;
BEGIN
  IF NOT public.is_space_admin(p_space_code) THEN
    RAISE EXCEPTION 'Only space admins can change entries';
  END IF;

  SELECT value INTO v_entries FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'picks';
  IF v_entries IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(
           CASE WHEN e ->> 'id' = p_entry_id
             THEN e || jsonb_build_object('paid', p_paid)
             ELSE e
           END ORDER BY ord
         ), '[]'::jsonb)
    INTO v_entries
    FROM jsonb_array_elements(v_entries) WITH ORDINALITY AS t(e, ord);

  UPDATE spaces SET value = v_entries, updated_at = now()
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'picks';

  RETURN public.list_picks(p_space_code, p_pool_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_pickem_entry(
  p_space_code TEXT,
  p_pool_id TEXT,
  p_entry_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_entries JSONB;
BEGIN
  IF NOT public.is_space_admin(p_space_code) THEN
    RAISE EXCEPTION 'Only space admins can remove entries';
  END IF;

  SELECT value INTO v_entries FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'picks';
  IF v_entries IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(e ORDER BY ord), '[]'::jsonb) INTO v_entries
    FROM jsonb_array_elements(v_entries) WITH ORDINALITY AS t(e, ord)
   WHERE e ->> 'id' <> p_entry_id;

  UPDATE spaces SET value = v_entries, updated_at = now()
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'picks';

  -- The contact goes with the entry; leaving it would keep an address for
  -- someone who is no longer in the contest.
  DELETE FROM public.pickem_contacts
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND entry_id = p_entry_id;

  RETURN public.list_picks(p_space_code, p_pool_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_pickem_entries(
  p_space_code TEXT,
  p_pool_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_space_admin(p_space_code) THEN
    RAISE EXCEPTION 'Only space admins can reset a contest';
  END IF;

  UPDATE spaces SET value = '[]'::jsonb, updated_at = now()
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'picks';

  DELETE FROM public.pickem_contacts
   WHERE space_code = p_space_code AND pool_id = p_pool_id;

  RETURN '[]'::jsonb;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_pickem_paid(TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_pickem_paid(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remove_pickem_entry(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_pickem_entry(TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.clear_pickem_entries(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_pickem_entries(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 6. Submitting a sheet, without writing an address into the blob
--
-- Unchanged in every validation; the difference is where the email and phone
-- land. The blob keeps md5(email) because that is all the one-sheet-per-email
-- rule needs, and the address itself goes to pickem_contacts.
--
-- The returned entry is what the submitter sees, so it carries no contact
-- details either — they already know their own.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_picks(
  p_space_code TEXT,
  p_pool_id TEXT,
  p_name TEXT,
  p_picks JSONB,
  p_tiebreak INT,
  p_contact JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_slate JSONB;
  v_existing JSONB;
  v_entry JSONB;
  v_email TEXT;
  v_phone TEXT;
  v_hash TEXT;
  v_lock TIMESTAMPTZ;
  v_recent INT;
  v_games INT;
BEGIN
  IF coalesce(trim(p_space_code), '') = '' OR coalesce(trim(p_pool_id), '') = '' THEN
    RAISE EXCEPTION 'space and contest are required';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN RAISE EXCEPTION 'Name is required'; END IF;

  v_email := lower(trim(coalesce(p_contact ->> 'email', '')));
  v_phone := trim(coalesce(p_contact ->> 'phone', ''));
  IF v_email = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'That email address does not look valid';
  END IF;
  IF v_phone = '' THEN RAISE EXCEPTION 'Phone number is required'; END IF;
  IF p_tiebreak IS NULL OR p_tiebreak < 0 OR p_tiebreak > 200 THEN
    RAISE EXCEPTION 'Enter a tiebreaker total between 0 and 200';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pools
     WHERE id::text = p_pool_id AND space_code = p_space_code AND paid AND game_type = 'pickem'
  ) THEN
    RAISE EXCEPTION 'This contest is not active yet. Ask your admin to finish setting it up.';
  END IF;

  SELECT value INTO v_slate FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'slate';
  IF v_slate IS NULL THEN RAISE EXCEPTION 'This contest has no games yet'; END IF;

  -- Every game must be picked, so a partial sheet can't quietly score lower
  SELECT count(*) INTO v_games FROM jsonb_array_elements(v_slate -> 'games');
  IF (SELECT count(*) FROM jsonb_object_keys(p_picks)) < v_games THEN
    RAISE EXCEPTION 'Pick a winner in every game';
  END IF;

  -- Picks close at the first kickoff of the week, read from the slate itself
  SELECT min((g ->> 'startsAt')::timestamptz) INTO v_lock
    FROM jsonb_array_elements(v_slate -> 'games') g;
  IF v_lock IS NOT NULL AND now() >= v_lock THEN
    RAISE EXCEPTION 'Picks are closed for this week';
  END IF;

  v_hash := md5(v_email);
  DELETE FROM entry_request_log WHERE created_at < now() - interval '1 day';
  SELECT count(*) INTO v_recent FROM entry_request_log
   WHERE email_hash = v_hash AND created_at > now() - interval '1 hour';
  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'Too many submissions from this email address. Try again in an hour.';
  END IF;

  SELECT value INTO v_existing FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'picks';

  IF coalesce(jsonb_array_length(v_existing), 0) >= 500 THEN
    RAISE EXCEPTION 'This contest is full';
  END IF;

  v_entry := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', left(trim(p_name), 80),
    'emailHash', v_hash,
    'picks', p_picks,
    'tiebreak', p_tiebreak,
    'paid', false,
    'submittedAt', (extract(epoch FROM now()) * 1000)::bigint
  );

  -- One sheet per email: a resubmission replaces the previous one rather than
  -- stacking, which would otherwise let someone cover every outcome. Matched on
  -- the hash now that the address itself isn't here.
  v_existing := coalesce(v_existing, '[]'::jsonb);
  SELECT coalesce(jsonb_agg(e), '[]'::jsonb) INTO v_existing
    FROM jsonb_array_elements(v_existing) e
   WHERE coalesce(e ->> 'emailHash', '') <> v_hash;

  INSERT INTO spaces (key, space_code, pool_id, type, value, updated_at)
  VALUES ('fb-' || p_space_code || '-' || p_pool_id || '-picks',
          p_space_code, p_pool_id, 'picks', jsonb_build_array(v_entry), now())
  ON CONFLICT (space_code, pool_id, type)
  DO UPDATE SET value = v_existing || v_entry, updated_at = now();

  -- The replaced sheet's contact row goes with it, then the new one lands.
  DELETE FROM public.pickem_contacts
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND email = v_email;

  INSERT INTO public.pickem_contacts (space_code, pool_id, entry_id, email, phone)
  VALUES (p_space_code, p_pool_id, v_entry ->> 'id', v_email, left(v_phone, 32));

  INSERT INTO entry_request_log (space_code, pool_id, email_hash)
  VALUES (p_space_code, p_pool_id, v_hash);

  RETURN v_entry - 'emailHash';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_picks(TEXT, TEXT, TEXT, JSONB, INT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_picks(TEXT, TEXT, TEXT, JSONB, INT, JSONB)
  TO anon, authenticated;

-- Verify:
--   -- should return 0 rows: no contact details left in any blob
--   SELECT s.space_code, s.pool_id
--     FROM spaces s CROSS JOIN LATERAL jsonb_array_elements(s.value) e
--    WHERE s.type = 'picks' AND (e ? 'email' OR e ? 'phone');
--
--   -- should be denied for an anonymous caller
--   SELECT * FROM spaces WHERE type = 'picks';
--
--   -- moved contacts
--   SELECT space_code, pool_id, count(*) FROM pickem_contacts GROUP BY 1, 2;
