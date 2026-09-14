-- ============================================================
-- Subscription orders — paid through the owner on WhatsApp
--
-- There is no card processor for plans. A subscriber picks a plan and a way to
-- pay, and for how many months. An order is filed here. A card payment opens
-- WhatsApp with the order already written, and the owner sends a payment link;
-- an OMT or Whish transfer is sent to the owner's number, shown on the page.
-- The owner confirms the money arrived and approves the order, and approval is
-- the only thing that activates a plan — for the months that were paid.
--
-- The price is read from billing_plans, never from the client. There is no
-- client INSERT or UPDATE policy: every write goes through the functions below.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscription_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.billing_plans(id),
  months integer NOT NULL DEFAULT 1 CHECK (months IN (1, 3, 6, 12)),
  price_usd numeric(10,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('omt', 'whish', 'card')),
  reference_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_orders_own_read" ON public.subscription_orders;
CREATE POLICY "subscription_orders_own_read"
  ON public.subscription_orders FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "subscription_orders_admin_read" ON public.subscription_orders;
CREATE POLICY "subscription_orders_admin_read"
  ON public.subscription_orders FOR SELECT TO authenticated
  USING ((select public.has_role((select auth.uid()), 'admin')));

CREATE INDEX IF NOT EXISTS idx_subscription_orders_status ON public.subscription_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_user ON public.subscription_orders(user_id);

-- The owner's number: where WhatsApp opens for a card payment, and where an
-- OMT or Whish transfer is sent. Public on purpose — the checkout page prints
-- it — and kept apart from `owner_contact`, which is private. Seeded with the
-- number the owner gave; changed in Admin → Settings, never here.
INSERT INTO public.site_settings (key, value)
SELECT 'subscription_payment_whatsapp', '"+96170750609"'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'subscription_payment_whatsapp');

-- ── create_subscription_order — subscriber-invoked ──────────────────────
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
       SET payment_method = _payment_method, months = _months, price_usd = _price
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
      INSERT INTO public.subscription_orders (user_id, plan_id, months, price_usd, payment_method, reference_code)
      VALUES (_uid, _plan_id, _months, _price, _payment_method,
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

-- ── approve_subscription_order — admin-invoked, after the money arrived ──
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
    PERFORM public.billing_grant_credits(
      _order.user_id, _plan.vx_credits_monthly * _order.months, 'subscription_grant',
      _plan.name || ' plan: credits for ' || _order.months || ' month(s)'
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

REVOKE ALL ON FUNCTION public.approve_subscription_order(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_subscription_order(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_subscription_order(uuid, text) TO authenticated, service_role;

-- ── reject_subscription_order — admin-invoked ───────────────────────────
CREATE OR REPLACE FUNCTION public.reject_subscription_order(
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

  UPDATE public.subscription_orders
     SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = _admin_notes
   WHERE id = _order_id
  RETURNING * INTO _order;

  INSERT INTO public.notifications (user_id, title, body, type, category, sent_by)
  VALUES (
    _order.user_id,
    'تعذّر تأكيد طلب الاشتراك — subscription order not confirmed',
    coalesce('السبب / Reason: ' || _order.admin_notes, 'الطلب ' || _order.reference_code || ' — order not confirmed.'),
    'error',
    'subscription',
    auth.uid()
  );

  RETURN _order;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_subscription_order(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_subscription_order(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_subscription_order(uuid, text) TO authenticated, service_role;
