-- Migration: Google OAuth role assignment
-- Run in the Supabase SQL Editor AFTER migration_pool_lifecycle.sql
--
-- signUpWithEmail sets role='owner' explicitly. OAuth signups never reach that
-- code — handle_new_user() falls back to COALESCE(metadata->>'role','player'),
-- and Google sends no role — so every Google signup would land as 'player' and
-- lose the owner affordances.
--
-- This runs server-side rather than as a client-side profile update, because
-- user_profiles is self-updatable: a client-side version would let any account
-- promote itself.

CREATE OR REPLACE FUNCTION public.claim_owner_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_memberships INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;

  SELECT role INTO v_role FROM user_profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN RETURN NULL; END IF;

  -- Only ever promotes a plain player. Never touches an owner or a superadmin.
  IF v_role <> 'player' THEN RETURN v_role; END IF;

  -- An invited admin is legitimately a 'player' with space memberships —
  -- handle_new_user() auto-accepts their invite at signup, so a row already
  -- exists by the time this runs. Their role is left alone.
  SELECT count(*) INTO v_memberships FROM space_admins WHERE user_id = auth.uid();
  IF v_memberships > 0 THEN RETURN v_role; END IF;

  UPDATE user_profiles SET role = 'owner' WHERE id = auth.uid();
  RETURN 'owner';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_owner_role() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_owner_role() TO authenticated;

-- Verify:
--   SELECT email, role FROM user_profiles ORDER BY created_at DESC LIMIT 10;
