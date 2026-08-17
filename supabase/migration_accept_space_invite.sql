-- Migration: Let invited admins claim their invite when visiting the space
-- Run this in Supabase SQL Editor if assigned admins don't see the Admin button
--
-- Fixes: admin invite created with user_id=null/accepted=false (e.g. profile lookup
-- failed due to email case mismatch) - when the user visits, they can now claim it.

CREATE OR REPLACE FUNCTION accept_space_invite(p_space_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF auth.jwt()->>'email' IS NULL OR trim(auth.jwt()->>'email') = '' THEN RETURN NULL; END IF;

  UPDATE space_admins
  SET user_id = auth.uid(), accepted = true
  WHERE space_code = p_space_code
    AND lower(trim(email)) = lower(trim(auth.jwt()->>'email'))
    AND (user_id IS NULL OR user_id != auth.uid())
    AND accepted = false
  RETURNING role INTO v_role;

  RETURN v_role;
END;
$$;
