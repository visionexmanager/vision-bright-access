-- What the Usage screen needs beyond the list of rows: the balance, the plan,
-- the allowance and what has gone today and this month.
--
-- `my_vx_usage()` already returns the ledger rows a customer is owed an account
-- of. It does not say what is left, what the plan allows, or what the month has
-- cost so far — so the screen could show a history without a balance, which is
-- a statement without a bottom line.
--
-- ── Why it takes no arguments ──────────────────────────────────────────────
--
-- The brief for this screen is that nobody may read somebody else's usage by
-- changing an id in the browser. The reliable way to guarantee that is not to
-- validate the id — it is to have no id to validate. This resolves `auth.uid()`
-- internally, so there is no parameter to tamper with, and the same call made
-- by two accounts returns two different answers by construction.
--
-- ── What it deliberately does not return ───────────────────────────────────
--
-- No provider, no `base_cost`, no `actual_cost_usd`, no margin, no row from
-- `central_pricing_registry` beyond the price a customer is charged and the
-- allowance their plan gives. Which vendor served a request, and what it cost
-- Visionex, is not on a customer's statement.

CREATE OR REPLACE FUNCTION public.my_vx_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id  uuid := auth.uid();
  _plan     text;
  _row      public.billing_plans%ROWTYPE;
  _balance  bigint;
  _today    jsonb;
  _month    jsonb;
  _trial    timestamptz;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;

  _plan := public.plan_for_user(_user_id);
  SELECT * INTO _row FROM public.billing_plans WHERE id = _plan AND is_active;
  SELECT p.trial_expires_at INTO _trial FROM public.profiles p WHERE p.user_id = _user_id;

  -- The one balance. `user_points` is the ledger; there is no second store and
  -- no cached column, so this cannot disagree with the Arcade or with spend_vx.
  _balance := public.vx_balance(_user_id);

  -- Consumed is what was kept, not what was held: a reservation that was
  -- refunded never cost anything, and showing it as spent would be wrong.
  SELECT jsonb_build_object(
           'consumed_vx', COALESCE(SUM(consumed_vx), 0),
           'refunded_vx', COALESCE(SUM(refunded_vx), 0),
           'requests',    COUNT(*))
    INTO _today
    FROM public.vx_usage_ledger
   WHERE user_id = _user_id
     AND created_at >= date_trunc('day', now());

  SELECT jsonb_build_object(
           'consumed_vx', COALESCE(SUM(consumed_vx), 0),
           'refunded_vx', COALESCE(SUM(refunded_vx), 0),
           'requests',    COUNT(*))
    INTO _month
    FROM public.vx_usage_ledger
   WHERE user_id = _user_id
     AND created_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'ok',      true,
    'balance_vx', _balance,
    'plan', jsonb_build_object(
      'id',           _plan,
      'name',         COALESCE(_row.name, CASE WHEN _plan = 'admin' THEN 'Admin' ELSE 'Free' END),
      -- The monthly allowance a plan grants, which is what "remaining" is
      -- measured against. Null for a plan that grants none — Kids and Free —
      -- so the screen can say "no monthly allowance" rather than "0 left".
      'monthly_vx',   NULLIF(COALESCE(_row.vx_credits_monthly, 0), 0),
      'whatsapp_daily', (_row.limits ->> 'whatsapp_daily_messages')::integer,
      'is_trial',     _plan = 'free_trial',
      'trial_ends_at', CASE WHEN _plan = 'free_trial' THEN _trial END),
    'today',   _today,
    'month',   _month);
END;
$$;

COMMENT ON FUNCTION public.my_vx_summary() IS
  'The Usage screen''s header: balance, plan, monthly allowance and what today and this month have cost. Takes no argument and resolves auth.uid() internally, so there is no id to tamper with. Returns no provider, no cost and no margin.';

-- A signed-in account, and only about itself.
REVOKE ALL ON FUNCTION public.my_vx_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_vx_summary() TO authenticated, service_role;
