-- Migration: Carry the payment reference onto the entry
-- Run in the Supabase SQL Editor AFTER migration_billing.sql
--
-- Players now pay through a prefilled deep link into the organiser's own
-- payment app, and the note carries a short reference. Storing that reference
-- on the entry is what lets an admin match a Venmo line to a queue row instead
-- of guessing from name and amount.
--
-- ⚠️ This is the THIRD file to define submit_entry_request. This one is live;
-- the copies in migration_entry_contact.sql and migration_billing.sql are
-- historical. Only the paymentRef field is new here.

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
  v_email TEXT; v_phone TEXT; v_hash TEXT;
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
  v_phone := trim(coalesce(p_contact ->> 'phone', ''));
  IF v_email = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'That email address does not look valid';
  END IF;
  IF v_phone = '' THEN RAISE EXCEPTION 'Phone number is required'; END IF;
  IF length(regexp_replace(v_phone, '\D', '', 'g')) < 7 THEN
    RAISE EXCEPTION 'That phone number does not look valid';
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
    'phone', left(v_phone, 32),
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

GRANT EXECUTE ON FUNCTION public.submit_entry_request(TEXT, TEXT, TEXT, NUMERIC, INT, JSONB)
  TO anon, authenticated;
