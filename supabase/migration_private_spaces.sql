-- Migration: Private Spaces
-- Adds ability to create private spaces with passwords
-- Run in Supabase SQL Editor after schema.sql and migration_user_roles.sql

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add private space columns to spaces_registry
ALTER TABLE spaces_registry
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Table: track which users have unlocked which private spaces (registered users only)
CREATE TABLE IF NOT EXISTS user_space_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_space_access UNIQUE (user_id, space_code)
);

CREATE INDEX IF NOT EXISTS idx_user_space_access_user ON user_space_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_space_access_space ON user_space_access(space_code);

ALTER TABLE user_space_access ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only manage their own access records
CREATE POLICY "Users can read own space access"
  ON user_space_access FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own space access"
  ON user_space_access FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own space access"
  ON user_space_access FOR DELETE
  USING (auth.uid() = user_id);

-- RPC: Create a space (handles password hashing server-side)
CREATE OR REPLACE FUNCTION create_space(
  p_code TEXT,
  p_admin_name TEXT,
  p_is_private BOOLEAN DEFAULT FALSE,
  p_password TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_is_private AND p_password IS NOT NULL AND length(trim(p_password)) > 0 THEN
    v_hash := crypt(trim(p_password), gen_salt('bf'));
  ELSE
    v_hash := NULL;
  END IF;

  INSERT INTO spaces_registry (code, admin_name, is_private, password_hash)
  VALUES (p_code, p_admin_name, COALESCE(p_is_private, false), v_hash)
  ON CONFLICT (code) DO NOTHING;
END;
$$;

-- RPC: Verify space password (returns true if correct)
CREATE OR REPLACE FUNCTION verify_space_password(p_code TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  RETURN v_hash = crypt(trim(p_password), v_hash);
END;
$$;

-- RPC: Grant space access to a user (after password verified)
CREATE OR REPLACE FUNCTION grant_space_access(p_user_id UUID, p_space_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_space_access (user_id, space_code)
  VALUES (p_user_id, p_space_code)
  ON CONFLICT (user_id, space_code) DO NOTHING;
END;
$$;
