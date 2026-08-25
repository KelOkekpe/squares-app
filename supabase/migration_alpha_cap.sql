-- Migration: cap how many people can run pools during the alpha
-- Run in the Supabase SQL Editor AFTER migration_entry_privacy.sql
--
-- The cap is on **organisers**, not signups. One organiser brings ten to thirty
-- players, and it is the organisers who generate support: they configure
-- boards, confirm payments and answer their group. Capping total accounts would
-- cap the wrong thing and lock out the players an organiser invites.
--
-- Enforced as a trigger on spaces_registry rather than inside create_space(),
-- because create_space() is only used for *private* spaces — a public one is a
-- direct client insert guarded by RLS. Capping the function would leave the
-- larger path wide open. A trigger catches both, and anything added later.
--
-- To open the gates when the alpha ends:
--   UPDATE app_settings SET value = '100000' WHERE key = 'alpha_max_owners';
-- To let a specific person in regardless of the cap:
--   INSERT INTO owner_allowlist (email, note) VALUES ('them@example.com', 'why');

-- ============================================================
-- 1. The knob, and the exceptions to it
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES ('alpha_max_owners', '12'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.owner_allowlist (
  email TEXT PRIMARY KEY,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_allowlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_superadmin" ON public.app_settings;
DROP POLICY IF EXISTS "owner_allowlist_superadmin" ON public.owner_allowlist;

-- No policy for anyone else. The trigger reads these as SECURITY DEFINER, so
-- they don't need to be readable by the person being checked — and the
-- allowlist is a list of people's email addresses.
CREATE POLICY "app_settings_superadmin" ON public.app_settings
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "owner_allowlist_superadmin" ON public.owner_allowlist
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_allowlist TO authenticated;

-- ============================================================
-- 2. Is there room for this person?
-- ============================================================
CREATE OR REPLACE FUNCTION public.owner_slot_available(p_user UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap INT;
  v_used INT;
  v_email TEXT;
BEGIN
  IF p_user IS NULL THEN RETURN TRUE; END IF;

  -- Already running something: they are inside the gate and may open another
  -- board or space without consuming a second slot.
  IF EXISTS (SELECT 1 FROM spaces_registry WHERE owner_id = p_user) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = p_user AND role = 'superadmin') THEN
    RETURN TRUE;
  END IF;

  SELECT email INTO v_email FROM user_profiles WHERE id = p_user;
  IF v_email IS NOT NULL
     AND EXISTS (SELECT 1 FROM owner_allowlist WHERE lower(email) = lower(v_email)) THEN
    RETURN TRUE;
  END IF;

  SELECT (value #>> '{}')::int INTO v_cap FROM app_settings WHERE key = 'alpha_max_owners';
  IF v_cap IS NULL THEN RETURN TRUE; END IF;

  SELECT count(DISTINCT owner_id) INTO v_used
    FROM spaces_registry WHERE owner_id IS NOT NULL;

  RETURN v_used < v_cap;
END;
$$;

-- ============================================================
-- 3. Enforce it on the way in
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_owner_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No session means the service role, a migration, or the SQL editor — i.e.
  -- you. This is a product gate on self-serve signups, not a data-integrity
  -- rule, and blocking your own tooling would be the wrong trade.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF NOT public.owner_slot_available(auth.uid()) THEN
    RAISE EXCEPTION
      'SquarePool is in limited alpha and is not taking new organisers right now. Your account still works — ask whoever invited you to add you to their space as an admin.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_owner_cap ON spaces_registry;

CREATE TRIGGER trg_enforce_owner_cap
  BEFORE INSERT ON spaces_registry
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_cap();

-- ============================================================
-- 4. Show it in the console
--
-- Redefined rather than patched: superadmin_stats is one jsonb_build_object,
-- so the two new counts have to go in with the rest.
-- ============================================================
CREATE OR REPLACE FUNCTION public.superadmin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r JSONB;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT jsonb_build_object(
    'users_total',        (SELECT count(*) FROM user_profiles),
    'users_owners',       (SELECT count(*) FROM user_profiles WHERE role = 'owner'),
    'users_players',      (SELECT count(*) FROM user_profiles WHERE role = 'player'),
    'users_superadmins',  (SELECT count(*) FROM user_profiles WHERE role = 'superadmin'),
    'users_closed',       (SELECT count(*) FROM user_profiles WHERE closed_at IS NOT NULL),
    'users_new_30d',      (SELECT count(*) FROM user_profiles WHERE created_at > now() - interval '30 days'),

    'spaces_total',       (SELECT count(*) FROM spaces_registry),
    'spaces_private',     (SELECT count(*) FROM spaces_registry WHERE is_private),
    'spaces_ownerless',   (SELECT count(*) FROM spaces_registry WHERE owner_id IS NULL),
    'spaces_new_30d',     (SELECT count(*) FROM spaces_registry WHERE created_at > now() - interval '30 days'),

    -- Alpha gate: distinct people running spaces, against the configured cap.
    'owners_used',        (SELECT count(DISTINCT owner_id) FROM spaces_registry
                            WHERE owner_id IS NOT NULL),
    'owners_cap',         (SELECT (value #>> '{}')::int FROM app_settings
                            WHERE key = 'alpha_max_owners'),
    'owners_allowlisted', (SELECT count(*) FROM owner_allowlist),

    'boards_total',       (SELECT count(*) FROM pools WHERE deleted_at IS NULL),
    'boards_unarchived',  (SELECT count(*) FROM pools
                            WHERE deleted_at IS NULL AND NOT coalesce(archived, false)),
    'boards_deleted',     (SELECT count(*) FROM pools WHERE deleted_at IS NOT NULL),
    'boards_with_entries',(
        SELECT count(*) FROM pools p
        WHERE p.deleted_at IS NULL AND EXISTS (
          SELECT 1 FROM spaces s
          WHERE s.pool_id = p.id::text AND s.type = 'participants'
            AND jsonb_typeof(s.value) = 'array' AND jsonb_array_length(s.value) > 0
        )),
    'boards_touched_30d', (
        SELECT count(DISTINCT s.pool_id) FROM spaces s
        WHERE s.pool_id <> '' AND s.updated_at > now() - interval '30 days'),

    'pending_entries',    (
        SELECT coalesce(sum(jsonb_array_length(value)), 0) FROM spaces
        WHERE type = 'pending' AND jsonb_typeof(value) = 'array'),
    'pending_stale_7d',   (
        SELECT count(*) FROM spaces
        WHERE type = 'pending' AND jsonb_typeof(value) = 'array'
          AND jsonb_array_length(value) > 0 AND updated_at < now() - interval '7 days'),

    'rows_spaces',        (SELECT count(*) FROM spaces)
  ) INTO r;

  RETURN r;
END;
$$;

DO $$
DECLARE fn TEXT;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('superadmin_stats', 'owner_slot_available')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- Verify:
--   SELECT (value #>> '{}')::int AS cap FROM app_settings WHERE key = 'alpha_max_owners';
--   SELECT count(DISTINCT owner_id) AS used FROM spaces_registry WHERE owner_id IS NOT NULL;
--   SELECT * FROM owner_allowlist;
