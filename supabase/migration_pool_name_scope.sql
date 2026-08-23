-- Migration: board names are unique among LIVE boards only
-- Run in the Supabase SQL Editor AFTER migration_board_deletion.sql
--
-- `unique_pool_name_per_space UNIQUE (space_code, name)` covered every row in
-- the table, so a board that had been archived and then deleted still owned its
-- name. Creating this season's "Week 2 Pick'em" failed against last season's,
-- which the admin can neither see nor reach — the only fix on offer was to
-- invent a different name.
--
-- Uniqueness now applies only to boards that are actually in play. An archived
-- board is finished with, a deleted one is on its way out, and neither should
-- reserve a name.
--
-- The trade: Past Boards can now hold two boards with the same name. They are
-- distinguished by their dates there. The alternative — keeping names reserved
-- by boards nobody can see — is worse.

ALTER TABLE pools DROP CONSTRAINT IF EXISTS unique_pool_name_per_space;

-- Partial index. Existing rows can't violate it: the constraint it replaces was
-- strictly stronger, so anything that satisfied that satisfies this.
DROP INDEX IF EXISTS unique_pool_name_per_space;

CREATE UNIQUE INDEX unique_pool_name_per_space
  ON pools (space_code, name)
  WHERE deleted_at IS NULL AND NOT coalesce(archived, false);

COMMENT ON INDEX unique_pool_name_per_space IS
  'Board names are unique among live boards only — archived and soft-deleted boards release their name.';

-- Verify:
--   -- names in use, and the ones now freed up
--   SELECT space_code, name,
--          count(*) FILTER (WHERE deleted_at IS NULL AND NOT coalesce(archived,false)) AS live,
--          count(*) AS total
--     FROM pools GROUP BY space_code, name HAVING count(*) > 1 ORDER BY space_code, name;
