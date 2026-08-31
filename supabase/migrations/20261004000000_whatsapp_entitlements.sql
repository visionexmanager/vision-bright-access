-- What a WhatsApp sender is entitled to, and what they have used.
--
-- The billing system already knows about plans, subscriptions and credits — for
-- the website. The assistant never asked it anything, so every capability was
-- free to everyone who found the number, and "500 messages a month" was a
-- sentence nobody could enforce.
--
-- Two pieces, and one deliberate omission.
--
-- `whatsapp_entitlements` answers "what may this number do today" and returns
-- the plan, the limit and what is left. It does **not** return a user id, an
-- email or a name — the same decision `whatsapp_identity_state` already took.
-- The webhook needs to know what somebody is allowed, not who they are, and a
-- function that hands identity to a message handler is a function that will
-- eventually log it.
--
-- `whatsapp_usage` counts only what actually costs money: an AI answer, a
-- transcription, a spoken reply, a picture understood. Navigation, the menu,
-- the weather, a location — all keyless or free, none of them metered. A
-- sender who is only pressing menu numbers never runs out of anything.

-- ── The counter ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_usage (
  wa_phone      text NOT NULL,
  usage_date    date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  metered_count integer NOT NULL DEFAULT 0 CHECK (metered_count >= 0),
  -- Per-kind tallies, for seeing where the money goes without a second table.
  breakdown     jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wa_phone, usage_date)
);

COMMENT ON TABLE public.whatsapp_usage IS
  'Daily count of the paid operations one WhatsApp number has used. Service role only: it is a per-person record keyed on a phone number.';

ALTER TABLE public.whatsapp_usage ENABLE ROW LEVEL SECURITY;

-- No policy is deliberate: RLS with no policy denies every role that is not
-- the service role, which is the only caller that should ever read this.
REVOKE ALL ON TABLE public.whatsapp_usage FROM PUBLIC;
REVOKE ALL ON TABLE public.whatsapp_usage FROM anon;
REVOKE ALL ON TABLE public.whatsapp_usage FROM authenticated;
GRANT ALL ON TABLE public.whatsapp_usage TO service_role;

-- ── What each plan allows on WhatsApp ───────────────────────────────────────
--
-- Written into `billing_plans.limits`, so changing an allowance is a row
-- update an admin can make, not a deploy. Zero means unlimited, which is the
-- convention this table already uses for credits.
--
-- These are starting numbers, not a decision nobody can revisit: enough on the
-- free tier to prove the assistant is worth paying for, generous enough on
-- Basic that a daily user never notices the ceiling.

UPDATE public.billing_plans SET limits = limits || jsonb_build_object('whatsapp_daily_messages', 100)
WHERE id = 'free_trial';
UPDATE public.billing_plans SET limits = limits || jsonb_build_object('whatsapp_daily_messages', 300)
WHERE id = 'basic';
UPDATE public.billing_plans SET limits = limits || jsonb_build_object('whatsapp_daily_messages', 1000)
WHERE id = 'pro';
UPDATE public.billing_plans SET limits = limits || jsonb_build_object('whatsapp_daily_messages', 0)
WHERE id = 'enterprise';

-- Somebody who has never linked an account, or whose subscription lapsed.
-- Deliberately not zero: an assistant that refuses to answer a stranger is not
-- a trial, it is a wall, and this audience finds the number by word of mouth.
CREATE OR REPLACE FUNCTION public.whatsapp_free_daily_allowance()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT 20 $$;

COMMENT ON FUNCTION public.whatsapp_free_daily_allowance() IS
  'Paid operations per day for an unlinked or lapsed number. Change here, not in the webhook.';

-- ── What may this number do today ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.whatsapp_entitlements(_wa_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id   uuid;
  _plan_id   text;
  _plan_name text;
  _limit     integer;
  _used      integer;
BEGIN
  IF _wa_phone IS NULL OR btrim(_wa_phone) = '' THEN
    RETURN jsonb_build_object('linked', false, 'plan', 'none', 'plan_name', 'Free',
                              'daily_limit', 0, 'used_today', 0, 'remaining', 0, 'allowed', false);
  END IF;

  SELECT i.user_id INTO _user_id
    FROM public.whatsapp_identities i
   WHERE i.wa_phone = _wa_phone;

  IF _user_id IS NOT NULL THEN
    SELECT s.plan_id INTO _plan_id
      FROM public.user_subscriptions s
     WHERE s.user_id = _user_id
       AND s.status = 'active'
       AND (s.ends_at IS NULL OR s.ends_at > now())
     ORDER BY s.started_at DESC
     LIMIT 1;
  END IF;

  IF _plan_id IS NOT NULL THEN
    SELECT p.name, COALESCE((p.limits ->> 'whatsapp_daily_messages')::integer, 0)
      INTO _plan_name, _limit
      FROM public.billing_plans p
     WHERE p.id = _plan_id AND p.is_active;
  END IF;

  -- No plan, a lapsed one, or one an admin has deactivated: the free allowance
  -- rather than a refusal. Somebody who paid last month and forgot to renew
  -- should meet a smaller assistant, not a locked door.
  IF _plan_name IS NULL THEN
    _plan_id   := 'none';
    _plan_name := 'Free';
    _limit     := public.whatsapp_free_daily_allowance();
  END IF;

  SELECT COALESCE(u.metered_count, 0) INTO _used
    FROM public.whatsapp_usage u
   WHERE u.wa_phone = _wa_phone
     AND u.usage_date = (now() AT TIME ZONE 'utc')::date;
  _used := COALESCE(_used, 0);

  RETURN jsonb_build_object(
    'linked',      _user_id IS NOT NULL,
    'plan',        _plan_id,
    'plan_name',   _plan_name,
    'daily_limit', _limit,
    'used_today',  _used,
    'remaining',   CASE WHEN _limit = 0 THEN -1 ELSE GREATEST(0, _limit - _used) END,
    'allowed',     _limit = 0 OR _used < _limit
  );
END;
$$;

COMMENT ON FUNCTION public.whatsapp_entitlements(text) IS
  'What a number may do today: plan, daily limit, used, remaining. Carries no user id, email or name by design — the webhook needs the allowance, not the identity. Service role only.';

REVOKE ALL ON FUNCTION public.whatsapp_entitlements(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_entitlements(text) FROM anon;
REVOKE ALL ON FUNCTION public.whatsapp_entitlements(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_entitlements(text) TO service_role;

-- ── Spending one ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.whatsapp_meter(_wa_phone text, _kind text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _kind_key text := COALESCE(NULLIF(btrim(_kind), ''), 'other');
  _count    integer;
BEGIN
  IF _wa_phone IS NULL OR btrim(_wa_phone) = '' THEN RETURN 0; END IF;

  INSERT INTO public.whatsapp_usage AS u (wa_phone, usage_date, metered_count, breakdown)
  VALUES (_wa_phone, (now() AT TIME ZONE 'utc')::date, 1, jsonb_build_object(_kind_key, 1))
  ON CONFLICT (wa_phone, usage_date) DO UPDATE
    SET metered_count = u.metered_count + 1,
        breakdown = u.breakdown || jsonb_build_object(
          _kind_key, COALESCE((u.breakdown ->> _kind_key)::integer, 0) + 1
        ),
        updated_at = now()
  RETURNING u.metered_count INTO _count;

  RETURN _count;
END;
$$;

COMMENT ON FUNCTION public.whatsapp_meter(text, text) IS
  'Record one paid operation against a number and return the new daily total. Called after the work succeeded, never before: a failed transcription is not something anybody should pay for.';

REVOKE ALL ON FUNCTION public.whatsapp_meter(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_meter(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.whatsapp_meter(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_meter(text, text) TO service_role;

-- ── Forgetting it ───────────────────────────────────────────────────────────
--
-- A daily tally keyed on a phone number is a record of when a person was
-- awake. It answers a billing question for a few weeks and then it is
-- surveillance, so it is deleted on the same principle as the location
-- columns.

CREATE OR REPLACE FUNCTION public.whatsapp_forget_usage(_days integer DEFAULT 60)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _floor integer := GREATEST(7, COALESCE(_days, 60));  -- a week is the floor
  _gone  integer;
BEGIN
  WITH removed AS (
    DELETE FROM public.whatsapp_usage
     WHERE usage_date < ((now() AT TIME ZONE 'utc')::date - _floor)
    RETURNING 1
  )
  SELECT count(*) INTO _gone FROM removed;
  RETURN _gone;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_forget_usage(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_forget_usage(integer) FROM anon;
REVOKE ALL ON FUNCTION public.whatsapp_forget_usage(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_forget_usage(integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('whatsapp-forget-usage')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-forget-usage');
    PERFORM cron.schedule(
      'whatsapp-forget-usage',
      '30 3 * * *',
      $cron$ SELECT public.whatsapp_forget_usage(60); $cron$
    );
  END IF;
END $$;
