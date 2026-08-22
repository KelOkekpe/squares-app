-- Migration: Pick'em contests alongside squares boards
-- Run in the Supabase SQL Editor AFTER migration_fix_superadmin_grants.sql
--
-- A pool is now one of two game types. Reusing pools rather than adding a
-- parallel table means pick'em contests inherit everything already built
-- around boards: the 16-active cap, expiry, billing, Past Boards, the picker.

ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'squares';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pools_game_type_check'
  ) THEN
    ALTER TABLE pools ADD CONSTRAINT pools_game_type_check
      CHECK (game_type IN ('squares', 'pickem'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pools_game_type ON pools(space_code, game_type);

-- ============================================================
-- Submitting a sheet
--
-- Same shape as submit_entry_request and for the same reason: players are
-- anonymous and have no write access to `spaces`, so this is the only way a
-- sheet reaches the database. The lock time comes from the stored slate, not
-- from the client — a player can't reopen a closed week by lying about it.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_picks(
  p_space_code TEXT,
  p_pool_id TEXT,
  p_name TEXT,
  p_picks JSONB,
  p_tiebreak INT,
  p_contact JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_slate JSONB;
  v_existing JSONB;
  v_entry JSONB;
  v_email TEXT;
  v_phone TEXT;
  v_hash TEXT;
  v_lock TIMESTAMPTZ;
  v_recent INT;
  v_games INT;
BEGIN
  IF coalesce(trim(p_space_code), '') = '' OR coalesce(trim(p_pool_id), '') = '' THEN
    RAISE EXCEPTION 'space and contest are required';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN RAISE EXCEPTION 'Name is required'; END IF;

  v_email := lower(trim(coalesce(p_contact ->> 'email', '')));
  v_phone := trim(coalesce(p_contact ->> 'phone', ''));
  IF v_email = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'That email address does not look valid';
  END IF;
  IF v_phone = '' THEN RAISE EXCEPTION 'Phone number is required'; END IF;
  IF p_tiebreak IS NULL OR p_tiebreak < 0 OR p_tiebreak > 200 THEN
    RAISE EXCEPTION 'Enter a tiebreaker total between 0 and 200';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pools
     WHERE id::text = p_pool_id AND space_code = p_space_code AND paid AND game_type = 'pickem'
  ) THEN
    RAISE EXCEPTION 'This contest is not active yet. Ask your admin to finish setting it up.';
  END IF;

  SELECT value INTO v_slate FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'slate';
  IF v_slate IS NULL THEN RAISE EXCEPTION 'This contest has no games yet'; END IF;

  -- Every game must be picked, so a partial sheet can't quietly score lower
  SELECT count(*) INTO v_games FROM jsonb_array_elements(v_slate -> 'games');
  IF (SELECT count(*) FROM jsonb_object_keys(p_picks)) < v_games THEN
    RAISE EXCEPTION 'Pick a winner in every game';
  END IF;

  -- Picks close at the first kickoff of the week, read from the slate itself
  SELECT min((g ->> 'startsAt')::timestamptz) INTO v_lock
    FROM jsonb_array_elements(v_slate -> 'games') g;
  IF v_lock IS NOT NULL AND now() >= v_lock THEN
    RAISE EXCEPTION 'Picks are closed for this week';
  END IF;

  v_hash := md5(v_email);
  DELETE FROM entry_request_log WHERE created_at < now() - interval '1 day';
  SELECT count(*) INTO v_recent FROM entry_request_log
   WHERE email_hash = v_hash AND created_at > now() - interval '1 hour';
  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'Too many submissions from this email address. Try again in an hour.';
  END IF;

  SELECT value INTO v_existing FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'picks';

  IF coalesce(jsonb_array_length(v_existing), 0) >= 500 THEN
    RAISE EXCEPTION 'This contest is full';
  END IF;

  v_entry := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', left(trim(p_name), 80),
    'email', v_email,
    'phone', left(v_phone, 32),
    'picks', p_picks,
    'tiebreak', p_tiebreak,
    'paid', false,
    'submittedAt', (extract(epoch FROM now()) * 1000)::bigint
  );

  -- One sheet per email: a resubmission replaces the previous one rather than
  -- stacking, which would otherwise let someone cover every outcome.
  v_existing := coalesce(v_existing, '[]'::jsonb);
  SELECT coalesce(jsonb_agg(e), '[]'::jsonb) INTO v_existing
    FROM jsonb_array_elements(v_existing) e
   WHERE lower(e ->> 'email') <> v_email;

  INSERT INTO spaces (key, space_code, pool_id, type, value, updated_at)
  VALUES ('fb-' || p_space_code || '-' || p_pool_id || '-picks',
          p_space_code, p_pool_id, 'picks', jsonb_build_array(v_entry), now())
  ON CONFLICT (space_code, pool_id, type)
  DO UPDATE SET value = v_existing || v_entry, updated_at = now();

  INSERT INTO entry_request_log (space_code, pool_id, email_hash)
  VALUES (p_space_code, p_pool_id, v_hash);

  RETURN v_entry;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_picks(TEXT, TEXT, TEXT, JSONB, INT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_picks(TEXT, TEXT, TEXT, JSONB, INT, JSONB)
  TO anon, authenticated;

-- Verify:
--   SELECT space_code, name, game_type, paid FROM pools ORDER BY created_at;
