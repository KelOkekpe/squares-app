-- Migration: Fix unique constraint on rooms table
-- Run this in your Supabase SQL Editor if you already created the table with the wrong constraint
-- This fixes the 409 Conflict error when saving data

-- Step 1: Drop the incorrect unique constraint on room_code alone
-- This constraint prevents multiple rows with the same room_code (which we need!)
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_code_key;

-- Step 2: Ensure the composite unique constraint exists
-- This allows multiple rows per room_code, but unique per (room_code, board_id, type) combination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_room_board_type'
  ) THEN
    ALTER TABLE rooms ADD CONSTRAINT unique_room_board_type 
      UNIQUE (room_code, board_id, type);
  END IF;
END $$;

-- Verify: After running this, you should be able to have multiple rows with the same room_code
-- but different board_id/type combinations
