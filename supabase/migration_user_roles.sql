-- Migration: User Roles System
-- Run this in your Supabase SQL Editor AFTER the base schema.sql

-- ============================================================
-- 1. User profiles table (extends Supabase auth.users)
-- ============================================================
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

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. Space admins table (owners can invite admins to their spaces)
-- ============================================================
CREATE TABLE IF NOT EXISTS space_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_code TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,  -- Used for invites before user registers
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

CREATE TRIGGER update_space_admins_updated_at
  BEFORE UPDATE ON space_admins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. Add owner_id to spaces_registry
-- ============================================================
ALTER TABLE spaces_registry
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- 4. RLS Policies
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_admins ENABLE ROW LEVEL SECURITY;

-- User profiles: users can read all profiles but only update their own
CREATE POLICY "Anyone can read user profiles"
  ON user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Space admins: owners can manage, admins can read their own
CREATE POLICY "Anyone can read space admins"
  ON space_admins FOR SELECT
  USING (true);

CREATE POLICY "Owners can insert space admins"
  ON space_admins FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- User is an owner (global role)
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'owner')
      -- OR user is the owner of this specific space
      OR EXISTS (SELECT 1 FROM space_admins WHERE space_code = space_admins.space_code AND user_id = auth.uid() AND role = 'owner')
    )
  );

CREATE POLICY "Owners can update space admins"
  ON space_admins FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM space_admins sa
      WHERE sa.space_code = space_admins.space_code
        AND sa.user_id = auth.uid()
        AND sa.role = 'owner'
    )
  );

CREATE POLICY "Owners can delete space admins"
  ON space_admins FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM space_admins sa
      WHERE sa.space_code = space_admins.space_code
        AND sa.user_id = auth.uid()
        AND sa.role = 'owner'
    )
  );

-- ============================================================
-- 5. Function: auto-create user profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'player')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- If the user was invited as an admin, auto-accept the invitation
  UPDATE space_admins
  SET user_id = NEW.id, accepted = TRUE
  WHERE email = NEW.email AND user_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
