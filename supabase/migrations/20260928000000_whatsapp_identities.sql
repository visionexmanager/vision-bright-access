-- ─── Linking a WhatsApp number to a Visionex account, by proof rather than by
-- ─── coincidence
--
-- Phase 14 (order tracking) has been blocked since the audit for one reason,
-- written down at the time and still true: the only phone number on an order is
-- `bazaar_orders.shipping_phone`, which is unverified free text the buyer typed
-- at checkout, is not unique, and is frequently *somebody else's* number — a
-- spouse, a colleague, a courier. Matching an inbound WhatsApp number against
-- it would disclose one person's order, address and email to whoever happens to
-- hold or spoof that number.
--
-- So nothing here matches on a phone number. This is the one-time-code link the
-- audit named as option 1:
--
--   1. The sender asks for their orders and is asked for their account email.
--   2. A six-digit code is emailed to that address — out of band, over a
--      channel the sender must already control.
--   3. They type it back into WhatsApp. Only then is `wa_phone` bound to a
--      `user_id`, and only that binding is ever used for a lookup.
--
-- The proof is control of the mailbox on the account, which is the same proof a
-- password reset uses. A phone number proves nothing and is used for nothing.
--
-- ── What this file deliberately does not do ─────────────────────────────────
--
-- * It never tells the caller whether an email has an account. `whatsapp_link_request`
--   returns the same shape either way; the only difference is an internal
--   `deliver` flag telling the webhook whether there is anywhere to send. The
--   sentence the sender reads is identical, so this cannot be used to enumerate
--   who has a Visionex account.
-- * It never stores a code. The webhook stores an HMAC of it (keyed with
--   `WHATSAPP_APP_SECRET`, which the function already requires to start at all),
--   so a service-role read of this table yields nothing that can be replayed.
-- * It never exposes an address, an email or a full order. `whatsapp_recent_orders`
--   returns status, date, totals and shop name — what "where is my order" means
--   — and no shipping detail at all.
--
-- ── Rate limits, and which attack each one answers ──────────────────────────
--
--   60 seconds between codes       one phone hammering send
--   5 requests per rolling hour    the same, slower
--   3 codes per email per hour     mailbox bombing somebody else's inbox from
--                                  several numbers
--   5 wrong codes, then dead       brute-forcing six digits (10^6 / 5 attempts
--                                  per emailed code makes guessing hopeless)
--   10 minute expiry               a code read over somebody's shoulder later
--
-- Additive and idempotent: no existing table is altered and every statement can
-- run twice.

CREATE TABLE IF NOT EXISTS public.whatsapp_identities (
  -- The number Meta signed, exactly as `whatsapp_conversations.wa_phone` holds
  -- it. Never typed by anybody: it arrives inside the signed webhook envelope.
  wa_phone          text PRIMARY KEY,

  -- Set only by `whatsapp_link_confirm`, and only against a correct code.
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at       timestamptz,

  -- The account a code was sent for. Resolved at request time so the confirm
  -- step never has to look at an email again — and so a mailbox that changes
  -- hands between the two steps cannot redirect the link.
  pending_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Lower-cased, and kept only to throttle repeat sends to one mailbox. Cleared
  -- the moment the link succeeds or is abandoned.
  pending_email     text,
  -- HMAC-SHA256 of the code. Never the code.
  code_hash         text,
  code_expires_at   timestamptz,
  attempts          smallint    NOT NULL DEFAULT 0,

  last_sent_at      timestamptz,
  sends_in_window   smallint    NOT NULL DEFAULT 0,
  window_started_at timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Verified means both, or neither. A `user_id` without a `verified_at` would be
-- a link nobody proved; a `verified_at` without a `user_id` would be a link to
-- nothing. The database refuses both rather than trusting every writer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.whatsapp_identities'::regclass
      AND conname = 'whatsapp_identities_verified_pair_check'
  ) THEN
    ALTER TABLE public.whatsapp_identities
      ADD CONSTRAINT whatsapp_identities_verified_pair_check
      CHECK ((user_id IS NULL) = (verified_at IS NULL));
  END IF;
END $$;

COMMENT ON TABLE public.whatsapp_identities IS
  'Verified binding between a WhatsApp number and a Visionex account, proved by a one-time code emailed to the account address. Service role only. No lookup anywhere keys on a phone number found on an order.';
COMMENT ON COLUMN public.whatsapp_identities.code_hash IS
  'HMAC-SHA256 of the one-time code, computed in the edge function with WHATSAPP_APP_SECRET. The code itself is never stored or logged.';
COMMENT ON COLUMN public.whatsapp_identities.pending_email IS
  'Lower-cased address a code was sent to, kept only for the per-mailbox send throttle. Cleared on success, on unlink, and when a link is abandoned.';

-- Both foreign keys want an index: an `ON DELETE CASCADE` and an
-- `ON DELETE SET NULL` each scan the child table when a user is deleted, and
-- `whatsapp_recent_orders` looks a row up by user besides. Partial, because the
-- overwhelming majority of rows have one of the two columns null.
CREATE INDEX IF NOT EXISTS whatsapp_identities_user_idx
  ON public.whatsapp_identities (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_identities_pending_user_idx
  ON public.whatsapp_identities (pending_user_id) WHERE pending_user_id IS NOT NULL;
-- The per-mailbox throttle's hot path: "how many codes went to this address in
-- the last hour", across every number that asked.
CREATE INDEX IF NOT EXISTS whatsapp_identities_pending_email_idx
  ON public.whatsapp_identities (pending_email, last_sent_at DESC) WHERE pending_email IS NOT NULL;

ALTER TABLE public.whatsapp_identities ENABLE ROW LEVEL SECURITY;

-- No policy, deliberately — the same decision every other `whatsapp_*` table
-- makes. The service role bypasses RLS; with RLS on and no policy, `anon` and
-- `authenticated` get nothing. A signed-in user reading which phone number is
-- bound to which account is not a feature this needs, and the absence of a
-- policy is what guarantees it cannot happen by accident later.

-- ── Requesting a code ───────────────────────────────────────────────────────
--
-- Returns jsonb rather than a scalar because the caller needs two independent
-- facts: what to tell the sender (`status`), and whether there is an account to
-- email at all (`deliver`). Only the first ever reaches WhatsApp.
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
  _sends := CASE WHEN _window = _now THEN 0 ELSE coalesce(_row.sends_in_window, 0) END;

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

COMMENT ON FUNCTION public.whatsapp_link_request(text, text, text, integer) IS
  'Records a one-time link code for a WhatsApp number and reports whether an account exists to email. Never discloses account existence to the sender: status is identical either way. Service role only.';

-- ── Confirming a code ───────────────────────────────────────────────────────
--
-- One word back, because the caller turns it into a sentence and nothing else.
-- 'invalid' covers both a wrong code and a code for an address with no account:
-- the two must be indistinguishable, or the confirm step becomes the enumeration
-- oracle the request step refuses to be.
CREATE OR REPLACE FUNCTION public.whatsapp_link_confirm(
  _wa_phone  text,
  _code_hash text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
  _row public.whatsapp_identities%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.whatsapp_identities WHERE wa_phone = _wa_phone FOR UPDATE;

  IF NOT FOUND OR _row.code_hash IS NULL THEN
    RETURN 'none';
  END IF;

  IF _row.code_expires_at IS NULL OR _row.code_expires_at < _now THEN
    UPDATE public.whatsapp_identities
    SET code_hash = NULL, code_expires_at = NULL, pending_user_id = NULL,
        pending_email = NULL, attempts = 0, updated_at = _now
    WHERE wa_phone = _wa_phone;
    RETURN 'expired';
  END IF;

  IF _row.attempts >= 5 THEN
    UPDATE public.whatsapp_identities
    SET code_hash = NULL, code_expires_at = NULL, pending_user_id = NULL,
        pending_email = NULL, updated_at = _now
    WHERE wa_phone = _wa_phone;
    RETURN 'locked';
  END IF;

  IF _row.code_hash <> _code_hash OR _row.pending_user_id IS NULL THEN
    UPDATE public.whatsapp_identities
    SET attempts = _row.attempts + 1, updated_at = _now
    WHERE wa_phone = _wa_phone;
    RETURN 'invalid';
  END IF;

  UPDATE public.whatsapp_identities
  SET user_id = _row.pending_user_id,
      verified_at = _now,
      pending_user_id = NULL,
      pending_email = NULL,
      code_hash = NULL,
      code_expires_at = NULL,
      attempts = 0,
      updated_at = _now
  WHERE wa_phone = _wa_phone;

  RETURN 'verified';
END;
$$;

COMMENT ON FUNCTION public.whatsapp_link_confirm(text, text) IS
  'Checks a one-time code hash and, on a match, binds the WhatsApp number to the account. Returns verified | invalid | expired | locked | none. Service role only.';

-- ── What the assistant is allowed to know about the link ────────────────────
--
-- Deliberately not "who is this": no user id, no email, no name. Two booleans
-- and a clock, which is everything the conversation needs to decide what to say
-- next and nothing it could disclose by mistake.
CREATE OR REPLACE FUNCTION public.whatsapp_identity_state(_wa_phone text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'linked', i.user_id IS NOT NULL,
    'awaiting_code', i.code_hash IS NOT NULL AND i.code_expires_at > now(),
    'attempts_left', greatest(0, 5 - coalesce(i.attempts, 0))
  )
  FROM public.whatsapp_identities i
  WHERE i.wa_phone = _wa_phone;
$$;

COMMENT ON FUNCTION public.whatsapp_identity_state(text) IS
  'Whether this number is linked and whether a code is outstanding. Carries no user id, email or name by design. Service role only.';

-- ── Unlinking ──────────────────────────────────────────────────────────────
--
-- A hard delete, not a flag. "Forget my account" from somebody who cannot see
-- the screen has to mean the row is gone, and there is nothing here worth
-- keeping for history: the orders are in `bazaar_orders` and belong to the
-- account, not to this table.
CREATE OR REPLACE FUNCTION public.whatsapp_unlink_identity(_wa_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _gone integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.whatsapp_identities WHERE wa_phone = _wa_phone RETURNING 1
  )
  SELECT count(*) INTO _gone FROM deleted;
  RETURN _gone > 0;
END;
$$;

COMMENT ON FUNCTION public.whatsapp_unlink_identity(text) IS
  'Deletes the link between a WhatsApp number and an account, including any outstanding code. Service role only.';

-- ── The lookup the whole file exists for ────────────────────────────────────
--
-- Keyed on the verified `user_id` and on nothing else. An unlinked number gets
-- zero rows — not an error, not a partial answer.
--
-- The columns are chosen by what can be read aloud safely to somebody holding a
-- phone in a shop: what it was, where from, what state it is in, what it cost.
-- No address, no email, no phone number, no payment reference — none of which
-- answers "where is my order", and all of which would be a disclosure if this
-- ever ran for the wrong person.
CREATE OR REPLACE FUNCTION public.whatsapp_recent_orders(
  _wa_phone text,
  _limit    integer DEFAULT 3
)
RETURNS TABLE (
  reference   text,
  status      text,
  created_at  timestamptz,
  item_count  integer,
  first_item  text,
  total_vx    integer,
  total_usd   numeric,
  shop_name   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    upper(left(o.id::text, 8))                              AS reference,
    o.status,
    o.created_at,
    (SELECT count(*)::integer FROM public.bazaar_order_items i WHERE i.order_id = o.id) AS item_count,
    (SELECT i.product_name FROM public.bazaar_order_items i
      WHERE i.order_id = o.id ORDER BY i.created_at LIMIT 1)                            AS first_item,
    o.total_vx,
    o.total_usd,
    s.name                                                  AS shop_name
  FROM public.bazaar_orders o
  JOIN public.whatsapp_identities w
    ON w.user_id = o.buyer_id AND w.wa_phone = _wa_phone AND w.verified_at IS NOT NULL
  LEFT JOIN public.bazaar_shops s ON s.id = o.shop_id
  ORDER BY o.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 3), 10));
$$;

COMMENT ON FUNCTION public.whatsapp_recent_orders(text, integer) IS
  'Recent orders for the account verifiably linked to this WhatsApp number. Joins on the verified link, never on shipping_phone. Returns no shipping detail. Service role only.';

-- ── Least privilege, on all five ───────────────────────────────────────────
--
-- Every one of these is SECURITY DEFINER and therefore bypasses RLS on
-- `auth.users`, `bazaar_orders` and this table. `anon` and `authenticated` must
-- not be able to call any of them: an authenticated user who could call
-- `whatsapp_recent_orders` with an arbitrary phone number would have exactly
-- the disclosure this design exists to prevent.
REVOKE ALL ON FUNCTION public.whatsapp_link_request(text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_link_confirm(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_identity_state(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_unlink_identity(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_recent_orders(text, integer) FROM PUBLIC, anon, authenticated;

-- And then granted back to the one role that has to call them. `REVOKE … FROM
-- PUBLIC` takes the default execute privilege away from *everybody*, service
-- role included, so without these five lines the webhook's every RPC would fail
-- with "permission denied for function" — the same pairing
-- `decide_owner_approval` uses two migrations earlier.
GRANT EXECUTE ON FUNCTION public.whatsapp_link_request(text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_link_confirm(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_identity_state(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_unlink_identity(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_recent_orders(text, integer) TO service_role;

-- ── Abandoned links do not linger ──────────────────────────────────────────
--
-- A code that was never used carries an email address and a target account, and
-- after ten minutes it is only a record of who tried. Swept on the same hourly
-- schedule as the location erasure, registered by
-- 20260927000000_whatsapp_retention_schedule.sql's sibling below.
CREATE OR REPLACE FUNCTION public.whatsapp_sweep_link_codes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleared integer;
BEGIN
  -- A row that never became a link and has gone quiet for a day is deleted
  -- outright; a linked row keeps only its binding.
  DELETE FROM public.whatsapp_identities
  WHERE user_id IS NULL
    AND coalesce(last_sent_at, created_at) < now() - interval '1 day';

  WITH cleaned AS (
    UPDATE public.whatsapp_identities
    SET code_hash = NULL, code_expires_at = NULL, pending_user_id = NULL,
        pending_email = NULL, attempts = 0, updated_at = now()
    WHERE code_expires_at IS NOT NULL AND code_expires_at < now() - interval '1 hour'
    RETURNING 1
  )
  SELECT count(*) INTO cleared FROM cleaned;

  RETURN cleared;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_sweep_link_codes() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.whatsapp_sweep_link_codes() IS
  'Clears expired one-time codes and deletes link attempts that never completed. Service role only.';

DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE WARNING 'pg_cron is not installed: whatsapp-sweep-link-codes was NOT scheduled. Expired link codes and abandoned attempts will not be cleared.';
    RETURN;
  END IF;
  PERFORM cron.schedule(
    'whatsapp-sweep-link-codes',
    '25 * * * *',
    $cron$SELECT public.whatsapp_sweep_link_codes()$cron$
  );
END
$outer$;
