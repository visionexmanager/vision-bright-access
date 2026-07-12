-- ============================================================
-- Allow any VX coin purchase amount, not just the 6 fixed
-- packages — create_vx_coin_order's price list was a hardcoded
-- CASE over exactly {10000,50000,100000,150000,200000,500000}.
-- The storefront now lets the buyer type a custom amount, so the
-- server-side validation moves from "is this one of 6 exact
-- values" to "is this a positive multiple of 1000 within sane
-- bounds" — still never trusting a client-supplied price, just
-- deriving it from a formula instead of a lookup table.
-- Must stay in sync with COINS_PER_USD in coinsSystem.ts.
-- ============================================================

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

  -- 1,000 VX = $1 (COINS_PER_USD in coinsSystem.ts). Whole-dollar
  -- amounts only, min $1 / max $5,000.
  IF _coins IS NULL OR _coins < 1000 OR _coins > 5000000 OR _coins % 1000 <> 0 THEN
    RAISE EXCEPTION 'Invalid coin amount';
  END IF;

  _price := _coins / 1000;
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
