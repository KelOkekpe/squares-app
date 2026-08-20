-- Migration: Board lifecycle — expiry dates and an active-board cap
-- Run in the Supabase SQL Editor AFTER migration_superadmin.sql
--
-- Boards accumulated indefinitely because nothing ever ended them. Every new
-- board now carries an expiry date, and a space can hold at most 16 active
-- boards at once. Expired and archived boards aren't deleted — they become
-- "completed" and stay readable.

ALTER TABLE pools ADD COLUMN IF NOT EXISTS expires_at DATE;

CREATE INDEX IF NOT EXISTS idx_pools_expires ON pools(expires_at);

COMMENT ON COLUMN pools.expires_at IS
  'Last day the board accepts entries. NULL only for boards created before this migration.';

-- A board is active while it is neither archived nor past its expiry date.
-- Existing boards have no expiry and stay active until archived.
CREATE OR REPLACE FUNCTION public.is_pool_active(p_archived BOOLEAN, p_expires DATE)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NOT coalesce(p_archived, false)
     AND (p_expires IS NULL OR p_expires >= current_date);
$$;

-- ============================================================
-- Enforcement lives here, not just in the UI: the cap and the required expiry
-- are both trivial to bypass from the client otherwise.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_pool_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_active INT;
  v_limit CONSTANT INT := 16;
BEGIN
  -- Required on creation only; pre-existing rows are grandfathered
  IF TG_OP = 'INSERT' AND NEW.expires_at IS NULL THEN
    RAISE EXCEPTION 'A board needs an expiry date';
  END IF;

  IF NEW.expires_at IS NOT NULL AND TG_OP = 'INSERT' AND NEW.expires_at < current_date THEN
    RAISE EXCEPTION 'Expiry date cannot be in the past';
  END IF;

  -- Only rows that would land in the active set count against the cap
  IF NOT public.is_pool_active(NEW.archived, NEW.expires_at) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_active
    FROM pools
   WHERE space_code = NEW.space_code
     AND id IS DISTINCT FROM NEW.id
     AND public.is_pool_active(archived, expires_at);

  IF v_active >= v_limit THEN
    RAISE EXCEPTION
      'This space already has % active boards (limit %). Archive one or let it expire first.',
      v_active, v_limit;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pools_enforce_limits ON pools;
CREATE TRIGGER pools_enforce_limits
  BEFORE INSERT OR UPDATE ON pools
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pool_limits();

-- Backfill: give existing boards a horizon so they don't sit active forever.
-- 90 days from their last activity, and never in the past.
UPDATE pools
   SET expires_at = greatest(current_date + 30, (coalesce(updated_at, created_at)::date + 90))
 WHERE expires_at IS NULL
   AND NOT coalesce(archived, false);

-- Archived boards get a nominal date so the column is uniformly populated
UPDATE pools
   SET expires_at = coalesce(updated_at, created_at)::date
 WHERE expires_at IS NULL;

-- Verify:
--   SELECT space_code, name, archived, expires_at,
--          public.is_pool_active(archived, expires_at) AS active
--     FROM pools ORDER BY space_code, created_at;
