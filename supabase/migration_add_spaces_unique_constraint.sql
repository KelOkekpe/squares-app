-- Migration: Add unique constraint on spaces for upsert support
-- Run this in Supabase SQL Editor if you get:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification" (42P10)
--
-- The app now uses select-then-update-or-insert and works without this constraint.
-- Adding it improves atomicity and prevents duplicate rows.

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
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Duplicate rows exist - resolve them before adding the constraint.';
END $$;
