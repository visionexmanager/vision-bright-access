-- ============================================================
-- VX Coin purchases — manual-verification checkout
-- (WishMoney / OMT / PayPal — none of the three have a merchant
--  API/webhook available, so payment is verified by an admin
--  reviewing a buyer-submitted reference code + optional proof
--  screenshot, not by an automated payment-provider callback.)
--
-- Package prices are intentionally hardcoded inside
-- create_vx_coin_order() rather than trusted from the client —
-- same "don't trust client-supplied amount" principle already
-- used by award_points()'s reason whitelist. Keep in sync with
-- COIN_PACKAGES / PLATFORM_FEE_RATE in src/systems/coinsSystem.ts.
-- ============================================================

CREATE TABLE public.vx_coin_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coins integer NOT NULL,
  price_usd numeric(10,2) NOT NULL,
  fee_usd numeric(10,2) NOT NULL,
  total_usd numeric(10,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('wishmoney', 'omt', 'paypal')),
  reference_code text NOT NULL,
  proof_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vx_coin_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coin orders"
  ON public.vx_coin_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all coin orders"
  ON public.vx_coin_orders FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- No client INSERT/UPDATE policy — all writes go through the
-- SECURITY DEFINER RPCs below (same convention as vx_purchases).

CREATE INDEX idx_vx_coin_orders_status ON public.vx_coin_orders(status);
CREATE INDEX idx_vx_coin_orders_user ON public.vx_coin_orders(user_id);

-- ── create_vx_coin_order — buyer-invoked ────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_vx_coin_order(
  _coins integer,
  _payment_method text,
  _reference_code text,
  _proof_url text DEFAULT NULL
)
RETURNS public.vx_coin_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _price numeric(10,2);
  _fee numeric(10,2);
  _total numeric(10,2);
  _order public.vx_coin_orders;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _payment_method NOT IN ('wishmoney', 'omt', 'paypal') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  IF _reference_code IS NULL OR length(trim(_reference_code)) = 0 THEN
    RAISE EXCEPTION 'Reference code is required';
  END IF;

  -- Fixed package price list — must match COIN_PACKAGES in coinsSystem.ts
  _price := CASE _coins
    WHEN 10000  THEN 10
    WHEN 50000  THEN 50
    WHEN 100000 THEN 100
    WHEN 150000 THEN 150
    WHEN 200000 THEN 200
    WHEN 500000 THEN 500
    ELSE NULL
  END;

  IF _price IS NULL THEN
    RAISE EXCEPTION 'Invalid package';
  END IF;

  -- Must match PLATFORM_FEE_RATE (0.05) in coinsSystem.ts
  _fee := round(_price * 0.05, 2);
  _total := _price + _fee;

  INSERT INTO public.vx_coin_orders (user_id, coins, price_usd, fee_usd, total_usd, payment_method, reference_code, proof_url)
  VALUES (auth.uid(), _coins, _price, _fee, _total, _payment_method, trim(_reference_code), _proof_url)
  RETURNING * INTO _order;

  RETURN _order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_vx_coin_order(integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_vx_coin_order(integer, text, text, text) TO authenticated;

-- ── approve_vx_coin_order — admin-invoked ───────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_vx_coin_order(
  _order_id uuid,
  _admin_notes text DEFAULT NULL
)
RETURNS public.vx_coin_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order public.vx_coin_orders;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO _order FROM public.vx_coin_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF _order.status <> 'pending' THEN
    RAISE EXCEPTION 'Order already reviewed';
  END IF;

  INSERT INTO public.user_points (user_id, points, reason)
  VALUES (_order.user_id, _order.coins, 'VX Coin Purchase: ' || _order.payment_method || ' (' || _order.reference_code || ')');

  UPDATE public.vx_coin_orders
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = _admin_notes
  WHERE id = _order_id
  RETURNING * INTO _order;

  INSERT INTO public.notifications (user_id, title, body, type, category, sent_by)
  VALUES (
    _order.user_id,
    'تم تأكيد عملية الشحن',
    'تمت إضافة ' || _order.coins || ' VX إلى رصيدك.',
    'success',
    'vx_purchase',
    auth.uid()
  );

  RETURN _order;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_vx_coin_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_vx_coin_order(uuid, text) TO authenticated;

-- ── reject_vx_coin_order — admin-invoked ────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_vx_coin_order(
  _order_id uuid,
  _admin_notes text DEFAULT NULL
)
RETURNS public.vx_coin_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order public.vx_coin_orders;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO _order FROM public.vx_coin_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF _order.status <> 'pending' THEN
    RAISE EXCEPTION 'Order already reviewed';
  END IF;

  UPDATE public.vx_coin_orders
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = _admin_notes
  WHERE id = _order_id
  RETURNING * INTO _order;

  INSERT INTO public.notifications (user_id, title, body, type, category, sent_by)
  VALUES (
    _order.user_id,
    'تعذّر تأكيد عملية الشحن',
    coalesce('السبب: ' || _order.admin_notes, 'يرجى مراجعة بيانات التحويل والمحاولة مرة أخرى.'),
    'error',
    'vx_purchase',
    auth.uid()
  );

  RETURN _order;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_vx_coin_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_vx_coin_order(uuid, text) TO authenticated;

-- ── payment-proofs storage bucket ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-proofs', 'payment-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "payment_proofs_owner_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "payment_proofs_owner_or_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  );
