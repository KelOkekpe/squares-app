-- =============================================================================
-- Full Schema Migration - Football Squares App
-- Run this in Supabase SQL Editor to set up the complete database
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. Base tables (schema.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_code TEXT NOT NULL,
  pool_id TEXT,
  type TEXT NOT NULL,
  value JSONB NOT NULL,
  key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_space_pool_type UNIQUE (space_code, pool_id, type)
);

CREATE TABLE IF NOT EXISTS pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_code TEXT NOT NULL,
  name TEXT NOT NULL,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_pool_name_per_space UNIQUE (space_code, name)
);

CREATE TABLE IF NOT EXISTS spaces_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  admin_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spaces_space_code ON spaces(space_code);
CREATE INDEX IF NOT EXISTS idx_spaces_space_pool ON spaces(space_code, pool_id);
CREATE INDEX IF NOT EXISTS idx_spaces_type ON spaces(type);
CREATE INDEX IF NOT EXISTS idx_spaces_key ON spaces(key) WHERE key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pools_space_code ON pools(space_code);
CREATE INDEX IF NOT EXISTS idx_registry_code ON spaces_registry(code);

-- =============================================================================
-- 2. User roles (migration_user_roles.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('owner', 'player')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

CREATE TABLE IF NOT EXISTS space_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_code TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_space_admin UNIQUE (space_code, email)
);

CREATE INDEX IF NOT EXISTS idx_space_admins_space ON space_admins(space_code);
CREATE INDEX IF NOT EXISTS idx_space_admins_user ON space_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_space_admins_email ON space_admins(email);

ALTER TABLE spaces_registry
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- =============================================================================
-- 3. Private spaces (migration_private_spaces.sql)
-- =============================================================================

ALTER TABLE spaces_registry
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS user_space_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_space_access UNIQUE (user_id, space_code)
);

CREATE INDEX IF NOT EXISTS idx_user_space_access_user ON user_space_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_space_access_space ON user_space_access(space_code);

-- =============================================================================
-- 4. Update function
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_spaces_updated_at ON spaces;
CREATE TRIGGER update_spaces_updated_at
  BEFORE UPDATE ON spaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pools_updated_at ON pools;
CREATE TRIGGER update_pools_updated_at
  BEFORE UPDATE ON pools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_registry_updated_at ON spaces_registry;
CREATE TRIGGER update_registry_updated_at
  BEFORE UPDATE ON spaces_registry FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_space_admins_updated_at ON space_admins;
CREATE TRIGGER update_space_admins_updated_at
  BEFORE UPDATE ON space_admins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 5. Auto-create user profile on signup (fixes "Database error saving new user")
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'player')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Auto-accept admin invites for this email
  UPDATE public.space_admins
  SET user_id = NEW.id, accepted = TRUE
  WHERE email = NEW.email AND user_id IS NULL;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users (must run as superuser / service role)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 6. Private space RPCs
-- =============================================================================

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

-- Let invited users claim their pending admin invite when they visit the space
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

-- Fix existing meta rows: use '' instead of NULL for pool_id (PostgreSQL treats NULLs as distinct in unique constraints, breaking upsert)
UPDATE spaces SET pool_id = '' WHERE type = 'meta' AND pool_id IS NULL;

-- =============================================================================
-- 7. Row Level Security
-- =============================================================================

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_space_access ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running (avoids conflicts)
DROP POLICY IF EXISTS "Anyone can read spaces" ON spaces;
DROP POLICY IF EXISTS "Anyone can modify spaces" ON spaces;
DROP POLICY IF EXISTS "Anyone can read pools" ON pools;
DROP POLICY IF EXISTS "Anyone can modify pools" ON pools;
DROP POLICY IF EXISTS "Anyone can read registry" ON spaces_registry;
DROP POLICY IF EXISTS "Anyone can modify registry" ON spaces_registry;
DROP POLICY IF EXISTS "Anyone can read user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can read space admins" ON space_admins;
DROP POLICY IF EXISTS "Owners can insert space admins" ON space_admins;
DROP POLICY IF EXISTS "Owners can update space admins" ON space_admins;
DROP POLICY IF EXISTS "Owners can delete space admins" ON space_admins;
DROP POLICY IF EXISTS "Users can read own space access" ON user_space_access;
DROP POLICY IF EXISTS "Users can insert own space access" ON user_space_access;
DROP POLICY IF EXISTS "Users can delete own space access" ON user_space_access;

CREATE POLICY "Anyone can read spaces" ON spaces FOR SELECT USING (true);
CREATE POLICY "Anyone can modify spaces" ON spaces FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can read pools" ON pools FOR SELECT USING (true);
CREATE POLICY "Anyone can modify pools" ON pools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can read registry" ON spaces_registry FOR SELECT USING (true);
CREATE POLICY "Anyone can modify registry" ON spaces_registry FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can read user profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Anyone can read space admins" ON space_admins FOR SELECT USING (true);
CREATE POLICY "Owners can insert space admins" ON space_admins FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'owner')
    OR EXISTS (SELECT 1 FROM space_admins sa WHERE sa.space_code = space_admins.space_code AND sa.user_id = auth.uid() AND sa.role = 'owner')
  )
);
CREATE POLICY "Owners can update space admins" ON space_admins FOR UPDATE USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM space_admins sa WHERE sa.space_code = space_admins.space_code AND sa.user_id = auth.uid() AND sa.role = 'owner'
  )
);
CREATE POLICY "Owners can delete space admins" ON space_admins FOR DELETE USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM space_admins sa WHERE sa.space_code = space_admins.space_code AND sa.user_id = auth.uid() AND sa.role = 'owner'
  )
);

CREATE POLICY "Users can read own space access" ON user_space_access FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own space access" ON user_space_access FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own space access" ON user_space_access FOR DELETE USING (auth.uid() = user_id);
