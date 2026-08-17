-- Migration: Tighten Row Level Security
-- Run this in your Supabase SQL Editor after the other migrations.
--
-- Before this migration the app was effectively unauthenticated at the
-- database layer:
--
--   * `spaces`, `pools` and `spaces_registry` all had FOR ALL USING (true)
--     WITH CHECK (true), so anyone holding the anon key (which ships in the
--     client bundle) could read or rewrite any space's board, admin config,
--     participants and pending queue.
--   * `spaces_registry.password_hash` was readable by anyone, exposing the
--     bcrypt hashes for every private space.
--   * `user_profiles` and `space_admins` were world-readable, exposing every
--     registered user's email address.
--
-- After this migration the only write a non-admin can perform is submitting an
-- entry request, and that goes through submit_entry_request() rather than a
-- direct table write.

-- ============================================================
-- 0. Prerequisite: the composite unique constraint used by upserts
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.spaces'::regclass
      AND conname = 'unique_space_pool_type'
  ) THEN
    ALTER TABLE spaces ADD CONSTRAINT unique_space_pool_type
      UNIQUE (space_code, pool_id, type);
  END IF;
END $$;

-- ============================================================
-- 1. Helpers
--
-- These are SECURITY DEFINER on purpose. A policy on space_admins that queries
-- space_admins directly recurses infinitely; routing the lookup through a
-- definer-rights function breaks the cycle.
--
-- Both also accept the registry owner, so the space creator can write the
-- space's first rows before their space_admins link exists.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_space_admin(p_space_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM space_admins
      WHERE space_code = p_space_code
        AND user_id = auth.uid()
        AND accepted = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM spaces_registry
      WHERE code = p_space_code
        AND owner_id = auth.uid()
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_space_owner(p_space_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM space_admins
      WHERE space_code = p_space_code
        AND user_id = auth.uid()
        AND accepted = TRUE
        AND role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM spaces_registry
      WHERE code = p_space_code
        AND owner_id = auth.uid()
    )
  );
$$;

-- Invite flow needs to resolve an email to a user id without user_profiles
-- being world-readable. Returns only the id, and only for signed-in callers.
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM user_profiles
  WHERE auth.uid() IS NOT NULL
    AND lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;
$$;

-- ============================================================
-- 2. Entry submission
--
-- Players are anonymous, so they cannot be given write access to `spaces` —
-- that would let them rewrite the board. Instead they call this, which appends
-- one entry to the pending queue. Appending server-side also removes the
-- read-modify-write race two players hitting submit at once would otherwise hit.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_entry_request(
  p_space_code TEXT,
  p_pool_id TEXT,
  p_name TEXT,
  p_amount NUMERIC,
  p_squares INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_entry JSONB;
  v_config JSONB;
  v_existing JSONB;
BEGIN
  IF coalesce(trim(p_space_code), '') = '' OR coalesce(trim(p_pool_id), '') = '' THEN
    RAISE EXCEPTION 'space and pool are required';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'name is required';
  END IF;
  IF p_squares IS NULL OR p_squares < 1 OR p_squares > 100 THEN
    RAISE EXCEPTION 'square count must be between 1 and 100';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  -- The space and pool must actually exist
  IF NOT EXISTS (SELECT 1 FROM spaces_registry WHERE code = p_space_code) THEN
    RAISE EXCEPTION 'no such space';
  END IF;

  -- Respect the admin's "submissions closed" toggle
  SELECT value INTO v_config
    FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'admin';
  IF coalesce((v_config->>'submissionsDisabled')::boolean, false) THEN
    RAISE EXCEPTION 'submissions are closed for this pool';
  END IF;

  -- Cap the queue so an anonymous endpoint can't be used to fill the table
  SELECT value INTO v_existing
    FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'pending';
  IF coalesce(jsonb_array_length(v_existing), 0) >= 500 THEN
    RAISE EXCEPTION 'too many pending requests — ask an admin to clear the queue';
  END IF;

  v_entry := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', left(trim(p_name), 80),
    'amount', p_amount,
    'squares', p_squares,
    'requestedAt', (extract(epoch FROM now()) * 1000)::bigint
  );

  INSERT INTO spaces (key, space_code, pool_id, type, value, updated_at)
  VALUES (
    'fb-' || p_space_code || '-' || p_pool_id || '-pending',
    p_space_code,
    p_pool_id,
    'pending',
    jsonb_build_array(v_entry),
    now()
  )
  ON CONFLICT (space_code, pool_id, type)
  DO UPDATE SET
    value = coalesce(spaces.value, '[]'::jsonb) || v_entry,
    updated_at = now();

  RETURN v_entry;
END;
$$;

-- ============================================================
-- 3. Harden create_space — take ownership from the session, not the caller
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_space(
  p_code TEXT,
  p_admin_name TEXT,
  p_is_private BOOLEAN DEFAULT FALSE,
  p_password TEXT DEFAULT NULL,
  p_owner_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'must be signed in to create a space';
  END IF;

  IF p_is_private AND p_password IS NOT NULL AND length(trim(p_password)) > 0 THEN
    v_hash := crypt(trim(p_password), gen_salt('bf'));
  ELSE
    v_hash := NULL;
  END IF;

  -- p_owner_id is ignored in favour of the authenticated user
  INSERT INTO spaces_registry (code, admin_name, is_private, password_hash, owner_id)
  VALUES (p_code, p_admin_name, COALESCE(p_is_private, false), v_hash, auth.uid())
  ON CONFLICT (code) DO NOTHING;
END;
$$;

-- The original 4-argument overload predates owner_id and has no auth check.
-- CREATE OR REPLACE above defines the 5-argument version, so the old one would
-- otherwise survive as a separate, unguarded callable.
DROP FUNCTION IF EXISTS public.create_space(TEXT, TEXT, BOOLEAN, TEXT);

-- ============================================================
-- 3b. Private space unlock
--
-- grant_space_access() was SECURITY DEFINER, took an arbitrary user id and
-- never checked a password — anyone holding the anon key could grant
-- themselves permanent access to any private space. Verification and the grant
-- now happen together, keyed to the caller's own session.
-- ============================================================
CREATE OR REPLACE FUNCTION public.unlock_space(p_code TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_is_private BOOLEAN;
BEGIN
  SELECT password_hash, is_private INTO v_hash, v_is_private
    FROM spaces_registry
   WHERE code = p_code
   LIMIT 1;

  IF v_hash IS NULL OR NOT v_is_private THEN
    RETURN FALSE;
  END IF;

  IF v_hash <> crypt(coalesce(trim(p_password), ''), v_hash) THEN
    RETURN FALSE;
  END IF;

  -- Signed-in users get a durable grant; guests are session-only by design.
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO user_space_access (user_id, space_code)
    VALUES (auth.uid(), p_code)
    ON CONFLICT (user_id, space_code) DO NOTHING;
  END IF;

  RETURN TRUE;
END;
$$;

-- Neither is reachable from the client any more — unlock_space is the only way in.
REVOKE EXECUTE ON FUNCTION public.grant_space_access(UUID, TEXT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_space_password(TEXT, TEXT) FROM anon, authenticated, PUBLIC;

-- ============================================================
-- 4. Clear every existing policy on the app tables
-- ============================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN (
         'spaces', 'pools', 'spaces_registry',
         'user_profiles', 'space_admins', 'user_space_access'
       )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE spaces             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools              ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces_registry    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_admins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_space_access  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. spaces — board, config, participants, scores, headers, pending
-- ============================================================

-- Everyone can read game state. The pending queue is admin-only: it holds who
-- paid what, and players have no reason to see each other's requests.
CREATE POLICY "spaces_select" ON spaces
  FOR SELECT
  USING (type <> 'pending' OR public.is_space_admin(space_code));

-- Only space admins write. Players submit entries via submit_entry_request().
CREATE POLICY "spaces_insert" ON spaces
  FOR INSERT WITH CHECK (public.is_space_admin(space_code));

CREATE POLICY "spaces_update" ON spaces
  FOR UPDATE USING (public.is_space_admin(space_code))
         WITH CHECK (public.is_space_admin(space_code));

CREATE POLICY "spaces_delete" ON spaces
  FOR DELETE USING (public.is_space_admin(space_code));

-- ============================================================
-- 6. pools
-- ============================================================
CREATE POLICY "pools_select" ON pools
  FOR SELECT USING (true);

CREATE POLICY "pools_insert" ON pools
  FOR INSERT WITH CHECK (public.is_space_admin(space_code));

CREATE POLICY "pools_update" ON pools
  FOR UPDATE USING (public.is_space_admin(space_code))
         WITH CHECK (public.is_space_admin(space_code));

CREATE POLICY "pools_delete" ON pools
  FOR DELETE USING (public.is_space_admin(space_code));

-- ============================================================
-- 7. spaces_registry
--
-- Codes stay publicly readable so players can look up a space. The password
-- hash is removed from the anon/authenticated grant below — RLS is row-level
-- and cannot hide a single column.
-- ============================================================
CREATE POLICY "registry_select" ON spaces_registry
  FOR SELECT USING (true);

CREATE POLICY "registry_insert" ON spaces_registry
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "registry_update" ON spaces_registry
  FOR UPDATE USING (public.is_space_admin(code))
         WITH CHECK (public.is_space_admin(code));

CREATE POLICY "registry_delete" ON spaces_registry
  FOR DELETE USING (public.is_space_owner(code));

REVOKE SELECT ON spaces_registry FROM anon, authenticated;
GRANT  SELECT (id, code, admin_name, is_private, owner_id, created_at, updated_at)
  ON spaces_registry TO anon, authenticated;

-- ============================================================
-- 8. user_profiles — your own row only
-- ============================================================
CREATE POLICY "profiles_select_own" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON user_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- 9. space_admins
-- ============================================================

-- You can see your own membership rows, rows invited to your email address,
-- and — if you administer the space — everyone on it.
CREATE POLICY "space_admins_select" ON space_admins
  FOR SELECT USING (
    user_id = auth.uid()
    OR lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    OR public.is_space_admin(space_code)
  );

CREATE POLICY "space_admins_insert" ON space_admins
  FOR INSERT WITH CHECK (public.is_space_owner(space_code));

CREATE POLICY "space_admins_update" ON space_admins
  FOR UPDATE USING (public.is_space_owner(space_code))
         WITH CHECK (public.is_space_owner(space_code));

CREATE POLICY "space_admins_delete" ON space_admins
  FOR DELETE USING (public.is_space_owner(space_code));

-- ============================================================
-- 10. user_space_access — unchanged, own rows only
-- ============================================================
CREATE POLICY "space_access_select_own" ON user_space_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "space_access_insert_own" ON user_space_access
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "space_access_delete_own" ON user_space_access
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 11. Function grants
-- ============================================================
GRANT EXECUTE ON FUNCTION public.is_space_admin(TEXT)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_space_owner(TEXT)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_entry_request(TEXT, TEXT, TEXT, NUMERIC, INT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_space(TEXT, TEXT) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) TO authenticated;

-- create_space now requires a session; anon has no reason to call it
REVOKE EXECUTE ON FUNCTION public.create_space(TEXT, TEXT, BOOLEAN, TEXT, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_space(TEXT, TEXT, BOOLEAN, TEXT, UUID) TO authenticated;

-- ============================================================
-- 12. Verification
--
-- Run these after the migration to confirm it took effect.
-- ============================================================

-- Every policy should be scoped; nothing should read "true" except the
-- intentional public reads (pools_select, registry_select) and spaces_select.
--   SELECT tablename, policyname, cmd, qual, with_check
--     FROM pg_policies
--    WHERE schemaname = 'public'
--    ORDER BY tablename, cmd;

-- RLS must be on for all six tables (rowsecurity = true).
--   SELECT relname, relrowsecurity
--     FROM pg_class
--    WHERE relname IN ('spaces','pools','spaces_registry',
--                      'user_profiles','space_admins','user_space_access');

-- password_hash must NOT appear for anon or authenticated.
--   SELECT grantee, column_name
--     FROM information_schema.column_privileges
--    WHERE table_name = 'spaces_registry'
--      AND grantee IN ('anon','authenticated')
--      AND privilege_type = 'SELECT'
--    ORDER BY grantee, column_name;

-- The clearest end-to-end check: open the deployed site in a private window,
-- signed out, and in the browser console run
--   await window.supabase?.from('spaces').update({value:[]}).eq('type','board')
-- (or use the network tab). It should affect zero rows.
