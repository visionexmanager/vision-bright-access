-- ============================================================
-- A plan for children, and a WhatsApp reminder the day before a plan ends
--
-- 1. `kids` — $3 a month, VisionKids only (its lessons, stories and learning
--    games), beside the three nested tiers rather than inside them. Mirrors
--    KIDS_PLAN in src/lib/billing/plans.ts; subscription-reminders.test.ts
--    fails if the two drift.
-- 2. The OMT recipient name the checkout shows next to the owner's number.
-- 3. The WhatsApp number a subscriber gives at checkout, so a reminder has
--    somewhere to go even when they never linked WhatsApp to their account.
-- 4. `plan_expiry_reminders` — who is inside the last 24 hours and has not been
--    told yet, per channel — for trial-billing to send.
-- ============================================================

-- ── 1. Kids ─────────────────────────────────────────────────────────────────

INSERT INTO public.billing_plans
  (id, name, description, price_monthly_usd, vx_credits_monthly, is_unlimited, features, limits, is_active, sort_order)
VALUES
  ('kids', 'Kids', 'VisionKids only — learning and games made for children',
    3, 0, false,
    '["VisionKids lessons and stories","VisionKids learning games","Made for children, and nothing else","50 assistant requests a day"]'::jsonb,
    jsonb_build_object(
      'sections', jsonb_build_array('news','community','assistive','kids'),
      'whatsapp_daily_messages', 50
    ),
    true, 1)
ON CONFLICT (id) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  price_monthly_usd  = EXCLUDED.price_monthly_usd,
  vx_credits_monthly = EXCLUDED.vx_credits_monthly,
  features           = EXCLUDED.features,
  limits             = EXCLUDED.limits,
  is_active          = EXCLUDED.is_active,
  sort_order         = EXCLUDED.sort_order;

-- Cheapest first on the pricing page: the free week, Kids, then the tiers.
UPDATE public.billing_plans SET sort_order = 2 WHERE id = 'bronze';
UPDATE public.billing_plans SET sort_order = 3 WHERE id = 'silver';
UPDATE public.billing_plans SET sort_order = 4 WHERE id = 'gold';

-- ── 2. OMT recipient ────────────────────────────────────────────────────────

INSERT INTO public.site_settings (key, value)
SELECT 'subscription_payment_omt_name', '"Mohammad Abboud"'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'subscription_payment_omt_name');

-- ── 3. Where a reminder goes ────────────────────────────────────────────────

ALTER TABLE public.subscription_orders ADD COLUMN IF NOT EXISTS whatsapp_phone text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_orders_whatsapp_phone_digits') THEN
    ALTER TABLE public.subscription_orders
      ADD CONSTRAINT subscription_orders_whatsapp_phone_digits
      CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^[0-9]{8,15}$');
  END IF;
END $$;

-- One column per channel, so a WhatsApp message that could not be delivered is
-- tried again on the next run without sending the email twice.
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_whatsapp_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_whatsapp_warned_at timestamptz;

-- The checkout now sends the number. A new argument is a new signature, and two
-- overloads that both accept three arguments would make PostgREST refuse the
-- call as ambiguous, so the old one goes.
DROP FUNCTION IF EXISTS public.create_subscription_order(text, text, integer);

CREATE OR REPLACE FUNCTION public.create_subscription_order(
  _plan_id text,
  _payment_method text,
  _months integer DEFAULT 1,
  _whatsapp_phone text DEFAULT NULL
)
RETURNS public.subscription_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _price numeric(10,2);
  _phone text := regexp_replace(COALESCE(_whatsapp_phone, ''), '[^0-9]', '', 'g');
  _order public.subscription_orders;
  _attempt integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _payment_method IS NULL OR _payment_method NOT IN ('omt', 'whish', 'card') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  IF _months IS NULL OR _months NOT IN (1, 3, 6, 12) THEN
    RAISE EXCEPTION 'Invalid duration';
  END IF;

  -- Digits only, the way wa.me and the Cloud API want them: "+961 70 750 609"
  -- and "0096170750609" are the same number.
  IF _phone LIKE '00%' THEN
    _phone := substr(_phone, 3);
  END IF;
  IF _phone = '' THEN
    _phone := NULL;
  ELSIF _phone !~ '^[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'Invalid WhatsApp number';
  END IF;

  SELECT b.price_monthly_usd * _months INTO _price
    FROM public.billing_plans b
   WHERE b.id = _plan_id AND b.is_active AND b.price_monthly_usd > 0;
  IF _price IS NULL THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;

  -- Pressing the button twice, or coming back to change the way to pay or the
  -- duration, is the same order: one reference for the owner to match.
  SELECT * INTO _order
    FROM public.subscription_orders o
   WHERE o.user_id = _uid AND o.plan_id = _plan_id AND o.status = 'pending'
     AND o.created_at > now() - interval '2 days'
   ORDER BY o.created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF FOUND THEN
    UPDATE public.subscription_orders
       SET payment_method = _payment_method, months = _months, price_usd = _price,
           whatsapp_phone = COALESCE(_phone, whatsapp_phone)
     WHERE id = _order.id
    RETURNING * INTO _order;
    RETURN _order;
  END IF;

  IF (SELECT count(*) FROM public.subscription_orders o
       WHERE o.user_id = _uid AND o.status = 'pending'
         AND o.created_at > now() - interval '2 days') >= 3 THEN
    RAISE EXCEPTION 'Too many pending orders';
  END IF;

  LOOP
    BEGIN
      INSERT INTO public.subscription_orders
        (user_id, plan_id, months, price_usd, payment_method, whatsapp_phone, reference_code)
      VALUES (_uid, _plan_id, _months, _price, _payment_method, _phone,
              'VX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)))
      RETURNING * INTO _order;
      RETURN _order;
    EXCEPTION WHEN unique_violation THEN
      _attempt := _attempt + 1;
      IF _attempt >= 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.create_subscription_order(text, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_subscription_order(text, text, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_subscription_order(text, text, integer, text) TO authenticated, service_role;

-- ── 4. Who to remind ────────────────────────────────────────────────────────
--
-- A paid plan inside its last `_hours`, and a free week inside its last
-- `_hours` for somebody without a plan. The number is the one they proved by
-- linking WhatsApp to their account if there is one, and otherwise the one
-- they typed at checkout for the order that was paid. The conversation row, if
-- any, gives the language and whether Meta's 24-hour window is still open.
--
-- Service role only: this lists people and phone numbers.

CREATE OR REPLACE FUNCTION public.plan_expiry_reminders(_hours integer DEFAULT 24)
RETURNS TABLE (
  kind text,
  user_id uuid,
  subscription_id uuid,
  plan_id text,
  plan_name text,
  ends_at timestamptz,
  wa_phone text,
  wa_language text,
  wa_last_message_at timestamptz,
  needs_notice boolean,
  needs_whatsapp boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH horizon AS (
    SELECT now() + make_interval(hours => GREATEST(COALESCE(_hours, 24), 1)) AS until
  ),
  ending AS (
    SELECT 'subscription'::text AS kind, s.user_id, s.id AS subscription_id, s.plan_id,
           b.name AS plan_name, s.ends_at,
           s.expiry_notified_at IS NULL AS needs_notice,
           s.expiry_whatsapp_at IS NULL AS whatsapp_pending
      FROM public.user_subscriptions s
      JOIN public.billing_plans b ON b.id = s.plan_id
     WHERE s.status = 'active'
       AND s.ends_at IS NOT NULL
       AND s.ends_at > now()
       AND s.ends_at <= (SELECT until FROM horizon)
       AND (s.expiry_notified_at IS NULL OR s.expiry_whatsapp_at IS NULL)
    UNION ALL
    SELECT 'trial'::text, p.user_id, NULL::uuid, 'free_trial'::text,
           'Free week'::text, p.trial_expires_at,
           false, true
      FROM public.profiles p
     WHERE p.trial_expires_at IS NOT NULL
       AND p.trial_expires_at > now()
       AND p.trial_expires_at <= (SELECT until FROM horizon)
       AND p.trial_whatsapp_warned_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.user_subscriptions s2
          WHERE s2.user_id = p.user_id AND s2.status = 'active'
            AND (s2.ends_at IS NULL OR s2.ends_at > p.trial_expires_at)
       )
  )
  SELECT e.kind, e.user_id, e.subscription_id, e.plan_id, e.plan_name, e.ends_at,
         phone.wa_phone, c.language, c.last_message_at,
         e.needs_notice,
         e.whatsapp_pending AND phone.wa_phone IS NOT NULL
    FROM ending e
    LEFT JOIN LATERAL (
      SELECT x.wa_phone
        FROM (
          SELECT i.wa_phone, 1 AS rank, i.verified_at AS at
            FROM public.whatsapp_identities i
           WHERE i.user_id = e.user_id AND i.verified_at IS NOT NULL
          UNION ALL
          SELECT o.whatsapp_phone, 2, o.reviewed_at
            FROM public.subscription_orders o
           WHERE o.user_id = e.user_id AND o.status = 'approved' AND o.whatsapp_phone IS NOT NULL
        ) x
       ORDER BY x.rank, x.at DESC NULLS LAST
       LIMIT 1
    ) phone ON true
    LEFT JOIN LATERAL (
      SELECT wc.language, wc.last_message_at
        FROM public.whatsapp_conversations wc
       WHERE wc.wa_phone = phone.wa_phone
       ORDER BY wc.last_message_at DESC NULLS LAST
       LIMIT 1
    ) c ON true
   WHERE e.needs_notice OR (e.whatsapp_pending AND phone.wa_phone IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION public.plan_expiry_reminders(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.plan_expiry_reminders(integer) FROM anon;
REVOKE ALL ON FUNCTION public.plan_expiry_reminders(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.plan_expiry_reminders(integer) TO service_role;
