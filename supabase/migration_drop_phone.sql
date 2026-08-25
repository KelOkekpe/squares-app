-- Migration: stop collecting phone numbers
-- Run in the Supabase SQL Editor AFTER migration_alpha_cap.sql
--
-- Phone numbers were required from every entrant and every pick'em player, and
-- never used for anything. The only plausible use was SMS, and that turns out
-- to be a bad trade: US carriers block unregistered A2P traffic, gambling is a
-- rejection category for the registration that would unblock it, and the app
-- never asked for consent to text anyone — no disclosure, no STOP handling.
-- Texting numbers collected that way is a TCPA problem, so the numbers had no
-- future.
--
-- That leaves a required field whose only effect was to hold personal data we
-- had just finished moving into admin-only tables. Cheaper to not have it.
--
-- Existing numbers are dropped, not orphaned. A column nobody reads is still a
-- column somebody can leak.

-- ============================================================
-- 1. Stop requiring it on the way in
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_entry_request(
  p_space_code TEXT,
  p_pool_id TEXT,
  p_name TEXT,
  p_amount NUMERIC,
  p_squares INT,
  p_contact JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_entry JSONB; v_config JSONB; v_existing JSONB;
  v_email TEXT; v_hash TEXT;
  v_recent_email INT; v_recent_space INT;
  v_limit_email CONSTANT INT := 5;
  v_limit_space CONSTANT INT := 120;
BEGIN
  IF coalesce(trim(p_space_code), '') = '' OR coalesce(trim(p_pool_id), '') = '' THEN
    RAISE EXCEPTION 'space and pool are required';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF p_squares IS NULL OR p_squares < 1 OR p_squares > 100 THEN
    RAISE EXCEPTION 'square count must be between 1 and 100';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  v_email := lower(trim(coalesce(p_contact ->> 'email', '')));
  IF v_email = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'That email address does not look valid';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM spaces_registry WHERE code = p_space_code) THEN
    RAISE EXCEPTION 'no such space';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pools WHERE id::text = p_pool_id AND space_code = p_space_code AND paid
  ) THEN
    RAISE EXCEPTION 'This board is not active yet. Ask your admin to finish setting it up.';
  END IF;

  v_hash := md5(v_email);
  DELETE FROM entry_request_log WHERE created_at < now() - interval '1 day';

  SELECT count(*) INTO v_recent_email FROM entry_request_log
   WHERE email_hash = v_hash AND created_at > now() - interval '1 hour';
  IF v_recent_email >= v_limit_email THEN
    RAISE EXCEPTION 'Too many requests from this email address. Try again in an hour.';
  END IF;

  SELECT count(*) INTO v_recent_space FROM entry_request_log
   WHERE space_code = p_space_code AND created_at > now() - interval '1 hour';
  IF v_recent_space >= v_limit_space THEN
    RAISE EXCEPTION 'This space is receiving too many requests right now. Try again shortly.';
  END IF;

  SELECT value INTO v_config FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'admin';
  IF coalesce((v_config ->> 'submissionsDisabled')::boolean, false) THEN
    RAISE EXCEPTION 'submissions are closed for this pool';
  END IF;

  SELECT value INTO v_existing FROM spaces
   WHERE space_code = p_space_code AND pool_id = p_pool_id AND type = 'pending';
  IF coalesce(jsonb_array_length(v_existing), 0) >= 500 THEN
    RAISE EXCEPTION 'too many pending requests — ask an admin to clear the queue';
  END IF;

  v_entry := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', left(trim(p_name), 80),
    'firstName', left(trim(coalesce(p_contact ->> 'firstName', '')), 40),
    'middleInitial', upper(left(regexp_replace(coalesce(p_contact ->> 'middleInitial', ''), '[^A-Za-z]', '', 'g'), 1)),
    'lastName', left(trim(coalesce(p_contact ->> 'lastName', '')), 40),
    'email', v_email,
    -- NEW: matches the reference in the payment note
    'paymentRef', upper(left(regexp_replace(coalesce(p_contact ->> 'paymentRef', ''), '[^A-Za-z0-9]', '', 'g'), 12)),
    'payoutMethod', nullif(trim(coalesce(p_contact ->> 'payoutMethod', '')), ''),
    'payoutHandles', coalesce(p_contact -> 'payoutHandles', '{}'::jsonb),
    'amount', p_amount,
    'squares', p_squares,
    'requestedAt', (extract(epoch FROM now()) * 1000)::bigint
  );

  INSERT INTO spaces (key, space_code, pool_id, type, value, updated_at)
  VALUES ('fb-' || p_space_code || '-' || p_pool_id || '-pending',
          p_space_code, p_pool_id, 'pending', jsonb_build_array(v_entry), now())
  ON CONFLICT (space_code, pool_id, type)
  DO UPDATE SET value = coalesce(spaces.value, '[]'::jsonb) || v_entry, updated_at = now();

  INSERT INTO entry_request_log (space_code, pool_id, email_hash)
  VALUES (p_space_code, p_pool_id, v_hash);

  RETURN v_entry;
END;
$$;
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

  INSERT INTO public.pickem_contacts (space_code, pool_id, entry_id, email)
  VALUES (p_space_code, p_pool_id, v_entry ->> 'id', v_email);

  INSERT INTO entry_request_log (space_code, pool_id, email_hash)
  VALUES (p_space_code, p_pool_id, v_hash);

  RETURN v_entry - 'emailHash';
END;
$$;
-- ============================================================
-- 2. Forget the ones already stored
--
-- Including the pending queue, whose entries carry their own copy — those are
-- live rows an admin is still working through, so the field is stripped rather
-- than the row being touched.
-- ============================================================
ALTER TABLE public.entry_contacts  DROP COLUMN IF EXISTS phone;
ALTER TABLE public.pickem_contacts DROP COLUMN IF EXISTS phone;

UPDATE spaces s
   SET value = (
         SELECT coalesce(jsonb_agg(e - 'phone' ORDER BY ord), '[]'::jsonb)
           FROM jsonb_array_elements(s.value) WITH ORDINALITY AS t(e, ord)
       ),
       updated_at = now()
 WHERE s.type IN ('pending', 'participants', 'picks')
   AND jsonb_typeof(s.value) = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.value) e WHERE e ? 'phone');

-- Grants are unchanged in principle — same names, same signatures — but they
-- are re-stated because CREATE OR REPLACE only preserves them while the
-- signature matches exactly.
--
-- Signatures are read back from pg_proc rather than typed out. Writing them by
-- hand is how the superadmin grants silently went missing once before, and the
-- first draft of this file made the same mistake: submit_entry_request takes
-- (amount NUMERIC, squares INT), not the reverse, so a hand-written signature
-- referred to a function that does not exist.
DO $$
DECLARE fn TEXT;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('submit_entry_request', 'submit_picks')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO anon, authenticated', fn);
  END LOOP;
END $$;

-- Verify:
--   -- should be 0: no phone left anywhere
--   SELECT count(*) FROM spaces s CROSS JOIN LATERAL jsonb_array_elements(s.value) e
--    WHERE jsonb_typeof(s.value) = 'array' AND e ? 'phone';
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name IN ('entry_contacts','pickem_contacts') AND column_name = 'phone';
