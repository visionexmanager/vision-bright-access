-- whatsapp_link_request: decide the send window by the window, not by comparing timestamps.
--
-- The original compared `_window = _now` to learn whether a new window had started. When two
-- calls land in the same clock tick (coarse clocks, e.g. Windows) the stored window start equals
-- the new now(), so a running window looked fresh and the hourly count reset to zero. Same
-- signature, same grants, same behaviour otherwise; CREATE OR REPLACE keeps the grants.

CREATE OR REPLACE FUNCTION public.whatsapp_link_request(
  _wa_phone      text,
  _email         text,
  _code_hash     text,
  _ttl_minutes   integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now         timestamptz := now();
  _clean_email text := lower(btrim(coalesce(_email, '')));
  _row         public.whatsapp_identities%ROWTYPE;
  _target      uuid;
  _window      timestamptz;
  _sends       smallint;
BEGIN
  IF _wa_phone IS NULL OR btrim(_wa_phone) = '' THEN
    RAISE EXCEPTION 'wa_phone is required';
  END IF;
  IF _clean_email = '' OR _code_hash IS NULL OR btrim(_code_hash) = '' THEN
    RAISE EXCEPTION 'email and code hash are required';
  END IF;
  IF _ttl_minutes < 1 OR _ttl_minutes > 60 THEN
    RAISE EXCEPTION 'code lifetime must be between 1 and 60 minutes, got %', _ttl_minutes;
  END IF;

  SELECT * INTO _row FROM public.whatsapp_identities WHERE wa_phone = _wa_phone FOR UPDATE;

  IF FOUND AND _row.user_id IS NOT NULL THEN
    -- Already linked. Re-linking is allowed — a person may move their account —
    -- but it is an explicit unlink first, not a silent overwrite by whoever
    -- sends the next email address.
    RETURN jsonb_build_object('status', 'already_linked', 'deliver', false);
  END IF;

  -- One code a minute, whatever the outcome of the last one.
  IF FOUND AND _row.last_sent_at IS NOT NULL AND _row.last_sent_at > _now - interval '60 seconds' THEN
    RETURN jsonb_build_object('status', 'cooldown', 'deliver', false);
  END IF;

  _window := CASE
    WHEN FOUND AND _row.window_started_at IS NOT NULL AND _row.window_started_at > _now - interval '1 hour'
      THEN _row.window_started_at
    ELSE _now
  END;
  -- Decided by the window itself, never by comparing timestamps: two calls in one clock tick
  -- (the clock can be coarse) would look like a fresh window and reset the count.
  _sends := CASE WHEN FOUND AND _row.window_started_at IS NOT NULL AND _row.window_started_at > _now - interval '1 hour'
                 THEN coalesce(_row.sends_in_window, 0) ELSE 0 END;

  IF _sends >= 5 THEN
    RETURN jsonb_build_object('status', 'throttled', 'deliver', false);
  END IF;

  -- Somebody else's mailbox is not a place to deliver five codes an hour from
  -- five different phone numbers. Counted across the whole table, not this row.
  IF (
    SELECT count(*) FROM public.whatsapp_identities
    WHERE pending_email = _clean_email
      AND wa_phone <> _wa_phone
      AND last_sent_at > _now - interval '1 hour'
  ) >= 3 THEN
    RETURN jsonb_build_object('status', 'throttled', 'deliver', false);
  END IF;

  -- The lookup that decides whether an email goes out. `email_confirmed_at`
  -- matters: an address that was never confirmed is an address nobody has
  -- proved they own, and linking a real mailbox to an account claiming it would
  -- put the sender inside a stranger's order history.
  SELECT id INTO _target
  FROM auth.users
  WHERE lower(email) = _clean_email
    AND email_confirmed_at IS NOT NULL
  LIMIT 1;

  -- The row is written either way, with identical timing and identical
  -- throttles. A number that asks about ten addresses is rate-limited exactly
  -- as one that asks about its own, and learns nothing from either.
  INSERT INTO public.whatsapp_identities AS i (
    wa_phone, pending_user_id, pending_email, code_hash, code_expires_at,
    attempts, last_sent_at, sends_in_window, window_started_at, updated_at
  ) VALUES (
    _wa_phone, _target, _clean_email, _code_hash, _now + make_interval(mins => _ttl_minutes),
    0, _now, (_sends + 1)::smallint, _window, _now
  )
  ON CONFLICT (wa_phone) DO UPDATE SET
    pending_user_id   = EXCLUDED.pending_user_id,
    pending_email     = EXCLUDED.pending_email,
    code_hash         = EXCLUDED.code_hash,
    code_expires_at   = EXCLUDED.code_expires_at,
    attempts          = 0,
    last_sent_at      = EXCLUDED.last_sent_at,
    sends_in_window   = EXCLUDED.sends_in_window,
    window_started_at = EXCLUDED.window_started_at,
    updated_at        = EXCLUDED.updated_at
  WHERE i.user_id IS NULL;

  RETURN jsonb_build_object('status', 'sent', 'deliver', _target IS NOT NULL);
END;
$$;
