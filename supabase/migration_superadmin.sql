-- Migration: Superadmin
-- Run in the Supabase SQL Editor AFTER migration_tighten_rls.sql
--
-- Adds a third role that can see and act across every space, plus the audit
-- trail that makes those powers accountable.
--
-- Deliberately client-only: nothing here needs the service_role key. Accounts
-- are closed by flag rather than deleted, and "view as" is a read-only lens
-- rather than a real session, because minting sessions or deleting auth.users
-- would require shipping a key that bypasses every policy below.

-- ============================================================
-- 1. Schema
-- ============================================================

-- 'superadmin' fails the original CHECK (role IN ('owner','player'))
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('owner', 'player', 'superadmin'));

-- Soft close. The auth.users row survives; access stops.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_closed ON user_profiles(closed_at);

-- ============================================================
-- 2. Audit log
--
-- Written only by the SECURITY DEFINER RPCs below — there is no INSERT policy,
-- so a superadmin cannot forge or edit entries from the client.
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON admin_audit_log(actor_id);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'superadmin'
      AND closed_at IS NULL
  );
$$;

-- A closed account keeps its rows but loses the ability to act
CREATE OR REPLACE FUNCTION public.is_account_active()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND closed_at IS NOT NULL
  );
$$;

-- Re-defined to fold in superadmin reach and the closed-account check
CREATE OR REPLACE FUNCTION public.is_space_admin(p_space_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND closed_at IS NOT NULL)
    AND (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
      OR EXISTS (
        SELECT 1 FROM space_admins
        WHERE space_code = p_space_code AND user_id = auth.uid() AND accepted = TRUE
      )
      OR EXISTS (
        SELECT 1 FROM spaces_registry WHERE code = p_space_code AND owner_id = auth.uid()
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
  SELECT auth.uid() IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND closed_at IS NOT NULL)
    AND (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
      OR EXISTS (
        SELECT 1 FROM space_admins
        WHERE space_code = p_space_code AND user_id = auth.uid()
          AND accepted = TRUE AND role = 'owner'
      )
      OR EXISTS (
        SELECT 1 FROM spaces_registry WHERE code = p_space_code AND owner_id = auth.uid()
      )
    );
$$;

-- Internal: every privileged RPC below records what it did
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT, p_target_type TEXT, p_target_id TEXT, p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO admin_audit_log (actor_id, actor_email, action, target_type, target_id, metadata)
  VALUES (auth.uid(), auth.jwt() ->> 'email', p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated, PUBLIC;

-- ============================================================
-- 4. Policies
-- ============================================================

CREATE POLICY "audit_select_superadmin" ON admin_audit_log
  FOR SELECT USING (public.is_superadmin());

-- Superadmin reach on the existing tables. Additive: the tighten_rls policies
-- stay in place, and PERMISSIVE policies OR together.
CREATE POLICY "spaces_superadmin_all" ON spaces
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "pools_superadmin_all" ON pools
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "registry_superadmin_all" ON spaces_registry
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "profiles_superadmin_all" ON user_profiles
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "space_admins_superadmin_all" ON space_admins
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "space_access_superadmin_all" ON user_space_access
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- Closed accounts can no longer create spaces
DROP POLICY IF EXISTS "registry_insert" ON spaces_registry;
CREATE POLICY "registry_insert" ON spaces_registry
  FOR INSERT WITH CHECK (
    public.is_account_active() AND owner_id = auth.uid()
  );

-- ============================================================
-- 5. Dashboard stats
--
-- "Active" is ambiguous, so three separate numbers are reported rather than
-- one that hides its own definition.
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

    'boards_total',       (SELECT count(*) FROM pools),
    'boards_unarchived',  (SELECT count(*) FROM pools WHERE NOT coalesce(archived, false)),
    'boards_with_entries',(
        SELECT count(*) FROM pools p
        WHERE EXISTS (
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

-- ============================================================
-- 6. Listings (search-backed, so the dashboard survives growth)
-- ============================================================
CREATE OR REPLACE FUNCTION public.superadmin_list_users(
  p_search TEXT DEFAULT NULL, p_limit INT DEFAULT 50, p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID, email TEXT, display_name TEXT, role TEXT,
  closed_at TIMESTAMPTZ, closed_reason TEXT, created_at TIMESTAMPTZ, space_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT u.id, u.email, u.display_name, u.role, u.closed_at, u.closed_reason, u.created_at,
           (SELECT count(*) FROM space_admins sa WHERE sa.user_id = u.id AND sa.accepted) AS space_count
      FROM user_profiles u
     WHERE p_search IS NULL OR trim(p_search) = ''
        OR u.email ILIKE '%' || trim(p_search) || '%'
        OR coalesce(u.display_name, '') ILIKE '%' || trim(p_search) || '%'
     ORDER BY u.created_at DESC
     LIMIT greatest(1, least(p_limit, 200)) OFFSET greatest(0, p_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_list_spaces(
  p_search TEXT DEFAULT NULL, p_limit INT DEFAULT 50, p_offset INT DEFAULT 0
)
RETURNS TABLE (
  code TEXT, admin_name TEXT, is_private BOOLEAN, owner_id UUID, owner_email TEXT,
  created_at TIMESTAMPTZ, board_count BIGINT, pending_count INT, last_activity TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT r.code, r.admin_name, coalesce(r.is_private, false), r.owner_id,
           (SELECT u.email FROM user_profiles u WHERE u.id = r.owner_id),
           r.created_at,
           (SELECT count(*) FROM pools p WHERE p.space_code = r.code),
           coalesce((SELECT sum(jsonb_array_length(s.value))::int FROM spaces s
                      WHERE s.space_code = r.code AND s.type = 'pending'
                        AND jsonb_typeof(s.value) = 'array'), 0),
           (SELECT max(s.updated_at) FROM spaces s WHERE s.space_code = r.code)
      FROM spaces_registry r
     WHERE p_search IS NULL OR trim(p_search) = ''
        OR r.code ILIKE '%' || trim(p_search) || '%'
        OR coalesce(r.admin_name, '') ILIKE '%' || trim(p_search) || '%'
     ORDER BY r.created_at DESC
     LIMIT greatest(1, least(p_limit, 200)) OFFSET greatest(0, p_offset);
END;
$$;

-- ============================================================
-- 7. Privileged actions — every one is audited
-- ============================================================

CREATE OR REPLACE FUNCTION public.superadmin_close_account(p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role TEXT; v_email TEXT;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'cannot close your own account'; END IF;

  SELECT role, email INTO v_role, v_email FROM user_profiles WHERE id = p_user_id;
  IF v_role IS NULL THEN RAISE EXCEPTION 'no such user'; END IF;
  -- Guard against locking everyone out
  IF v_role = 'superadmin' THEN RAISE EXCEPTION 'close the superadmin role first, then the account'; END IF;

  UPDATE user_profiles
     SET closed_at = now(), closed_reason = nullif(trim(coalesce(p_reason, '')), '')
   WHERE id = p_user_id;

  PERFORM public.log_admin_action('close_account', 'user', p_user_id::text,
    jsonb_build_object('email', v_email, 'reason', p_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_reopen_account(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE user_profiles SET closed_at = NULL, closed_reason = NULL WHERE id = p_user_id;
  PERFORM public.log_admin_action('reopen_account', 'user', p_user_id::text, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_set_role(p_user_id UUID, p_role TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_old TEXT;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_role NOT IN ('owner', 'player', 'superadmin') THEN RAISE EXCEPTION 'invalid role'; END IF;
  IF p_user_id = auth.uid() AND p_role <> 'superadmin' THEN
    RAISE EXCEPTION 'cannot demote yourself';
  END IF;

  SELECT role INTO v_old FROM user_profiles WHERE id = p_user_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'no such user'; END IF;

  -- Never drop to zero superadmins
  IF v_old = 'superadmin' AND p_role <> 'superadmin'
     AND (SELECT count(*) FROM user_profiles WHERE role = 'superadmin' AND closed_at IS NULL) <= 1 THEN
    RAISE EXCEPTION 'cannot remove the last superadmin';
  END IF;

  UPDATE user_profiles SET role = p_role WHERE id = p_user_id;
  PERFORM public.log_admin_action('set_role', 'user', p_user_id::text,
    jsonb_build_object('from', v_old, 'to', p_role));
END;
$$;

-- Support case with no other recovery path: a private space's password is
-- bcrypt-hashed, so nobody — including a superadmin — can read it back.
-- Passing NULL makes the space public instead.
CREATE OR REPLACE FUNCTION public.superadmin_reset_space_password(
  p_space_code TEXT, p_new_password TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM spaces_registry WHERE code = p_space_code) THEN
    RAISE EXCEPTION 'no such space';
  END IF;

  IF p_new_password IS NULL OR trim(p_new_password) = '' THEN
    UPDATE spaces_registry SET is_private = FALSE, password_hash = NULL WHERE code = p_space_code;
    PERFORM public.log_admin_action('space_made_public', 'space', p_space_code, '{}'::jsonb);
  ELSE
    UPDATE spaces_registry
       SET is_private = TRUE, password_hash = crypt(trim(p_new_password), gen_salt('bf'))
     WHERE code = p_space_code;
    PERFORM public.log_admin_action('space_password_reset', 'space', p_space_code, '{}'::jsonb);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_transfer_space(p_space_code TEXT, p_new_owner UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_old UUID; v_email TEXT;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT owner_id INTO v_old FROM spaces_registry WHERE code = p_space_code;
  SELECT email INTO v_email FROM user_profiles WHERE id = p_new_owner;
  IF v_email IS NULL THEN RAISE EXCEPTION 'no such user'; END IF;

  UPDATE spaces_registry SET owner_id = p_new_owner WHERE code = p_space_code;

  INSERT INTO space_admins (space_code, user_id, email, role, accepted)
  VALUES (p_space_code, p_new_owner, v_email, 'owner', TRUE)
  ON CONFLICT (space_code, email)
  DO UPDATE SET user_id = p_new_owner, role = 'owner', accepted = TRUE;

  PERFORM public.log_admin_action('transfer_space', 'space', p_space_code,
    jsonb_build_object('from', v_old, 'to', p_new_owner, 'to_email', v_email));
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_delete_space(p_space_code TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM spaces           WHERE space_code = p_space_code;
  DELETE FROM pools            WHERE space_code = p_space_code;
  DELETE FROM space_admins     WHERE space_code = p_space_code;
  DELETE FROM user_space_access WHERE space_code = p_space_code;
  DELETE FROM spaces_registry  WHERE code = p_space_code;
  PERFORM public.log_admin_action('delete_space', 'space', p_space_code, '{}'::jsonb);
END;
$$;

-- "View as" is read-only and never mints a session, but it still gets logged —
-- looking at someone's account is an action worth recording.
CREATE OR REPLACE FUNCTION public.superadmin_view_as(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r JSONB;
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT jsonb_build_object(
    'id', u.id, 'email', u.email, 'display_name', u.display_name, 'role', u.role,
    'closed_at', u.closed_at, 'created_at', u.created_at,
    'spaces', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'code', sa.space_code, 'role', sa.role, 'accepted', sa.accepted,
        'is_private', (SELECT r2.is_private FROM spaces_registry r2 WHERE r2.code = sa.space_code)))
      FROM space_admins sa WHERE sa.user_id = u.id), '[]'::jsonb),
    'unlocked_spaces', coalesce((
      SELECT jsonb_agg(a.space_code) FROM user_space_access a WHERE a.user_id = u.id), '[]'::jsonb)
  ) INTO r
  FROM user_profiles u WHERE u.id = p_user_id;

  IF r IS NULL THEN RAISE EXCEPTION 'no such user'; END IF;
  IF (r ->> 'role') = 'superadmin' THEN RAISE EXCEPTION 'cannot view as another superadmin'; END IF;

  PERFORM public.log_admin_action('view_as', 'user', p_user_id::text,
    jsonb_build_object('email', r ->> 'email'));
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_audit_log(p_limit INT DEFAULT 100)
RETURNS TABLE (
  id UUID, actor_email TEXT, action TEXT, target_type TEXT, target_id TEXT,
  metadata JSONB, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT l.id, l.actor_email, l.action, l.target_type, l.target_id, l.metadata, l.created_at
      FROM admin_audit_log l
     ORDER BY l.created_at DESC
     LIMIT greatest(1, least(p_limit, 500));
END;
$$;

-- ============================================================
-- 8. Grants — authenticated only; each RPC re-checks is_superadmin() itself
-- ============================================================
DO $$
DECLARE fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'superadmin_stats()',
    'superadmin_list_users(TEXT,INT,INT)',
    'superadmin_list_spaces(TEXT,INT,INT)',
    'superadmin_close_account(UUID,TEXT)',
    'superadmin_reopen_account(UUID)',
    'superadmin_set_role(UUID,TEXT)',
    'superadmin_reset_space_password(TEXT,TEXT)',
    'superadmin_transfer_space(TEXT,UUID)',
    'superadmin_delete_space(TEXT)',
    'superadmin_view_as(UUID)',
    'superadmin_audit_log(INT)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.is_superadmin()     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_active() TO anon, authenticated;

-- ============================================================
-- 9. Bootstrap — there is no other way in, by design
-- ============================================================
-- Run this once, with your own email:
--
--   UPDATE user_profiles SET role = 'superadmin' WHERE email = 'you@example.com';
--
-- Verify:
--   SELECT email, role FROM user_profiles WHERE role = 'superadmin';
