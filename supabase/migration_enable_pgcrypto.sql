-- Fix: "function gen_salt(unknown) does not exist"
-- In Supabase, pgcrypto installs in the "extensions" schema. Our RPCs use search_path = public,
-- so they can't find gen_salt/crypt. Run this to recreate the functions with the correct path.
-- (Ensure pgcrypto is enabled: Dashboard → Database → Extensions → pgcrypto)

CREATE OR REPLACE FUNCTION create_space(
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
DECLARE v_hash TEXT;
BEGIN
  IF p_is_private AND p_password IS NOT NULL AND length(trim(p_password)) > 0 THEN
    v_hash := crypt(trim(p_password), gen_salt('bf'));
  ELSE
    v_hash := NULL;
  END IF;
  INSERT INTO spaces_registry (code, admin_name, is_private, password_hash, owner_id)
  VALUES (p_code, p_admin_name, COALESCE(p_is_private, false), v_hash, p_owner_id)
  ON CONFLICT (code) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION verify_space_password(p_code TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_hash TEXT; v_is_private BOOLEAN;
BEGIN
  SELECT password_hash, is_private INTO v_hash, v_is_private
  FROM spaces_registry WHERE code = p_code LIMIT 1;
  IF v_hash IS NULL OR NOT v_is_private THEN RETURN FALSE; END IF;
  RETURN v_hash = crypt(trim(p_password), v_hash);
END;
$$;
