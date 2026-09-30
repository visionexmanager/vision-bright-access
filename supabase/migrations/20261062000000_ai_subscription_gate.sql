-- No AI work for an account without an active paid subscription.
--
-- Until now the question "may this caller use AI at all" had no answer on the
-- server. `user_has_section` asks whether a plan opens a *section*, the VX meter
-- asks whether the caller can *pay*, and the daily limits ask how *often* — and
-- an account with no subscription passed all three for the free sections, the
-- free WhatsApp allowance, and every AI function that checks none of them.
--
-- This migration is the one answer every entry point now asks first, before
-- any rate limit, VX charge or provider call:
--
--   ai_subscription_gate(channel, subject, user_id)
--     → 'authorized'           the account is entitled; run the request
--     → 'blocked_first_notice' not entitled; this caller wins the one notice
--     → 'blocked_silent'       not entitled; the notice was already sent
--
-- ── Who is entitled ────────────────────────────────────────────────────────
--
-- The source of truth is unchanged: `user_subscriptions` joined to
-- `billing_plans`, with exactly the predicate `plan_for_user` uses for a
-- subscription (status 'active', `ends_at` not passed, plan row active). What is
-- new is that only the paid plans count:
--
--   kids, basic, pro, business   (PAID_PLAN_ORDER in src/lib/billing/plans.ts;
--                                 ai-subscription-gate.test.ts pins the two)
--   the `admin` role             (has_role, server-side — staff, not a plan)
--
-- And, deliberately, what does not:
--
--   * the free-trial week (`profiles.trial_expires_at`) — not a paid plan;
--   * status 'cancelled', 'expired' or 'past_due', or 'active' past `ends_at`;
--   * a `subscription_orders` row that is pending or rejected — a checkout
--     started, or payment details entered, is not a subscription until an
--     order is approved and the row lands in `user_subscriptions`;
--   * a VX balance of any size;
--   * a plan row that is no longer active (the retired `legacy_*` plans).
--
-- `plan_for_user` itself is not reused because it returns 'free_trial' ahead
-- of a paid subscription, which would wrongly refuse someone who is both.
--
-- ── The one notice ─────────────────────────────────────────────────────────
--
-- `ai_subscription_gate_notices` holds one row per (channel, subject) that has
-- been told. The row is taken with INSERT … ON CONFLICT DO NOTHING, so ten
-- simultaneous WhatsApp messages race on the primary key and exactly one of
-- them sees a row inserted. The other nine are silent.
--
-- When the same subject is next seen entitled, its row is deleted, so a
-- subscription that later lapses earns exactly one new notice, not none.
--
-- Channels: 'web' (subject = auth user id), 'web_anon' (subject = the HMAC of
-- the caller address that the anonymous rate limiter already uses),
-- 'whatsapp' (subject = the signed sender number), 'meta' (subject = the
-- page-scoped sender id). A future channel is a new label, not a new table.

-- ── 1. Notification state ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_subscription_gate_notices (
  channel     text        NOT NULL,
  subject     text        NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_subscription_gate_notices_pkey PRIMARY KEY (channel, subject),
  CONSTRAINT ai_subscription_gate_notices_channel_check
    CHECK (channel ~ '^[a-z][a-z_]{1,31}$'),
  CONSTRAINT ai_subscription_gate_notices_subject_check
    CHECK (char_length(subject) BETWEEN 1 AND 200)
);

COMMENT ON TABLE public.ai_subscription_gate_notices IS
  'One row per (channel, subject) already told that AI needs a subscription. Written only by ai_subscription_gate(). RLS on with no policy: service role only, on purpose — do not add a policy.';

ALTER TABLE public.ai_subscription_gate_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_subscription_gate_notices FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.ai_subscription_gate_notices TO service_role;

-- ── 2. The plans that open AI ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_eligible_plans()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT ARRAY['kids', 'basic', 'pro', 'business']::text[] $$;

COMMENT ON FUNCTION public.ai_eligible_plans() IS
  'The paid plan ids whose active subscription opens AI services. Mirrors PAID_PLAN_ORDER in src/lib/billing/plans.ts; ai-subscription-gate.test.ts pins the two.';

REVOKE ALL ON FUNCTION public.ai_eligible_plans() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_eligible_plans() TO service_role;

-- ── 3. Is this account entitled? ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_user_entitled(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  IF public.has_role(_user_id, 'admin') THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1
      FROM public.user_subscriptions s
      JOIN public.billing_plans p ON p.id = s.plan_id
     WHERE s.user_id = _user_id
       AND s.status = 'active'
       AND (s.ends_at IS NULL OR s.ends_at > now())
       AND p.is_active
       AND s.plan_id = ANY (public.ai_eligible_plans())
  );
END;
$$;

COMMENT ON FUNCTION public.ai_user_entitled(uuid) IS
  'True for an admin, or an account with an active, unexpired subscription to an ai_eligible_plans() plan. Never true for a trial, a VX balance, a pending order or a lapsed subscription.';

REVOKE ALL ON FUNCTION public.ai_user_entitled(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_user_entitled(uuid) TO service_role;

-- ── 4. The gate ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_subscription_gate(
  _channel text,
  _subject text,
  _user_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _claimed integer;
BEGIN
  -- A caller with nothing to key the notice on cannot be told once, so it is
  -- never told and never served.
  IF _channel IS NULL OR _subject IS NULL OR btrim(_subject) = '' THEN
    RETURN 'blocked_silent';
  END IF;

  IF public.ai_user_entitled(_user_id) THEN
    -- Re-arm: a later lapse gets one fresh notice.
    DELETE FROM public.ai_subscription_gate_notices
     WHERE channel = _channel AND subject = _subject;
    RETURN 'authorized';
  END IF;

  INSERT INTO public.ai_subscription_gate_notices (channel, subject)
  VALUES (_channel, _subject)
  ON CONFLICT (channel, subject) DO NOTHING;
  GET DIAGNOSTICS _claimed = ROW_COUNT;

  RETURN CASE WHEN _claimed = 1 THEN 'blocked_first_notice' ELSE 'blocked_silent' END;
END;
$$;

COMMENT ON FUNCTION public.ai_subscription_gate(text, text, uuid) IS
  'The subscription gate every AI entry point calls before any limit, VX charge or provider: authorized | blocked_first_notice (exactly one concurrent caller) | blocked_silent.';

REVOKE ALL ON FUNCTION public.ai_subscription_gate(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_subscription_gate(text, text, uuid) TO service_role;

-- ── 5. WhatsApp: the same gate, resolved from the signed sender number ────
--
-- The number proves nothing about an account; only the emailed-code link in
-- `whatsapp_identities` does (see 20260928000000). The owner handset from
-- `site_settings.owner_contact` is staff, exactly as `whatsapp_entitlements`
-- treats it. The user id is resolved here and never returned.

CREATE OR REPLACE FUNCTION public.ai_subscription_gate_whatsapp(_wa_phone text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid;
BEGIN
  IF _wa_phone IS NULL OR btrim(_wa_phone) = '' THEN RETURN 'blocked_silent'; END IF;

  IF public.whatsapp_is_owner_number(_wa_phone) THEN
    DELETE FROM public.ai_subscription_gate_notices
     WHERE channel = 'whatsapp' AND subject = _wa_phone;
    RETURN 'authorized';
  END IF;

  SELECT i.user_id INTO _user_id
    FROM public.whatsapp_identities i
   WHERE i.wa_phone = _wa_phone
     AND i.user_id IS NOT NULL;

  RETURN public.ai_subscription_gate('whatsapp', _wa_phone, _user_id);
END;
$$;

COMMENT ON FUNCTION public.ai_subscription_gate_whatsapp(text) IS
  'ai_subscription_gate for a WhatsApp sender: owner handset, else the account proved by whatsapp_identities, else not entitled.';

REVOKE ALL ON FUNCTION public.ai_subscription_gate_whatsapp(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_subscription_gate_whatsapp(text) TO service_role;
