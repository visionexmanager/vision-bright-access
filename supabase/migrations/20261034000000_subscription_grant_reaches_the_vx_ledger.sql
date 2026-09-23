-- A subscription's monthly VX lands where VX is actually kept.
--
-- `approve_subscription_order` grants the plan's allowance with
-- `billing_grant_credits`, and that function writes to `credit_wallets` and
-- `credit_transactions` — the wallet system this phase retired. Nothing reads
-- it. `vx_balance()` sums `user_points`; so do `vx_reserve`, `vx_settle`,
-- `vx_release`, `my_vx_summary`, `usePoints`, `spend_vx` and the Arcade.
--
-- So an approved subscription granted 5,000, 12,000 or 30,000 VX into a ledger
-- with no readers, and the subscriber's spendable balance did not move. It has
-- never fired — production holds zero subscriptions and `credit_wallets` holds
-- six rows totalling zero — but it would have fired on the first paying
-- customer, who would have been charged and given nothing they could spend.
--
-- The grant now goes to `user_points`, in the same shape and with the same
-- reason convention as every other VX movement ("VX reserve: image", "VX
-- refund: image"). `billing_grant_credits` is left alone rather than repointed:
-- it is the wallet system's own function, the wallet system is retired but not
-- dropped, and changing what a retired function does is how a retired system
-- comes back to life by accident.

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
     COALESCE(_plan.vx_credits_monthly, 0), now() + interval '30 days',
     'manual:' || _order.reference_code)
  RETURNING id INTO _sub_id;

  IF COALESCE(_plan.vx_credits_monthly, 0) > 0 THEN
    -- Into `user_points`, the one ledger. It is append-only and the balance
    -- is its sum, so this is the whole of the operation: no wallet row to
    -- keep in step, and nothing that can disagree with what `vx_reserve`
    -- reads a moment later.
    INSERT INTO public.user_points (user_id, points, reason)
    VALUES (
      _order.user_id,
      _plan.vx_credits_monthly * _order.months,
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
  'Admin-only. Activates a paid subscription and grants its monthly VX into user_points — the one ledger vx_balance sums. Refuses an order that is not pending, so a replayed approval cannot grant twice.';

REVOKE ALL ON FUNCTION public.approve_subscription_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_subscription_order(uuid, text) TO authenticated, service_role;
