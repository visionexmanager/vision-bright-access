-- Final plan pricing, agreed 2026-09-28.
--
--   Kids      $3  →  3,000 VX a month
--   Basic     $5  →  5,000 VX
--   Pro      $10  → 11,000 VX   (10,000 + 10% bonus, the bonus included)
--   Business $20  → 24,000 VX   (20,000 + 20% bonus, the bonus included)
--
-- One dollar buys 1,000 VX. The bonus is inside the advertised figure and is
-- never applied again: vx_credits_monthly holds the final number, and nothing
-- anywhere multiplies it by a bonus (src/lib/billing/plans.ts derives it once,
-- and plan-pricing.test.ts pins both).
--
-- Constrained to the four plan ids. No other plan row, no user, no
-- subscription, no user_points row and no historical order is rewritten.
--
-- Existing orders are handled deliberately rather than by accident:
--
--   * An order's price was already fixed when it was placed (price_usd). Its
--     VX was not: approve_subscription_order read the plan row at approval
--     time. So a Pro order placed at $7 for 12,000 VX, approved after this
--     migration, would have granted 11,000. An order's terms are now fixed
--     when it is placed — price and VX both — and every order still pending
--     keeps the VX of the plan it was priced under.
--   * Approved subscriptions are untouched: their VX was granted into
--     user_points at approval, for every month paid, and their period stays.
--   * A renewal or a new order is priced, and granted, under the new terms.

-- ── 1. An order's VX is part of its terms ───────────────────────────────────

ALTER TABLE public.subscription_orders
  ADD COLUMN IF NOT EXISTS vx_credits_monthly integer;

ALTER TABLE public.subscription_orders DROP CONSTRAINT IF EXISTS subscription_orders_vx_credits_monthly_check;
ALTER TABLE public.subscription_orders ADD CONSTRAINT subscription_orders_vx_credits_monthly_check
  CHECK (vx_credits_monthly IS NULL OR vx_credits_monthly >= 0);

COMMENT ON COLUMN public.subscription_orders.vx_credits_monthly IS
  'The monthly VX this order was placed for, fixed with its price. NULL only on orders reviewed before 20261057000000, whose VX was read from the plan at approval.';

-- Orders still pending keep the VX of the plan they were priced under. This
-- runs before the plan rows change, and touches only rows not yet stamped, so
-- a second run changes nothing.
UPDATE public.subscription_orders AS o
   SET vx_credits_monthly = COALESCE(b.vx_credits_monthly, 0)
  FROM public.billing_plans AS b
 WHERE b.id = o.plan_id
   AND o.status = 'pending'
   AND o.vx_credits_monthly IS NULL;

-- ── 2. The four plans ───────────────────────────────────────────────────────
--
-- Price and monthly VX, and the one line of the plan card that states the VX
-- ("11,000 VX a month"). Any other feature line — including one an admin wrote
-- — is kept as it is, in its place. Kids had no VX line; it gets one before its
-- daily-requests line, where the other plans carry theirs.

DO $$
DECLARE
  _plan record;
  _current jsonb;
  _line text;
  _out jsonb;
  _feature text;
  _placed boolean;
BEGIN
  FOR _plan IN
    SELECT * FROM (VALUES
      ('kids',      3,  3000),
      ('basic',     5,  5000),
      ('pro',      10, 11000),
      ('business', 20, 24000)
    ) AS v(id, price, vx)
  LOOP
    SELECT features INTO _current FROM public.billing_plans WHERE id = _plan.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'billing_plans row % is missing; the plan migrations before this one create it', _plan.id;
    END IF;

    _line := to_char(_plan.vx, 'FM999,999') || ' VX a month';
    _out := '[]'::jsonb;
    _placed := false;
    FOR _feature IN
      SELECT f.value FROM jsonb_array_elements_text(COALESCE(_current, '[]'::jsonb)) WITH ORDINALITY AS f(value, n) ORDER BY f.n
    LOOP
      IF _feature ~ '^[0-9][0-9,]* VX (a month|credits/month)$' THEN
        IF NOT _placed THEN
          _out := _out || to_jsonb(_line);
          _placed := true;
        END IF;
      ELSIF NOT _placed AND _feature ~ '(assistant requests a day|No daily limit on the assistant)$' THEN
        _out := _out || to_jsonb(_line) || to_jsonb(_feature);
        _placed := true;
      ELSE
        _out := _out || to_jsonb(_feature);
      END IF;
    END LOOP;
    IF NOT _placed THEN
      _out := _out || to_jsonb(_line);
    END IF;

    UPDATE public.billing_plans
       SET price_monthly_usd  = _plan.price,
           vx_credits_monthly = _plan.vx,
           features           = _out
     WHERE id = _plan.id;
  END LOOP;
END;
$$;

-- ── 3. Placing an order fixes its VX with its price ─────────────────────────
--
-- The body of 20261013000000, with the plan's monthly VX read alongside its
-- price and stored on the order — on a new order and on the pending order a
-- second press updates.

CREATE OR REPLACE FUNCTION public.create_subscription_order(
  _plan_id text,
  _payment_method text,
  _months integer DEFAULT 1
)
RETURNS public.subscription_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _price numeric(10,2);
  _vx integer;
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

  SELECT b.price_monthly_usd * _months, COALESCE(b.vx_credits_monthly, 0) INTO _price, _vx
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
       SET payment_method = _payment_method, months = _months, price_usd = _price, vx_credits_monthly = _vx
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
      INSERT INTO public.subscription_orders (user_id, plan_id, months, price_usd, vx_credits_monthly, payment_method, reference_code)
      VALUES (_uid, _plan_id, _months, _price, _vx, _payment_method,
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

REVOKE ALL ON FUNCTION public.create_subscription_order(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_subscription_order(text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_subscription_order(text, text, integer) TO authenticated, service_role;

-- ── 4. Approval grants the VX the order was placed for ──────────────────────
--
-- The body of 20261034000000, with one change: the monthly VX comes from the
-- order (its terms), falling back to the plan only for an order reviewed before
-- this migration stamped it — which cannot be pending, so in practice never.

CREATE OR REPLACE FUNCTION public.approve_subscription_order(
  _order_id uuid,
  _admin_notes text DEFAULT NULL
)
RETURNS public.subscription_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order public.subscription_orders;
  _plan public.billing_plans;
  _vx integer;
  _starts timestamptz;
  _ends timestamptz;
  _sub_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO _order FROM public.subscription_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF _order.status <> 'pending' THEN
    RAISE EXCEPTION 'Order already reviewed';
  END IF;

  SELECT * INTO _plan FROM public.billing_plans WHERE id = _order.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  -- The VX the customer was quoted when they placed the order.
  _vx := COALESCE(_order.vx_credits_monthly, _plan.vx_credits_monthly, 0);

  -- A renewal paid before the period is out adds the months paid for to the
  -- days that are left rather than throwing them away. A change of plan starts
  -- today.
  SELECT max(s.ends_at) INTO _starts
    FROM public.user_subscriptions s
   WHERE s.user_id = _order.user_id AND s.plan_id = _order.plan_id
     AND s.status = 'active' AND s.ends_at > now();
  _starts := GREATEST(COALESCE(_starts, now()), now());
  _ends := _starts + make_interval(months => _order.months);

  UPDATE public.user_subscriptions
     SET status = 'cancelled', cancelled_at = now(), updated_at = now()
   WHERE user_id = _order.user_id AND status = 'active';

  INSERT INTO public.user_subscriptions
    (user_id, plan_id, status, started_at, ends_at, next_renewal_at,
     vx_credits_remaining, vx_reset_at, external_sub_id)
  VALUES
    (_order.user_id, _order.plan_id, 'active', now(), _ends, _ends,
     _vx, now() + interval '30 days',
     'manual:' || _order.reference_code)
  RETURNING id INTO _sub_id;

  IF _vx > 0 THEN
    -- Into `user_points`, the one ledger. It is append-only and the balance
    -- is its sum, so this is the whole of the operation: no wallet row to
    -- keep in step, and nothing that can disagree with what `vx_reserve`
    -- reads a moment later.
    INSERT INTO public.user_points (user_id, points, reason)
    VALUES (
      _order.user_id,
      _vx * _order.months,
      'VX subscription: ' || _order.plan_id || ' x ' || _order.months || ' month(s)'
    );
  END IF;

  UPDATE public.users_billing
     SET active_plan_id = _order.plan_id, is_in_trial = false, updated_at = now()
   WHERE user_id = _order.user_id;

  UPDATE public.subscription_orders
     SET status = 'approved', subscription_id = _sub_id,
         reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = _admin_notes
   WHERE id = _order_id
  RETURNING * INTO _order;

  INSERT INTO public.notifications (user_id, title, body, type, category, sent_by)
  VALUES (
    _order.user_id,
    'تم تفعيل اشتراكك — ' || _plan.name || ' plan is active',
    'تم تأكيد الدفع للطلب ' || _order.reference_code || ' — payment confirmed.',
    'success',
    'subscription',
    auth.uid()
  );

  RETURN _order;
END;
$$;
COMMENT ON FUNCTION public.approve_subscription_order(uuid, text) IS
  'Admin-only. Activates a paid subscription and grants the monthly VX the order was placed for into user_points — the one ledger vx_balance sums. Refuses an order that is not pending, so a replayed approval cannot grant twice.';

REVOKE ALL ON FUNCTION public.approve_subscription_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_subscription_order(uuid, text) TO authenticated, service_role;
