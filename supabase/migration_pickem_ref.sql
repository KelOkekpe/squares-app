-- Migration: pick'em entries carry a payment reference
-- Run in the Supabase SQL Editor AFTER migration_pickem_payout.sql
--
-- A squares entry already gets a short reference the player puts in their
-- payment note, so the admin can match a Venmo notification to a person. A
-- pick'em entry had none, which left an admin looking at a list of payments and
-- a list of sheets with nothing joining them.
--
-- It goes in pickem_contacts rather than the picks blob for the same reason the
-- email does: the blob is what every player reads through list_picks, and one
-- player should not be able to quote another's reference.

ALTER TABLE public.pickem_contacts
  ADD COLUMN IF NOT EXISTS payment_ref TEXT;

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
  IF v_email = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'That email address does not look valid';
  END IF;
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
    'emailHash', v_hash,
    'picks', p_picks,
    'tiebreak', p_tiebreak,
    'paid', false,
    'submittedAt', (extract(epoch FROM now()) * 1000)::bigint
  );

  -- One sheet per email: a resubmission replaces the previous one rather than
  -- stacking, which would otherwise let someone cover every outcome. Matched on
  -- the hash now that the address itself isn't here.
  v_existing := coalesce(v_existing, '[]'::jsonb);
  SELECT coalesce(jsonb_agg(e), '[]'::jsonb) INTO v_existing
    FROM jsonb_array_elements(v_existing) e
   WHERE coalesce(e ->> 'emailHash', '') <> v_hash;

  INSERT INTO spaces (key, space_code, pool_id, type, value, updated_at)
  VALUES ('fb-' || p_space_code || '-' || p_pool_id || '-picks',
          p_space_code, p_pool_id, 'picks', jsonb_build_array(v_entry), now())
  ON CONFLICT (space_code, pool_id, type)
  DO UPDATE SET value = v_existing || v_entry, updated_at = now();

  -- The replaced sheet's contact row goes with it, then the new one lands.
  DELETE FROM public.pickem_contacts
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND email = v_email;

  INSERT INTO public.pickem_contacts
    (space_code, pool_id, entry_id, email, payout_method, payout_handles, payment_ref)
  VALUES (p_space_code, p_pool_id, v_entry ->> 'id', v_email,
          nullif(trim(coalesce(p_contact ->> 'payoutMethod', '')), ''),
          CASE WHEN jsonb_typeof(p_contact -> 'payoutHandles') = 'object'
               THEN p_contact -> 'payoutHandles' END,
          -- Same shape the squares flow uses: unambiguous alphabet, capped.
          nullif(upper(left(regexp_replace(coalesce(p_contact ->> 'paymentRef', ''),
                                           '[^A-Za-z0-9]', '', 'g'), 12)), ''));

  INSERT INTO entry_request_log (space_code, pool_id, email_hash)
  VALUES (p_space_code, p_pool_id, v_hash);

  RETURN v_entry - 'emailHash';
END;
$$;
DO $$
DECLARE fn TEXT;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'submit_picks'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO anon, authenticated', fn);
  END LOOP;
END $$;

-- Verify:
--   SELECT entry_id, email, payment_ref FROM pickem_contacts ORDER BY created_at DESC;
--   -- should be 0: the reference is not in the blob players can read
--   SELECT count(*) FROM spaces s CROSS JOIN LATERAL jsonb_array_elements(s.value) e
--    WHERE s.type = 'picks' AND e ? 'paymentRef';
