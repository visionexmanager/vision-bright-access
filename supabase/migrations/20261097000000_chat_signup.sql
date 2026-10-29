-- Sign up (or link) from a chat: WhatsApp number or Messenger/Instagram sender.
--
-- The proof is the same one every other link here uses: a six-digit code
-- emailed to the address the person typed, typed back into the chat. No
-- password is ever collected or stored in a chat; the account is created with
-- an unguessable one the person replaces through "forgot password" on the site.
--
-- ── Why one flow covers both a new and an existing address ──────────────────
--
-- An unverified channel must never be able to take over an account, and must
-- never learn whether an address has one. So the request step behaves
-- identically for both: a code is emailed to the typed address either way, the
-- reply is the same sentence either way, and the throttles are the same either
-- way. Only after the code comes back does the outcome differ:
--
--   address already has a confirmed account  -> the channel is linked to it
--   address has none                         -> the edge function creates the
--                                               account, then `chat_signup_bind`
--                                               links the channel to it
--
-- Both outcomes require control of the mailbox, which is the same proof a
-- password reset uses. Control of the chat proves nothing about the account.
--
-- Channels: 'whatsapp' (subject = wa_phone, bound in whatsapp_identities) and
-- 'meta' (subject = '<facebook|instagram>:<page-scoped id>', bound in
-- meta_identities, the same subject string `ai_subscription_gate_meta` is given).
--
-- Additive and re-runnable. Every table is RLS-on with no policy: service role
-- only, on purpose — nothing here is for a browser to read.

-- ── What a Messenger/Instagram sender is linked to ─────────────────────────

CREATE TABLE IF NOT EXISTS public.meta_identities (
  subject     text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meta_identities_user_idx ON public.meta_identities (user_id);
ALTER TABLE public.meta_identities ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.meta_identities IS
  'Verified binding between a Messenger/Instagram sender and a Visionex account, proved by a code emailed to the account. Service role only: no policy, deliberately.';

-- ── The half-finished sign-ups ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_signups (
  channel           text NOT NULL CHECK (channel IN ('whatsapp', 'meta')),
  subject           text NOT NULL,
  -- name | email | code | proven. NULL means idle (kept so the throttles survive a cancel).
  step              text CHECK (step IN ('name', 'email', 'code', 'proven')),
  display_name      text,
  email             text,
  -- The confirmed account the typed address belongs to, if any. Resolved once, at request time.
  target_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- HMAC-SHA256 of the code, computed in the edge function. Never the code.
  code_hash         text,
  code_expires_at   timestamptz,
  attempts          smallint NOT NULL DEFAULT 0,
  proven_at         timestamptz,
  last_sent_at      timestamptz,
  sends_in_window   smallint NOT NULL DEFAULT 0,
  window_started_at timestamptz,
  begins_in_window  smallint NOT NULL DEFAULT 0,
  begin_window_at   timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel, subject)
);
CREATE INDEX IF NOT EXISTS chat_signups_email_idx
  ON public.chat_signups (email, last_sent_at DESC) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_signups_target_idx
  ON public.chat_signups (target_user_id) WHERE target_user_id IS NOT NULL;
ALTER TABLE public.chat_signups ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.chat_signups IS
  'In-flight chat sign-ups. Holds a name, an address and an HMAC of a one-time code. Service role only: no policy, deliberately — do not add one to make something work.';

-- ── Internal: bind a channel to an account ─────────────────────────────────
-- Never callable from outside: no grant to anyone. The public functions below
-- call it as their owner, after their own proof has been checked.

CREATE OR REPLACE FUNCTION public.chat_bind_identity(_channel text, _subject text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer;
BEGIN
  IF _channel = 'whatsapp' THEN
    INSERT INTO public.whatsapp_identities AS i (wa_phone, user_id, verified_at, updated_at)
    VALUES (_subject, _user_id, now(), now())
    ON CONFLICT (wa_phone) DO UPDATE SET
      user_id = EXCLUDED.user_id, verified_at = now(),
      pending_user_id = NULL, pending_email = NULL, code_hash = NULL,
      code_expires_at = NULL, attempts = 0, updated_at = now()
    WHERE i.user_id IS NULL;
  ELSIF _channel = 'meta' THEN
    INSERT INTO public.meta_identities (subject, user_id) VALUES (_subject, _user_id)
    ON CONFLICT (subject) DO NOTHING;
  ELSE
    RETURN false;
  END IF;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_bind_identity(text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ── State ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.chat_signup_state(_channel text, _subject text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _linked boolean;
  _step   text;
BEGIN
  IF _channel = 'whatsapp' THEN
    SELECT EXISTS (SELECT 1 FROM public.whatsapp_identities WHERE wa_phone = _subject AND user_id IS NOT NULL) INTO _linked;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.meta_identities WHERE subject = _subject) INTO _linked;
  END IF;
  -- A sign-up nobody touched for 30 minutes is abandoned.
  SELECT step INTO _step FROM public.chat_signups
   WHERE channel = _channel AND subject = _subject AND updated_at > now() - interval '30 minutes';
  RETURN jsonb_build_object('linked', _linked, 'step', _step);
END;
$$;

-- ── Begin ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.chat_signup_begin(_channel text, _subject text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.chat_signups%ROWTYPE;
  _now timestamptz := now();
  _win timestamptz;
  _cnt smallint;
BEGIN
  IF _channel NOT IN ('whatsapp', 'meta') OR _subject IS NULL OR btrim(_subject) = '' THEN
    RAISE EXCEPTION 'channel and subject are required';
  END IF;
  IF (public.chat_signup_state(_channel, _subject) ->> 'linked')::boolean THEN
    RETURN 'already_linked';
  END IF;

  -- Abandoned rows of anyone are tidied opportunistically; no cron needed.
  DELETE FROM public.chat_signups WHERE updated_at < _now - interval '2 days' AND (last_sent_at IS NULL OR last_sent_at < _now - interval '2 days');

  SELECT * INTO _row FROM public.chat_signups WHERE channel = _channel AND subject = _subject FOR UPDATE;
  _win := CASE WHEN FOUND AND _row.begin_window_at IS NOT NULL AND _row.begin_window_at > _now - interval '1 hour'
               THEN _row.begin_window_at ELSE _now END;
  -- Decided by the window itself, never by comparing timestamps: two calls in one clock tick would look like a fresh window.
  _cnt := CASE WHEN FOUND AND _row.begin_window_at IS NOT NULL AND _row.begin_window_at > _now - interval '1 hour' THEN coalesce(_row.begins_in_window, 0) ELSE 0 END;
  IF _cnt >= 6 THEN RETURN 'throttled'; END IF;

  INSERT INTO public.chat_signups AS c (channel, subject, step, begins_in_window, begin_window_at, updated_at)
  VALUES (_channel, _subject, 'name', (_cnt + 1)::smallint, _win, _now)
  ON CONFLICT (channel, subject) DO UPDATE SET
    step = 'name', display_name = NULL, email = NULL, target_user_id = NULL,
    code_hash = NULL, code_expires_at = NULL, attempts = 0, proven_at = NULL,
    begins_in_window = EXCLUDED.begins_in_window, begin_window_at = EXCLUDED.begin_window_at,
    updated_at = _now;
  RETURN 'started';
END;
$$;

-- ── Name ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.chat_signup_set_name(_channel text, _subject text, _name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean text := btrim(regexp_replace(coalesce(_name, ''), '\s+', ' ', 'g'));
BEGIN
  IF (public.chat_signup_state(_channel, _subject) ->> 'step') IS DISTINCT FROM 'name' THEN
    RETURN 'none';
  END IF;
  -- The site only requires a non-empty name. A chat additionally refuses what
  -- is plainly not one: an address, a link, or a paragraph.
  IF length(_clean) < 2 OR length(_clean) > 80 OR _clean ~ '[@<>]' OR _clean ~* '(https?:|www\.)' THEN
    RETURN 'invalid';
  END IF;
  UPDATE public.chat_signups SET display_name = _clean, step = 'email', updated_at = now()
   WHERE channel = _channel AND subject = _subject;
  RETURN 'ok';
END;
$$;

-- ── Request a code ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.chat_signup_request_code(
  _channel text, _subject text, _email text, _code_hash text, _ttl_minutes integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now   timestamptz := now();
  _clean text := lower(btrim(coalesce(_email, '')));
  _row   public.chat_signups%ROWTYPE;
  _win   timestamptz;
  _sends smallint;
  _target uuid;
BEGIN
  IF _clean = '' OR _code_hash IS NULL OR btrim(_code_hash) = '' THEN
    RAISE EXCEPTION 'email and code hash are required';
  END IF;
  IF _ttl_minutes < 1 OR _ttl_minutes > 60 THEN
    RAISE EXCEPTION 'code lifetime must be between 1 and 60 minutes';
  END IF;
  IF (public.chat_signup_state(_channel, _subject) ->> 'step') NOT IN ('email', 'code') THEN
    RETURN jsonb_build_object('status', 'none', 'deliver', false);
  END IF;

  SELECT * INTO _row FROM public.chat_signups WHERE channel = _channel AND subject = _subject FOR UPDATE;

  IF _row.last_sent_at IS NOT NULL AND _row.last_sent_at > _now - interval '60 seconds' THEN
    RETURN jsonb_build_object('status', 'cooldown', 'deliver', false);
  END IF;
  _win := CASE WHEN _row.window_started_at IS NOT NULL AND _row.window_started_at > _now - interval '1 hour'
               THEN _row.window_started_at ELSE _now END;
  _sends := CASE WHEN _row.window_started_at IS NOT NULL AND _row.window_started_at > _now - interval '1 hour' THEN coalesce(_row.sends_in_window, 0) ELSE 0 END;
  IF _sends >= 5 THEN RETURN jsonb_build_object('status', 'throttled', 'deliver', false); END IF;

  -- Somebody else's mailbox is not a place to deliver codes from many chats.
  IF (SELECT count(*) FROM public.chat_signups
       WHERE email = _clean AND (channel, subject) <> (_channel, _subject)
         AND last_sent_at > _now - interval '1 hour') >= 3 THEN
    RETURN jsonb_build_object('status', 'throttled', 'deliver', false);
  END IF;

  -- Only a *confirmed* address counts as an existing account: an unconfirmed
  -- one proves nothing about who owns the mailbox.
  SELECT id INTO _target FROM auth.users
   WHERE lower(email) = _clean AND email_confirmed_at IS NOT NULL LIMIT 1;

  UPDATE public.chat_signups SET
    email = _clean, target_user_id = _target, code_hash = _code_hash,
    code_expires_at = _now + make_interval(mins => _ttl_minutes), attempts = 0,
    step = 'code', last_sent_at = _now, sends_in_window = (_sends + 1)::smallint,
    window_started_at = _win, updated_at = _now
   WHERE channel = _channel AND subject = _subject;

  -- Identical for a new and an existing address; the email goes out for both.
  RETURN jsonb_build_object('status', 'sent', 'deliver', true);
END;
$$;

-- ── Confirm the code ───────────────────────────────────────────────────────
-- Returns jsonb: status = linked | create | invalid | expired | locked | none.
-- 'create' carries the proven address and name for the edge function to make
-- the account with; the account does not exist until the code was right.

CREATE OR REPLACE FUNCTION public.chat_signup_confirm(_channel text, _subject text, _code_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
  _row public.chat_signups%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.chat_signups WHERE channel = _channel AND subject = _subject FOR UPDATE;
  IF NOT FOUND OR _row.step IS DISTINCT FROM 'code' OR _row.code_hash IS NULL OR _row.updated_at < _now - interval '30 minutes' THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;

  IF _row.code_expires_at IS NULL OR _row.code_expires_at < _now THEN
    UPDATE public.chat_signups SET step = NULL, code_hash = NULL, code_expires_at = NULL, updated_at = _now
     WHERE channel = _channel AND subject = _subject;
    RETURN jsonb_build_object('status', 'expired');
  END IF;
  IF _row.attempts >= 5 THEN
    UPDATE public.chat_signups SET step = NULL, code_hash = NULL, code_expires_at = NULL, updated_at = _now
     WHERE channel = _channel AND subject = _subject;
    RETURN jsonb_build_object('status', 'locked');
  END IF;
  IF _row.code_hash <> _code_hash THEN
    UPDATE public.chat_signups SET attempts = _row.attempts + 1, updated_at = _now
     WHERE channel = _channel AND subject = _subject;
    RETURN jsonb_build_object('status', 'invalid', 'attempts_left', greatest(0, 4 - _row.attempts));
  END IF;

  IF _row.target_user_id IS NOT NULL THEN
    -- An existing account, proved by its mailbox: link, do not create.
    PERFORM public.chat_bind_identity(_channel, _subject, _row.target_user_id);
    UPDATE public.chat_signups SET step = NULL, code_hash = NULL, code_expires_at = NULL, updated_at = _now
     WHERE channel = _channel AND subject = _subject;
    RETURN jsonb_build_object('status', 'linked');
  END IF;

  UPDATE public.chat_signups SET step = 'proven', proven_at = _now, code_hash = NULL, code_expires_at = NULL, updated_at = _now
   WHERE channel = _channel AND subject = _subject;
  RETURN jsonb_build_object('status', 'create', 'email', _row.email, 'display_name', _row.display_name);
END;
$$;

-- ── Bind a freshly created account ─────────────────────────────────────────
-- The edge function creates the auth user between confirm and this call. The
-- bind only goes through for an account whose address is the one just proven,
-- that is confirmed, and that was created moments ago — so a caller cannot
-- use this to attach a channel to some other account.

CREATE OR REPLACE FUNCTION public.chat_signup_bind(_channel text, _subject text, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.chat_signups%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.chat_signups WHERE channel = _channel AND subject = _subject FOR UPDATE;
  IF NOT FOUND OR _row.step IS DISTINCT FROM 'proven' OR _row.proven_at < now() - interval '15 minutes' THEN
    RETURN 'rejected';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
     WHERE u.id = _user_id AND lower(u.email) = _row.email
       AND u.email_confirmed_at IS NOT NULL AND u.created_at > now() - interval '15 minutes'
  ) THEN
    RETURN 'rejected';
  END IF;
  PERFORM public.chat_bind_identity(_channel, _subject, _user_id);
  UPDATE public.chat_signups SET step = NULL, target_user_id = NULL, proven_at = NULL, updated_at = now()
   WHERE channel = _channel AND subject = _subject;
  RETURN 'bound';
END;
$$;

-- ── Cancel ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.chat_signup_cancel(_channel text, _subject text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.chat_signups
     SET step = NULL, display_name = NULL, email = NULL, target_user_id = NULL,
         code_hash = NULL, code_expires_at = NULL, proven_at = NULL, updated_at = now()
   WHERE channel = _channel AND subject = _subject;
$$;

-- ── Messenger/Instagram gate resolves the proved account ───────────────────
-- Same wrapper as before, now passing the account a sender proved. Without a
-- link nothing changes: the user id is NULL and the gate behaves as it did.

CREATE OR REPLACE FUNCTION public.ai_subscription_gate_meta(_sender_id text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _verdict   text;
  _renoticed integer;
  _user_id   uuid;
BEGIN
  IF _sender_id IS NULL OR btrim(_sender_id) = '' THEN RETURN 'blocked_silent'; END IF;

  SELECT m.user_id INTO _user_id FROM public.meta_identities m WHERE m.subject = _sender_id;

  _verdict := public.ai_subscription_gate('meta', _sender_id, _user_id);

  IF _verdict = 'blocked_silent' THEN
    UPDATE public.ai_subscription_gate_notices
       SET notified_at = now()
     WHERE channel = 'meta'
       AND subject = _sender_id
       AND notified_at < now() - interval '10 minutes';
    GET DIAGNOSTICS _renoticed = ROW_COUNT;
    IF _renoticed = 1 THEN RETURN 'blocked_first_notice'; END IF;
  END IF;

  RETURN _verdict;
END;
$$;

-- ── Grants: service role only, written beside the revoke ───────────────────

DO $$
DECLARE
  _sig text;
BEGIN
  FOREACH _sig IN ARRAY ARRAY[
    'public.chat_signup_state(text, text)',
    'public.chat_signup_begin(text, text)',
    'public.chat_signup_set_name(text, text, text)',
    'public.chat_signup_request_code(text, text, text, text, integer)',
    'public.chat_signup_confirm(text, text, text)',
    'public.chat_signup_bind(text, text, uuid)',
    'public.chat_signup_cancel(text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', _sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _sig);
  END LOOP;
END $$;

-- ── Free fixed replies to unsubscribed senders: a flood guard ──────────────
-- The replies cost nothing to produce, but a loop of two bots would still be a
-- loop. At most 20 an hour per sender; beyond that the sender is not answered.

CREATE TABLE IF NOT EXISTS public.chat_free_replies (
  channel      text NOT NULL,
  subject      text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  sent         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (channel, subject)
);
ALTER TABLE public.chat_free_replies ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.chat_free_replies IS
  'Hourly counter for fixed replies to unsubscribed senders. Service role only: no policy, deliberately.';

CREATE OR REPLACE FUNCTION public.chat_free_reply_allow(_channel text, _subject text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sent integer;
BEGIN
  IF _channel NOT IN ('whatsapp', 'meta') OR _subject IS NULL OR btrim(_subject) = '' THEN
    RETURN false;
  END IF;
  INSERT INTO public.chat_free_replies AS f (channel, subject, window_start, sent)
  VALUES (_channel, _subject, now(), 1)
  ON CONFLICT (channel, subject) DO UPDATE SET
    window_start = CASE WHEN f.window_start < now() - interval '1 hour' THEN now() ELSE f.window_start END,
    sent         = CASE WHEN f.window_start < now() - interval '1 hour' THEN 1 ELSE f.sent + 1 END
  RETURNING sent INTO _sent;
  RETURN _sent <= 20;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_free_reply_allow(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_free_reply_allow(text, text) TO service_role;

-- ── A one-hour memory for the free replies ─────────────────────────────────
-- Lets the bot hold a sequential conversation with someone who is not
-- subscribed yet: what they said they like, who the plan is for, what it last
-- asked. Deliberately holds NO message text, name, address or number — only a
-- small object of enum-like words (section keys, 'self'/'child'/'work', the
-- last question asked). It is forgotten after an hour without a message.

CREATE TABLE IF NOT EXISTS public.chat_memory (
  channel    text NOT NULL,
  subject    text NOT NULL,
  profile    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel, subject),
  CONSTRAINT chat_memory_profile_small CHECK (jsonb_typeof(profile) = 'object' AND length(profile::text) <= 1000)
);
ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.chat_memory IS
  'One-hour conversational memory for free replies: enum-like words only, never message text. Service role only: no policy, deliberately.';

CREATE OR REPLACE FUNCTION public.chat_memory_get(_channel text, _subject text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT m.profile FROM public.chat_memory m
      WHERE m.channel = _channel AND m.subject = _subject AND m.updated_at > now() - interval '1 hour'),
    '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.chat_memory_put(_channel text, _subject text, _profile jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _channel NOT IN ('whatsapp', 'meta') OR _subject IS NULL OR btrim(_subject) = '' THEN
    RETURN false;
  END IF;
  IF _profile IS NULL OR jsonb_typeof(_profile) <> 'object' OR length(_profile::text) > 1000 THEN
    RETURN false;
  END IF;
  -- Old memories of anyone are tidied as a side effect; no cron needed.
  DELETE FROM public.chat_memory WHERE updated_at < now() - interval '1 day';
  INSERT INTO public.chat_memory AS m (channel, subject, profile, updated_at)
  VALUES (_channel, _subject, _profile, now())
  ON CONFLICT (channel, subject) DO UPDATE SET profile = EXCLUDED.profile, updated_at = now();
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_memory_get(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_memory_put(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_memory_get(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.chat_memory_put(text, text, jsonb) TO service_role;
