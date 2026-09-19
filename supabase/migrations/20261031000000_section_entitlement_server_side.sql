-- Whether a plan opens a section, answered where a browser cannot argue with it.
--
-- `plans.ts` decides which sections a plan opens, and `PlanGate` uses it to
-- decide what a route renders. That is the whole enforcement story today, and
-- it is a rendering decision, not a permission: `image-generate` — which only
-- Business opens, because it is the one that costs real money to run — has no
-- reference to `user_subscriptions`, `billing_plans` or a plan id anywhere in
-- it. An account on Basic with a session token can call it directly and it
-- runs. The VX meter is not the missing check either: it asks whether the
-- caller can *pay*, not whether their plan includes the service at all.
--
-- So the same question gets an answer in SQL, where the caller cannot reach
-- past it. The resolution order is copied from `whatsapp_entitlements` rather
-- than reinvented, so the site and WhatsApp cannot disagree about who is on
-- what plan:
--
--   owner number / admin → everything
--   profiles.trial_expires_at in the future → the free week, every section
--   newest active subscription whose ends_at has not passed → that plan
--   otherwise → the free sections
--
-- Nothing here grants access that `plans.ts` does not already grant. It is the
-- same rule, enforced a second time on the side the user does not control.

-- ── The sections an account keeps with no subscription ─────────────────────
--
-- Mirrors FREE_SECTIONS in src/lib/billing/plans.ts. Two copies, pinned
-- against each other by a test, for the same reason the tier lists are: the
-- database has to answer without the client, and the client has to answer
-- without a round trip.
CREATE OR REPLACE FUNCTION public.free_sections()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT ARRAY['news', 'community', 'assistive']::text[] $$;

COMMENT ON FUNCTION public.free_sections() IS
  'The sections an account with no subscription keeps. Mirrors FREE_SECTIONS in src/lib/billing/plans.ts; section-entitlement.test.ts pins the two together.';

-- ── Which plan an account is on, by the same rules as WhatsApp ─────────────

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

  -- An admin is not on a plan; they are staff. Same answer the WhatsApp
  -- entitlement reader gives, so a support account behaves the same in both
  -- places.
  IF public.has_role(_user_id, 'admin') THEN RETURN 'admin'; END IF;

  SELECT p.trial_expires_at INTO _expires
    FROM public.profiles p WHERE p.user_id = _user_id;

  IF _expires IS NOT NULL AND _expires > now() THEN
    RETURN 'free_trial';
  END IF;

  SELECT s.plan_id INTO _plan_id
    FROM public.user_subscriptions s
   WHERE s.user_id = _user_id
     AND s.status = 'active'
     AND (s.ends_at IS NULL OR s.ends_at > now())
   ORDER BY s.started_at DESC
   LIMIT 1;

  -- A subscription pointing at a deactivated plan is not a subscription.
  IF _plan_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.billing_plans WHERE id = _plan_id AND is_active)
  THEN
    RETURN _plan_id;
  END IF;

  RETURN 'none';
END;
$$;

COMMENT ON FUNCTION public.plan_for_user(uuid) IS
  'The plan id an account is on: admin, free_trial, a billing_plans id, or none. Same resolution order as whatsapp_entitlements, so the site and WhatsApp cannot disagree.';

-- ── The sections that plan opens ───────────────────────────────────────────

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
    -- Every section any plan names, rather than a second hard-coded list.
    SELECT COALESCE(array_agg(DISTINCT s), public.free_sections())
      INTO _sections
      FROM public.billing_plans p,
           LATERAL jsonb_array_elements_text(COALESCE(p.limits -> 'sections', '[]'::jsonb)) AS s;
    RETURN _sections;
  END IF;

  IF _plan = 'none' THEN RETURN public.free_sections(); END IF;

  SELECT array_agg(s) INTO _sections
    FROM public.billing_plans p,
         LATERAL jsonb_array_elements_text(COALESCE(p.limits -> 'sections', '[]'::jsonb)) AS s
   WHERE p.id = _plan AND p.is_active;

  -- A plan row with no section list is a misconfiguration, not a licence.
  -- Falling back to the free set costs revenue; falling back to everything
  -- would give it away.
  RETURN COALESCE(_sections, public.free_sections());
END;
$$;

COMMENT ON FUNCTION public.user_sections(uuid) IS
  'The sections an account may open, read from billing_plans.limits. Falls back to free_sections() for an unknown or misconfigured plan — never to everything.';

CREATE OR REPLACE FUNCTION public.user_has_section(_user_id uuid, _section text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT _section = ANY (public.user_sections(_user_id)) $$;

COMMENT ON FUNCTION public.user_has_section(uuid, text) IS
  'Server-side answer to "does this account''s plan open this section". Called by Edge Functions before doing paid work; the browser cannot reach past it.';

-- ── Who may ask ────────────────────────────────────────────────────────────
--
-- These take a user id, so an account that could call them for an arbitrary id
-- would learn other people's plans. Only the service role — which is only ever
-- held by an Edge Function that has already verified a JWT — may.
REVOKE ALL ON FUNCTION public.plan_for_user(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_sections(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_has_section(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_for_user(uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION public.user_sections(uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION public.user_has_section(uuid, text) TO service_role;

-- free_sections() names no account and reads no table, so it is safe to call
-- and useful to a signed-in client that wants to render the free set.
REVOKE ALL ON FUNCTION public.free_sections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.free_sections() TO authenticated, service_role;
