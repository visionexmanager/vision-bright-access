-- The free week no longer opens every section.
--
-- Until now `free_trial` meant "every section for seven days": the plan row
-- listed all eighteen sections, `plan_for_user` returned 'free_trial' AHEAD of a
-- paid subscription, `my_plan_access` and `whatsapp_entitlements` each carried
-- their own copy of that resolution, and the WhatsApp assistant had a 200-a-day
-- trial allowance. The product decision is the opposite: the trial has ONLY the
-- capabilities that are explicitly defined for it, and everything else needs a
-- subscription.
--
-- ── What the trial has ─────────────────────────────────────────────────────
--
-- No capability list for the trial was ever written down — the only definition
-- was "everything". So nothing is invented here: `trial_sections()` is the free
-- set (news, community, assistive products) that every account keeps, and it is
-- the ONE place the trial's sections are named. AI services, the WhatsApp
-- assistant and every paid section are not in it. Adding a trial capability is
-- one edit to `trial_sections()` and to TRIAL_SECTIONS in src/lib/billing/plans.ts
-- (subscription-tiers.test.ts pins the two together), and nothing else.
--
-- ── One resolution ─────────────────────────────────────────────────────────
--
--   plan_for_user      admin → an active paid subscription → the trial → none
--   user_sections      what that plan opens (the trial: trial_sections())
--   my_plan_access     the same two, for auth.uid(), as the browser reads it
--   whatsapp_entitlements   the same plan, for a WhatsApp number
--   ai_user_entitled   (20261062) the same plan, against ai_eligible_plans()
--
-- A paid subscription now wins over the trial. It used to lose: somebody who
-- subscribed on day two would have stayed on trial rules until day seven.

-- ── 1. The trial's sections ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trial_sections()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT ARRAY['news', 'community', 'assistive']::text[] $$;

COMMENT ON FUNCTION public.trial_sections() IS
  'The sections the free week opens. Explicit and deliberately equal to free_sections(): the trial is never "every section". Mirrors TRIAL_SECTIONS in src/lib/billing/plans.ts.';

REVOKE ALL ON FUNCTION public.trial_sections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trial_sections() TO authenticated, service_role;

-- ── 2. Which plan an account is on ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.plan_for_user(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expires timestamptz;
  _plan_id text;
BEGIN
  IF _user_id IS NULL THEN RETURN 'none'; END IF;

  -- Staff are not on a plan.
  IF public.has_role(_user_id, 'admin') THEN RETURN 'admin'; END IF;

  -- A paid subscription first. A subscription pointing at a deactivated plan
  -- is not a subscription.
  SELECT s.plan_id INTO _plan_id
    FROM public.user_subscriptions s
   WHERE s.user_id = _user_id
     AND s.status = 'active'
     AND (s.ends_at IS NULL OR s.ends_at > now())
   ORDER BY s.started_at DESC
   LIMIT 1;

  IF _plan_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.billing_plans WHERE id = _plan_id AND is_active)
  THEN
    RETURN _plan_id;
  END IF;

  -- Then the free week.
  SELECT p.trial_expires_at INTO _expires
    FROM public.profiles p WHERE p.user_id = _user_id;

  IF _expires IS NOT NULL AND _expires > now() THEN
    RETURN 'free_trial';
  END IF;

  RETURN 'none';
END;
$$;

COMMENT ON FUNCTION public.plan_for_user(uuid) IS
  'The plan id an account is on: admin, an active paid plan, free_trial, or none — in that order. The one resolution every entitlement answer (sections, WhatsApp, AI) is built on.';

REVOKE ALL ON FUNCTION public.plan_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_for_user(uuid) TO service_role;

-- ── 3. The sections that plan opens ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_sections(_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text := public.plan_for_user(_user_id);
  _sections text[];
BEGIN
  IF _plan = 'admin' THEN
    SELECT COALESCE(array_agg(DISTINCT s), public.free_sections())
      INTO _sections
      FROM public.billing_plans p,
           LATERAL jsonb_array_elements_text(COALESCE(p.limits -> 'sections', '[]'::jsonb)) AS s
     WHERE p.id <> 'free_trial';
    RETURN _sections;
  END IF;

  IF _plan = 'none' THEN RETURN public.free_sections(); END IF;

  -- The trial is answered from its own explicit list, never from the plan row:
  -- a row edit cannot turn the free week back into "every section".
  IF _plan = 'free_trial' THEN RETURN public.trial_sections(); END IF;

  SELECT array_agg(s) INTO _sections
    FROM public.billing_plans p,
         LATERAL jsonb_array_elements_text(COALESCE(p.limits -> 'sections', '[]'::jsonb)) AS s
   WHERE p.id = _plan AND p.is_active;

  -- A plan row with no section list is a misconfiguration, not a licence.
  RETURN COALESCE(_sections, public.free_sections());
END;
$$;

COMMENT ON FUNCTION public.user_sections(uuid) IS
  'The sections an account may open. The trial gets trial_sections(); a paid plan gets billing_plans.limits.sections; anything unknown falls back to free_sections() — never to everything.';

REVOKE ALL ON FUNCTION public.user_sections(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_sections(uuid) TO service_role;

-- ── 4. What the browser reads ──────────────────────────────────────────────
--
-- Same JSON keys as before, but built on the two functions above instead of a
-- third copy of the resolution. `trial_active` now means "this account is on
-- the trial plan", so a subscriber inside their first week no longer sees the
-- trial banner.

CREATE OR REPLACE FUNCTION public.my_plan_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id   uuid := auth.uid();
  _plan_id   text;
  _plan_name text;
  _price     numeric;
  _expires   timestamptz;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('signed_in', false, 'trial_active', false, 'plan', 'none',
                              'plan_name', 'Free', 'sections', '[]'::jsonb);
  END IF;

  _plan_id := public.plan_for_user(_user_id);

  IF _plan_id = 'admin' THEN
    _plan_name := 'Admin'; _price := 0;
  ELSIF _plan_id = 'none' THEN
    _plan_name := 'Free'; _price := 0;
  ELSE
    SELECT b.name, b.price_monthly_usd INTO _plan_name, _price
      FROM public.billing_plans b WHERE b.id = _plan_id AND b.is_active;
    IF _plan_name IS NULL THEN _plan_id := 'none'; _plan_name := 'Free'; _price := 0; END IF;
  END IF;

  IF _plan_id = 'free_trial' THEN
    SELECT p.trial_expires_at INTO _expires FROM public.profiles p WHERE p.user_id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'signed_in',     true,
    'trial_active',  _plan_id = 'free_trial',
    'trial_ends_at', _expires,
    'plan',          _plan_id,
    'plan_name',     _plan_name,
    'price_usd',     COALESCE(_price, 0),
    'sections',      to_jsonb(public.user_sections(_user_id))
  );
END;
$$;

COMMENT ON FUNCTION public.my_plan_access() IS
  'Which sections the signed-in account may open, and whether it is on the free week. Built on plan_for_user and user_sections. Answers only for auth.uid().';

REVOKE ALL ON FUNCTION public.my_plan_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_plan_access() TO authenticated, service_role;

-- ── 5. WhatsApp ────────────────────────────────────────────────────────────
--
-- The same plan as the site. The trial has no WhatsApp assistant, so its old
-- 200-a-day allowance applies to nothing and is removed from the plan row
-- below. A trial account is answered as not allowed, with a limit of 1 and none
-- remaining — never limit 0, which every caller reads as "unlimited". (The
-- subscription gate refuses a trial sender before this is ever asked; this is
-- the second lock on the same door.)

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

  IF public.whatsapp_is_owner_number(_wa_phone) THEN
    RETURN jsonb_build_object('linked', _user_id IS NOT NULL, 'plan', 'owner', 'plan_name', 'Owner',
                              'daily_limit', 0, 'used_today', 0, 'remaining', -1, 'allowed', true);
  END IF;

  IF _user_id IS NOT NULL THEN
    _plan_id := public.plan_for_user(_user_id);
  END IF;

  IF _plan_id = 'admin' THEN
    RETURN jsonb_build_object('linked', true, 'plan', 'admin', 'plan_name', 'Admin',
                              'daily_limit', 0, 'used_today', 0, 'remaining', -1, 'allowed', true);
  END IF;

  IF _plan_id = 'free_trial' THEN
    RETURN jsonb_build_object('linked', true, 'plan', 'free_trial', 'plan_name', 'Free week',
                              'daily_limit', 1, 'used_today', 1, 'remaining', 0, 'allowed', false);
  END IF;

  IF _plan_id IS NOT NULL AND _plan_id <> 'none' THEN
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
  'What a number may do today, from the same plan_for_user the site uses. The free week is answered as not allowed; the owner handset and admin accounts are unmetered. Carries no user id, email or name. Service role only.';

REVOKE ALL ON FUNCTION public.whatsapp_entitlements(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_entitlements(text) TO service_role;

-- ── 6. The free-week plan row ──────────────────────────────────────────────
--
-- Its section list is the trial's, not the eighteen it used to carry, and its
-- copy no longer promises what it no longer gives. The WhatsApp allowance key is
-- removed rather than set to 0, because 0 means "unlimited" in this table.

UPDATE public.billing_plans SET
  description = '7 days to look around — news, community and assistive products. AI services and the other sections need a plan.',
  features    = '["News, community and assistive products","No card required","Subscribe to unlock AI services and the other sections"]'::jsonb,
  limits      = (limits - 'whatsapp_daily_messages')
                || jsonb_build_object('sections', to_jsonb(public.trial_sections()))
WHERE id = 'free_trial';
