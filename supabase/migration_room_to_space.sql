-- Migration: Rename room to space in database
-- Run this AFTER creating the new schema to migrate existing data

-- Step 1: Create new tables (if they don't exist from schema.sql)
-- Note: Run schema.sql first, then this migration

-- Step 2: Migrate data from old tables to new tables
-- Migrate rooms_registry to spaces_registry
INSERT INTO spaces_registry (code, admin_name, created_at, updated_at)
SELECT code, admin_name, created_at, updated_at
FROM rooms_registry
ON CONFLICT (code) DO NOTHING;

-- Migrate rooms to spaces
INSERT INTO spaces (space_code, pool_id, type, value, created_at, updated_at, key)
SELECT room_code, board_id, type, value, created_at, updated_at, key
FROM rooms
ON CONFLICT (space_code, pool_id, type) DO NOTHING;

-- Step 3: Extract pools from space meta and create pool records
-- This extracts pools from the 'meta' type rows
INSERT INTO pools (space_code, name, archived, created_at, updated_at)
SELECT DISTINCT
  space_code,
  (value->>'name')::TEXT as name,
  COALESCE((value->>'archived')::BOOLEAN, false) as archived,
  COALESCE(
    to_timestamp((value->>'createdAt')::BIGINT / 1000),
    NOW()
  ) as created_at,
  NOW() as updated_at
FROM spaces
WHERE type = 'meta'
  AND value->'pools' IS NOT NULL
  AND jsonb_array_length(value->'pools') > 0
  AND value->'pools' != '[]'::jsonb
ON CONFLICT (space_code, name) DO NOTHING;

-- Alternative: If pools are stored differently, you may need to adjust the extraction logic
-- For example, if pools are in a different structure, modify the JSON path above

-- Step 4: (Optional) Drop old tables after verifying migration
WARNING: Only do this after verifying all data migrated correctly!
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS rooms_registry;

Step 5: Verify migration
Check that all data was migrated:
SELECT COUNT(*) FROM spaces_registry;
SELECT COUNT(*) FROM spaces;
SELECT COUNT(*) FROM pools;
