-- Football Squares App - Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Spaces table: stores space-level data (board data, admin config, etc.)
CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_code TEXT NOT NULL,
  pool_id TEXT,
  type TEXT NOT NULL, -- 'board', 'admin', 'participants', 'scores', 'headers'
  value JSONB NOT NULL,
  key TEXT, -- Optional key column for backward compatibility with localStorage keys
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_space_pool_type UNIQUE (space_code, pool_id, type)
);

-- Pools table: stores pool metadata (name, archived status, etc.)
CREATE TABLE IF NOT EXISTS pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_code TEXT NOT NULL,
  name TEXT NOT NULL,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_pool_name_per_space UNIQUE (space_code, name)
);

-- Spaces registry: global list of all spaces
CREATE TABLE IF NOT EXISTS spaces_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  admin_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_spaces_space_code ON spaces(space_code);
CREATE INDEX IF NOT EXISTS idx_spaces_space_pool ON spaces(space_code, pool_id);
CREATE INDEX IF NOT EXISTS idx_spaces_type ON spaces(type);
CREATE INDEX IF NOT EXISTS idx_spaces_updated ON spaces(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_spaces_key ON spaces(key);

CREATE INDEX IF NOT EXISTS idx_pools_space_code ON pools(space_code);
CREATE INDEX IF NOT EXISTS idx_pools_name ON pools(name);
CREATE INDEX IF NOT EXISTS idx_pools_archived ON pools(archived);
CREATE INDEX IF NOT EXISTS idx_pools_updated ON pools(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_registry_code ON spaces_registry(code);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pools_updated_at
  BEFORE UPDATE ON pools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registry_updated_at
  BEFORE UPDATE ON spaces_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Enable RLS
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces_registry ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read spaces (public data)
CREATE POLICY "Anyone can read spaces"
  ON spaces FOR SELECT
  USING (true);

-- Policy: Anyone can insert/update spaces (for now - you may want to add auth later)
CREATE POLICY "Anyone can modify spaces"
  ON spaces FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Anyone can read pools
CREATE POLICY "Anyone can read pools"
  ON pools FOR SELECT
  USING (true);

-- Policy: Anyone can modify pools
CREATE POLICY "Anyone can modify pools"
  ON pools FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Anyone can read registry
CREATE POLICY "Anyone can read registry"
  ON spaces_registry FOR SELECT
  USING (true);

-- Policy: Anyone can modify registry
CREATE POLICY "Anyone can modify registry"
  ON spaces_registry FOR ALL
  USING (true)
  WITH CHECK (true);
