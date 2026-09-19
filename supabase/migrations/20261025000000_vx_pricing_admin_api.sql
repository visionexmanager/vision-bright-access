-- The one way an admin changes a price.
--
-- `central_pricing_registry` has a SELECT policy and no write policy, which is
-- the same posture every money-adjacent table in this repository takes: writes
-- go through a SECURITY DEFINER function so there is a single entry point to
-- validate in, and a single one to audit. The trigger from 20261023 records the
-- result whichever path is used; this is the path the screen uses.
--
-- Validation lives here rather than in the browser for the obvious reason, and
-- one rule is worth naming: `vx_price` may be zero (a capability the platform
-- absorbs) but never negative, because a negative price is a way to mint VX.

CREATE OR REPLACE FUNCTION public.admin_set_service_pricing(
  _service_id      text,
  _vx_price        integer DEFAULT NULL,
  _free_limit      integer DEFAULT NULL,
  _max_daily_usage integer DEFAULT NULL,
  _plan_limits     jsonb   DEFAULT NULL,
  _enabled         boolean DEFAULT NULL,
  _admin_only      boolean DEFAULT NULL,
  _base_cost       numeric DEFAULT NULL,
  _provider        text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.central_pricing_registry%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admins_only');
  END IF;

  -- A negative price is a way to mint VX, and a negative allowance is a way to
  -- charge for something that has not happened.
  IF _vx_price IS NOT NULL AND _vx_price < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'negative_price');
  END IF;
  IF _free_limit IS NOT NULL AND _free_limit < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'negative_free_limit');
  END IF;
  IF _max_daily_usage IS NOT NULL AND _max_daily_usage <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_daily_ceiling');
  END IF;
  IF _base_cost IS NOT NULL AND _base_cost < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'negative_base_cost');
  END IF;
  -- plan_limits is read with `?` and `->>`, so anything but an object would
  -- fail at reserve time rather than here, which is the wrong moment.
  IF _plan_limits IS NOT NULL AND jsonb_typeof(_plan_limits) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_limits_must_be_an_object');
  END IF;

  UPDATE public.central_pricing_registry SET
    vx_price        = COALESCE(_vx_price, vx_price),
    free_limit      = COALESCE(_free_limit, free_limit),
    -- NULL means "no ceiling", so it cannot be cleared by passing NULL. A
    -- caller that wants no ceiling passes a negative number, which the check
    -- above refuses — clearing one is a deliberate SQL statement, not a slip
    -- in a form.
    max_daily_usage = COALESCE(_max_daily_usage, max_daily_usage),
    plan_limits     = COALESCE(_plan_limits, plan_limits),
    enabled         = COALESCE(_enabled, enabled),
    admin_only      = COALESCE(_admin_only, admin_only),
    base_cost       = COALESCE(_base_cost, base_cost),
    provider        = COALESCE(_provider, provider),
    updated_at      = now()
  WHERE service_id = _service_id
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_service');
  END IF;

  RETURN jsonb_build_object('ok', true, 'service_id', _row.service_id,
                            'vx_price', _row.vx_price, 'enabled', _row.enabled);
END;
$$;

COMMENT ON FUNCTION public.admin_set_service_pricing(text, integer, integer, integer, jsonb, boolean, boolean, numeric, text) IS
  'The one write path for central_pricing_registry. Admin-gated, validated, and audited by the trigger on the table.';

REVOKE ALL ON FUNCTION public.admin_set_service_pricing(text, integer, integer, integer, jsonb, boolean, boolean, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_service_pricing(text, integer, integer, integer, jsonb, boolean, boolean, numeric, text)
  TO authenticated, service_role;
