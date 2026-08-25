-- Migration: a paid pick'em entry has to be confirmed before it counts
-- Run in the Supabase SQL Editor AFTER migration_pickem_ref.sql
--
-- Squares entries already work this way: a request lands in a queue and only
-- reaches the board once an admin confirms the money arrived. Pick'em sheets
-- went straight into the standings, so anyone could submit and appear to be
-- winning without paying.
--
-- The sheet itself is still recorded immediately, and that is deliberate — the
-- picks have to be locked in before kickoff, and holding them in a queue until
-- an admin happened to look would mean losing them. What waits is whether the
-- sheet *counts*.
--
-- A contest with no entry fee has nothing to confirm, so those are marked paid
-- on arrival. The fee is read from the board's own config rather than taken
-- from the request: a client that could name its own fee could mark itself
-- paid.

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
  v_fee NUMERIC;
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

  -- The entry fee decides whether this sheet needs confirming, and it is read
  -- here rather than taken from the caller: a client that could set its own fee
  -- to zero could mark itself paid.
  SELECT coalesce((value ->> 'entryFee')::numeric, 0) INTO v_fee FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'admin';
  v_fee := coalesce(v_fee, 0);
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
    -- A free contest has nothing to confirm, so it counts immediately. One
    -- that charges waits for an admin.
    'paid', (v_fee <= 0),
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

-- Existing sheets predate the gate. They were submitted when nothing was being
-- confirmed, so holding them back now would silently drop people out of
-- standings they are already in.
UPDATE spaces s
   SET value = (
         SELECT coalesce(jsonb_agg(
                  CASE WHEN e ? 'paid' THEN e
                       ELSE e || jsonb_build_object('paid', true) END ORDER BY ord), '[]'::jsonb)
           FROM jsonb_array_elements(s.value) WITH ORDINALITY AS t(e, ord)
       ),
       updated_at = now()
 WHERE s.type = 'picks'
   AND jsonb_typeof(s.value) = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.value) e WHERE NOT (e ? 'paid'));

-- Verify:
--   SELECT s.space_code, e ->> 'name' AS who, e ->> 'paid' AS counts
--     FROM spaces s CROSS JOIN LATERAL jsonb_array_elements(s.value) e
--    WHERE s.type = 'picks';
