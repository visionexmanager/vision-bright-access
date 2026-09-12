-- One free week, then Bronze, Silver or Gold.
--
-- What was here before: thirty days of everything from registration, and four
-- plans — `basic` $9.99, `pro` $29.99, `enterprise` $99.99 — that only ever
-- described the AI Media Studio's credits. No plan said which *section* of
-- Visionex it opened, so every section was open to everybody, and the prices
-- were quoted against VX credits rather than against anything a reader could
-- picture.
--
-- What this migration puts in its place:
--
--   • A free week (`trial_period_days()`), with every section open, on the
--     site and on WhatsApp.
--   • Three nested tiers — Bronze $5 ⊂ Silver $7 ⊂ Gold $10 — each carrying
--     the list of sections it opens in `billing_plans.limits -> 'sections'`,
--     so an admin can move a section between tiers with an UPDATE rather than
--     a deploy. `src/lib/billing/plans.ts` mirrors these lists and
--     `src/test/subscription-tiers.test.ts` fails if the two drift.
--   • A free floor: the news, the community and the assistive-product
--     catalogue never need a plan, and neither does anything the catalogue
--     does not name.
--
-- Nobody loses anything. The old plans are deactivated rather than deleted
-- (subscriptions reference them), and every active subscription is moved to a
-- tier at least as open as what it had, keeping whatever credits it had left.

-- ── How long the free week is ───────────────────────────────────────────────
--
-- A function rather than a literal: three places used to hard-code "30 days"
-- and two of them disagreed after the trial was shortened once already.

CREATE OR REPLACE FUNCTION public.trial_period_days()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT 7 $$;

COMMENT ON FUNCTION public.trial_period_days() IS
  'Days of full access a new account gets. Mirrored by TRIAL_DAYS in src/lib/billing/plans.ts.';

REVOKE ALL ON FUNCTION public.trial_period_days() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trial_period_days() FROM anon;
GRANT EXECUTE ON FUNCTION public.trial_period_days() TO authenticated, service_role;

-- New rows get the week without `handle_new_user` having to name the column —
-- it inserts into `profiles` without it, and a column default is one place to
-- change rather than a large trigger function to restate.
ALTER TABLE public.profiles
  ALTER COLUMN trial_expires_at SET DEFAULT (now() + (public.trial_period_days() || ' days')::interval);

-- Deliberately no backfill. Accounts that already carry a thirty-day expiry
-- keep it: shortening a trial somebody is in the middle of is the one change
-- here that would take something away.

-- ── The three tiers ─────────────────────────────────────────────────────────

INSERT INTO public.billing_plans
  (id, name, description, price_monthly_usd, vx_credits_monthly, is_unlimited, features, limits, is_active, sort_order)
VALUES
  ('bronze', 'Bronze', 'Learning, reading and playing — the assistant included',
    5, 5000, false,
    '["Visionex assistant on WhatsApp and on the site","Academy","Library","Arcade games","VXBazaar","News and community","5,000 VX credits/month","150 assistant requests a day"]'::jsonb,
    jsonb_build_object(
      'sections', jsonb_build_array('news','community','assistive','assistant','academy','library','arcade','marketplace'),
      'whatsapp_daily_messages', 150
    ),
    true, 1),

  ('silver', 'Silver', 'Everything in Bronze, plus the family sections',
    7, 12000, false,
    '["Everything in Bronze","VisionKids","Career Hub","Visionex TV","Visionex Radio","Messages and voice rooms","Simulations","12,000 VX credits/month","400 assistant requests a day"]'::jsonb,
    jsonb_build_object(
      'sections', jsonb_build_array('news','community','assistive','assistant','academy','library','arcade','marketplace',
                                    'kids','career','tv','radio','messages','simulations'),
      'whatsapp_daily_messages', 400
    ),
    true, 2),

  ('gold', 'Gold', 'Everything in Silver, plus the creation tools',
    10, 30000, false,
    '["Everything in Silver","AI Media Studio","Library Studio publishing","Professional tools and file studio","VX Finance Hub","30,000 VX credits/month","No daily limit on the assistant"]'::jsonb,
    jsonb_build_object(
      'sections', jsonb_build_array('news','community','assistive','assistant','academy','library','arcade','marketplace',
                                    'kids','career','tv','radio','messages','simulations',
                                    'mediaStudio','studio','professional','finance'),
      'whatsapp_daily_messages', 0
    ),
    true, 3)
ON CONFLICT (id) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  price_monthly_usd  = EXCLUDED.price_monthly_usd,
  vx_credits_monthly = EXCLUDED.vx_credits_monthly,
  features           = EXCLUDED.features,
  limits             = EXCLUDED.limits,
  is_active          = EXCLUDED.is_active,
  sort_order         = EXCLUDED.sort_order;

-- ── The free week, as a plan row ────────────────────────────────────────────
--
-- It is not something anybody subscribes to — `profiles.trial_expires_at`
-- decides who is in it — but it is shown on the pricing page as the first
-- card, and the WhatsApp entitlement function reads its daily allowance from
-- here like every other plan.

UPDATE public.billing_plans SET
  name        = 'Free week',
  description = '7 days with every section open — no card, no commitment',
  price_monthly_usd = 0,
  features = '["Every section of Visionex, for 7 days","The assistant on WhatsApp and on the site","200 assistant requests a day","No payment details required"]'::jsonb,
  limits = limits
    || jsonb_build_object('trial_days', public.trial_period_days())
    || jsonb_build_object('whatsapp_daily_messages', 200)
    || jsonb_build_object('sections', jsonb_build_array(
         'news','community','assistive','assistant','academy','library','arcade','marketplace',
         'kids','career','tv','radio','messages','simulations',
         'mediaStudio','studio','professional','finance')),
  is_active  = true,
  sort_order = 0
WHERE id = 'free_trial';

-- ── Retiring the old plans without stranding anybody ────────────────────────
--
-- Moved *up*, never down: `basic` gains every Silver section for less money,
-- `pro` and `enterprise` become Gold. Remaining credits are kept with
-- GREATEST, so a subscriber who had bought 100,000 VX still has them; only the
-- monthly grant changes from here on.

UPDATE public.user_subscriptions s SET
  plan_id = CASE s.plan_id WHEN 'basic' THEN 'silver' ELSE 'gold' END,
  vx_credits_remaining = GREATEST(
    s.vx_credits_remaining,
    (SELECT p.vx_credits_monthly FROM public.billing_plans p
      WHERE p.id = CASE s.plan_id WHEN 'basic' THEN 'silver' ELSE 'gold' END)
  ),
  updated_at = now()
WHERE s.plan_id IN ('basic', 'pro', 'enterprise')
  AND s.status = 'active';

UPDATE public.users_billing SET
  active_plan_id = CASE active_plan_id WHEN 'basic' THEN 'silver' ELSE 'gold' END
WHERE active_plan_id IN ('basic', 'pro', 'enterprise');

-- Kept as rows because `user_subscriptions.plan_id` references them and a
-- cancelled subscription is history worth keeping; hidden everywhere because
-- every reader filters on `is_active`.
UPDATE public.billing_plans SET is_active = false
WHERE id IN ('basic', 'pro', 'enterprise');

-- ── What a signed-in account may open ───────────────────────────────────────
--
-- Takes no argument on purpose. An RPC the browser can call with somebody
-- else's user id is an RPC that will eventually be called with somebody else's
-- user id; `auth.uid()` is the only subject this can answer for.

CREATE OR REPLACE FUNCTION public.my_plan_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id    uuid := auth.uid();
  _expires    timestamptz;
  _plan_id    text;
  _plan_name  text;
  _price      numeric;
  _sections   jsonb;
  _trial      boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('signed_in', false, 'trial_active', false, 'plan', 'none',
                              'plan_name', 'Free', 'sections', '[]'::jsonb);
  END IF;

  SELECT p.trial_expires_at INTO _expires
    FROM public.profiles p WHERE p.user_id = _user_id;

  _trial := _expires IS NOT NULL AND _expires > now();

  IF _trial THEN
    _plan_id := 'free_trial';
  ELSE
    SELECT s.plan_id INTO _plan_id
      FROM public.user_subscriptions s
     WHERE s.user_id = _user_id
       AND s.status = 'active'
       AND (s.ends_at IS NULL OR s.ends_at > now())
     ORDER BY s.started_at DESC
     LIMIT 1;
  END IF;

  IF _plan_id IS NOT NULL THEN
    SELECT b.name, b.price_monthly_usd, COALESCE(b.limits -> 'sections', '[]'::jsonb)
      INTO _plan_name, _price, _sections
      FROM public.billing_plans b
     WHERE b.id = _plan_id AND b.is_active;
  END IF;

  -- No plan, a lapsed one, or one an admin deactivated: the free floor. The
  -- sections named here are the ones that stay open without a subscription,
  -- and they are the same three `FREE_SECTIONS` names in the client catalogue.
  IF _plan_name IS NULL THEN
    _plan_id   := 'none';
    _plan_name := 'Free';
    _price     := 0;
    _sections  := jsonb_build_array('news', 'community', 'assistive');
  END IF;

  RETURN jsonb_build_object(
    'signed_in',     true,
    'trial_active',  _trial,
    'trial_ends_at', _expires,
    'plan',          _plan_id,
    'plan_name',     _plan_name,
    'price_usd',     COALESCE(_price, 0),
    'sections',      COALESCE(_sections, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.my_plan_access() IS
  'Which sections the signed-in account may open, and whether it is still in its free week. Answers only for auth.uid().';

REVOKE ALL ON FUNCTION public.my_plan_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_plan_access() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_plan_access() TO authenticated, service_role;

-- ── The same answer, for one section, server-side ───────────────────────────

CREATE OR REPLACE FUNCTION public.my_section_access(_section text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.my_plan_access() -> 'sections' @> to_jsonb(_section), false)
$$;

COMMENT ON FUNCTION public.my_section_access(text) IS
  'True when the signed-in account may open this section. For server-side checks that should not restate the tier lists.';

REVOKE ALL ON FUNCTION public.my_section_access(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_section_access(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_section_access(text) TO authenticated, service_role;

-- ── WhatsApp, during and after the week ─────────────────────────────────────
--
-- Replaces the version added with the entitlement system so the free week is
-- honoured on WhatsApp too: a linked number whose account is still inside its
-- week gets the trial allowance rather than the twenty-a-day floor, without
-- needing a subscription row that does not exist yet.
--
-- Everything else is unchanged, including the two decisions that matter: the
-- answer still carries no user id, email or name, and a lapsed subscription
-- still falls back to the free allowance rather than to a locked door.

CREATE OR REPLACE FUNCTION public.whatsapp_entitlements(_wa_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id   uuid;
  _expires   timestamptz;
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
    SELECT p.trial_expires_at INTO _expires
      FROM public.profiles p WHERE p.user_id = _user_id;

    IF _expires IS NOT NULL AND _expires > now() THEN
      _plan_id := 'free_trial';
    ELSE
      SELECT s.plan_id INTO _plan_id
        FROM public.user_subscriptions s
       WHERE s.user_id = _user_id
         AND s.status = 'active'
         AND (s.ends_at IS NULL OR s.ends_at > now())
       ORDER BY s.started_at DESC
       LIMIT 1;
    END IF;
  END IF;

  IF _plan_id IS NOT NULL THEN
    SELECT p.name, COALESCE((p.limits ->> 'whatsapp_daily_messages')::integer, 0)
      INTO _plan_name, _limit
      FROM public.billing_plans p
     WHERE p.id = _plan_id AND p.is_active;
  END IF;

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
  'What a number may do today: plan, daily limit, used, remaining — the free week included. Carries no user id, email or name by design. Service role only.';

REVOKE ALL ON FUNCTION public.whatsapp_entitlements(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_entitlements(text) FROM anon;
REVOKE ALL ON FUNCTION public.whatsapp_entitlements(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_entitlements(text) TO service_role;

-- ── Who to warn, a day before the week ends ─────────────────────────────────
--
-- The warning used to go out three days ahead and the cron job found its
-- recipients with a range query the Edge Function assembled itself. A day is
-- what was asked for, and a function is what the job should ask: the window
-- and the "not already warned" rule belong next to the column they read.

CREATE OR REPLACE FUNCTION public.trial_ending_soon(_hours integer DEFAULT 24)
RETURNS TABLE (user_id uuid, display_name text, trial_expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.trial_expires_at
    FROM public.profiles p
   WHERE p.trial_expires_at IS NOT NULL
     AND p.trial_billing_warned_at IS NULL
     AND p.trial_expires_at > now()
     AND p.trial_expires_at <= now() + (GREATEST(COALESCE(_hours, 24), 1) || ' hours')::interval
   ORDER BY p.trial_expires_at
   LIMIT 500
$$;

COMMENT ON FUNCTION public.trial_ending_soon(integer) IS
  'Accounts whose free week ends within the given hours and that have not been warned yet. Service role only: it is a list of people.';

REVOKE ALL ON FUNCTION public.trial_ending_soon(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trial_ending_soon(integer) FROM anon;
REVOKE ALL ON FUNCTION public.trial_ending_soon(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.trial_ending_soon(integer) TO service_role;

CREATE INDEX IF NOT EXISTS profiles_trial_warning_idx
  ON public.profiles (trial_expires_at)
  WHERE trial_billing_warned_at IS NULL;
