-- Metered VX: reserve by a cost estimate, settle from what the provider calls
-- actually used. Infrastructure only — nothing here turns anything on.
--
--   estimate the maximum provider cost  (the Edge Function, from the price book)
--   → vx_reserve_metered                hold that much VX, converted by policy
--   → the provider calls                each one an ai_usage_events row carrying
--                                       the reservation id
--   → vx_settle_metered                 sum the billable events' provider cost,
--                                       convert it, keep that, refund the rest
--
-- What keeps it inert:
--   * every service still has enabled = false, and none has pricing_mode
--     'metered' — the column defaults to 'fixed', the behaviour of today;
--   * vx_conversion_policy is created EMPTY. With no policy a metered service
--     cannot reserve at all (conversion_not_configured). The USD→VX rate, any
--     multiplier and any minimum are the owner's to set; none is assumed here.
--
-- Money rules, each enforced below and exercised against PGlite:
--   * one reservation per request: the idempotency key is required, and a
--     replay never runs a second job or takes a second hold;
--   * a request is settled once, and never for more than was held;
--   * a request whose calls all failed is released in full;
--   * a failed attempt is billed only if it used billable tokens AND the policy
--     says so (bill_failed_billable_attempts, default false);
--   * a call the book cannot price is never charged — it is counted in the
--     ledger metadata so the gap is visible, not billed at a guessed rate.

-- ── Configuration ───────────────────────────────────────────────────────────

ALTER TABLE public.central_pricing_registry
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS max_reserve_vx integer;

ALTER TABLE public.central_pricing_registry DROP CONSTRAINT IF EXISTS central_pricing_registry_pricing_mode_check;
ALTER TABLE public.central_pricing_registry ADD CONSTRAINT central_pricing_registry_pricing_mode_check
  CHECK (pricing_mode IN ('fixed', 'metered'));
ALTER TABLE public.central_pricing_registry DROP CONSTRAINT IF EXISTS central_pricing_registry_max_reserve_vx_check;
ALTER TABLE public.central_pricing_registry ADD CONSTRAINT central_pricing_registry_max_reserve_vx_check
  CHECK (max_reserve_vx IS NULL OR max_reserve_vx > 0);

COMMENT ON COLUMN public.central_pricing_registry.pricing_mode IS
  'fixed: vx_price per unit (vx_reserve). metered: provider cost converted by vx_conversion_policy (vx_reserve_metered / vx_settle_metered).';
COMMENT ON COLUMN public.central_pricing_registry.max_reserve_vx IS
  'Metered services: the most one request may hold. A request whose worst case is above it is refused before any provider call.';

-- Provider cost → VX. One row per scope: service_id NULL is the default, a
-- service row overrides it. Empty on purpose.
CREATE TABLE IF NOT EXISTS public.vx_conversion_policy (
  id                            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id                    text REFERENCES public.central_pricing_registry (service_id) ON DELETE CASCADE,
  vx_per_usd                    numeric NOT NULL CHECK (vx_per_usd > 0),
  multiplier                    numeric NOT NULL DEFAULT 1 CHECK (multiplier > 0),
  min_charge_vx                 integer NOT NULL DEFAULT 0 CHECK (min_charge_vx >= 0),
  rounding                      text    NOT NULL DEFAULT 'ceil' CHECK (rounding IN ('ceil', 'round', 'floor')),
  bill_failed_billable_attempts boolean NOT NULL DEFAULT false,
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vx_conversion_policy_scope_idx
  ON public.vx_conversion_policy (COALESCE(service_id, ''));

ALTER TABLE public.vx_conversion_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vx_conversion_policy FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vx_conversion_policy TO service_role;

COMMENT ON TABLE public.vx_conversion_policy IS
  'How a provider cost becomes a VX charge, per service or by default. Owner-set; created empty. Service-only; RLS on with no policy by design.';

-- ── Ledger links ────────────────────────────────────────────────────────────

-- A cost of a few nano-dollars must survive into the ledger.
ALTER TABLE public.vx_usage_ledger ALTER COLUMN actual_cost_usd TYPE numeric(14, 9);

ALTER TABLE public.ai_usage_events
  ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES public.vx_usage_ledger (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ai_usage_events_reservation_idx
  ON public.ai_usage_events (reservation_id) WHERE reservation_id IS NOT NULL;

-- ── Conversion ──────────────────────────────────────────────────────────────

-- VX for a provider cost under the policy in force for the service. NULL when
-- no policy exists: the caller must refuse, never assume a rate.
CREATE OR REPLACE FUNCTION public.vx_metered_charge(_service_id text, _cost_usd numeric)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _p   public.vx_conversion_policy%ROWTYPE;
  _raw numeric;
  _vx  integer;
BEGIN
  SELECT * INTO _p FROM public.vx_conversion_policy
   WHERE service_id = _service_id OR service_id IS NULL
   ORDER BY service_id IS NULL
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF COALESCE(_cost_usd, 0) <= 0 THEN
    RETURN 0;
  END IF;
  _raw := _cost_usd * _p.vx_per_usd * _p.multiplier;
  _vx := CASE _p.rounding WHEN 'floor' THEN floor(_raw) WHEN 'round' THEN round(_raw) ELSE ceil(_raw) END;
  RETURN GREATEST(_vx, _p.min_charge_vx);
END;
$$;

REVOKE ALL ON FUNCTION public.vx_metered_charge(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_metered_charge(text, numeric) TO service_role;

-- ── Reserve ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.vx_reserve_metered(
  _user_id         uuid,
  _service_id      text,
  _source          text,
  _idempotency_key text,
  _max_cost_usd    numeric,
  _metadata        jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _price     public.central_pricing_registry%ROWTYPE;
  _existing  public.vx_usage_ledger%ROWTYPE;
  _max_vx    integer;
  _used      integer;
  _plan      text;
  _allowance integer;
  _balance   integer;
  _id        uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_required');
  END IF;
  IF _source IS NULL OR _source NOT IN ('website', 'whatsapp', 'api', 'system') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_source');
  END IF;
  -- A metered request without a key could be retried into a second hold.
  IF _idempotency_key IS NULL OR length(_idempotency_key) NOT BETWEEN 8 AND 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'idempotency_key_required');
  END IF;
  IF _max_cost_usd IS NULL OR _max_cost_usd < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_cost_required');
  END IF;

  -- Serialise this user's holds, then look for a replay under the lock, so two
  -- concurrent requests with one key cannot both pass the check.
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  SELECT * INTO _existing FROM public.vx_usage_ledger WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF _existing.user_id IS DISTINCT FROM _user_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'idempotency_key_conflict');
    END IF;
    RETURN jsonb_build_object('ok', true, 'replayed', true, 'reservation_id', _existing.id,
                              'reserved_vx', _existing.reserved_vx, 'status', _existing.status);
  END IF;

  SELECT * INTO _price FROM public.central_pricing_registry WHERE service_id = _service_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_service');
  END IF;
  IF NOT _price.enabled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_disabled');
  END IF;
  IF _price.pricing_mode <> 'metered' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_metered');
  END IF;
  IF _price.admin_only AND NOT public.has_role(_user_id, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_only');
  END IF;

  _max_vx := public.vx_metered_charge(_service_id, _max_cost_usd);
  IF _max_vx IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conversion_not_configured');
  END IF;
  -- The expensive-model guard: a worst case above the service's cap is refused
  -- before any provider is called.
  IF _price.max_reserve_vx IS NOT NULL AND _max_vx > _price.max_reserve_vx THEN
    RETURN jsonb_build_object('ok', false, 'error', 'over_reserve_cap',
                              'required', _max_vx, 'max_reserve_vx', _price.max_reserve_vx);
  END IF;

  SELECT count(*) INTO _used
    FROM public.vx_usage_ledger
   WHERE user_id = _user_id AND service_id = _service_id AND status <> 'refunded'
     AND created_at >= date_trunc('day', now());
  IF _price.max_daily_usage IS NOT NULL AND _used + 1 > _price.max_daily_usage THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily_ceiling_reached',
                              'used_today', _used, 'max_daily_usage', _price.max_daily_usage);
  END IF;
  SELECT s.plan_id INTO _plan
    FROM public.user_subscriptions s
   WHERE s.user_id = _user_id AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > now())
   ORDER BY s.started_at DESC LIMIT 1;
  IF _plan IS NOT NULL AND _price.plan_limits ? _plan THEN
    _allowance := (_price.plan_limits ->> _plan)::integer;
    IF _allowance > 0 AND _used + 1 > _allowance THEN
      RETURN jsonb_build_object('ok', false, 'error', 'plan_allowance_reached',
                                'used_today', _used, 'plan_allowance', _allowance);
    END IF;
  END IF;
  -- The service's free requests per day hold nothing.
  IF _used < _price.free_limit THEN
    _max_vx := 0;
  END IF;

  IF _max_vx > 0 THEN
    _balance := public.vx_balance(_user_id);
    IF _balance < _max_vx THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_vx',
                                'balance', _balance, 'required', _max_vx, 'shortage', _max_vx - _balance);
    END IF;
    INSERT INTO public.user_points (user_id, points, reason)
    VALUES (_user_id, -_max_vx, 'VX reserve: ' || _service_id);
  END IF;

  INSERT INTO public.vx_usage_ledger
    (user_id, service_id, provider, units, reserved_vx, status, source, idempotency_key, metadata)
  VALUES
    (_user_id, _service_id, _price.provider, 1, _max_vx, 'reserved', _source, _idempotency_key,
     COALESCE(_metadata, '{}') || jsonb_build_object('pricing_mode', 'metered', 'max_cost_usd', _max_cost_usd))
  RETURNING id INTO _id;

  RETURN jsonb_build_object('ok', true, 'replayed', false, 'reservation_id', _id,
                            'reserved_vx', _max_vx, 'balance_after', public.vx_balance(_user_id));
END;
$$;

COMMENT ON FUNCTION public.vx_reserve_metered(uuid, text, text, text, numeric, jsonb) IS
  'Hold VX for one metered request: its worst-case provider cost, converted by vx_conversion_policy. Key required; a replay returns the first hold and takes nothing.';
REVOKE ALL ON FUNCTION public.vx_reserve_metered(uuid, text, text, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_reserve_metered(uuid, text, text, text, numeric, jsonb) TO service_role;

-- ── Settle ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.vx_settle_metered(_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row       public.vx_usage_ledger%ROWTYPE;
  _bill_fail boolean;
  _cost      numeric;
  _billable  integer;
  _unpriced  integer;
  _attempts  integer;
  _vx        integer;
  _result    jsonb;
BEGIN
  SELECT * INTO _row FROM public.vx_usage_ledger WHERE id = _reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  END IF;
  IF _row.status <> 'reserved' THEN
    RETURN jsonb_build_object('ok', true, 'replayed', true, 'status', _row.status,
                              'consumed_vx', _row.consumed_vx, 'refunded_vx', _row.refunded_vx);
  END IF;

  SELECT p.bill_failed_billable_attempts INTO _bill_fail
    FROM public.vx_conversion_policy p
   WHERE p.service_id = _row.service_id OR p.service_id IS NULL
   ORDER BY p.service_id IS NULL
   LIMIT 1;
  _bill_fail := COALESCE(_bill_fail, false);

  -- Billable: the call answered, or it failed after using tokens and the
  -- policy bills that. Only a priced (or free) call has a cost to count.
  SELECT count(*),
         count(*) FILTER (WHERE billable AND cost_status IN ('priced', 'free')),
         count(*) FILTER (WHERE billable AND cost_status = 'unpriced'),
         COALESCE(sum(provider_cost_usd) FILTER (WHERE billable AND cost_status IN ('priced', 'free')), 0)
    INTO _attempts, _billable, _unpriced, _cost
    FROM (
      SELECT e.cost_status, e.provider_cost_usd,
             (e.outcome = 'ok' OR (_bill_fail AND e.usage_source <> 'missing')) AS billable
        FROM public.ai_usage_events e
       WHERE e.reservation_id = _reservation_id
    ) x;

  UPDATE public.vx_usage_ledger
     SET metadata = metadata || jsonb_build_object(
           'attempts', _attempts, 'billable_attempts', _billable, 'unpriced_billable_attempts', _unpriced)
   WHERE id = _reservation_id;

  -- Nothing billable: every call failed, or none was made. The hold goes back.
  IF _billable = 0 THEN
    RETURN public.vx_release(_reservation_id, 'no_billable_usage', 'failed')
           || jsonb_build_object('actual_cost_usd', 0);
  END IF;

  _vx := COALESCE(public.vx_metered_charge(_row.service_id, _cost), 0);
  _result := public.vx_settle(_reservation_id, _vx, NULL, NULL, _cost);
  RETURN _result || jsonb_build_object('actual_cost_usd', _cost, 'charged_vx_before_cap', _vx);
END;
$$;

COMMENT ON FUNCTION public.vx_settle_metered(uuid) IS
  'Settle a metered hold from its ai_usage_events: billable provider cost, converted by policy, clamped to the hold (vx_settle). Nothing billable releases it. Idempotent.';
REVOKE ALL ON FUNCTION public.vx_settle_metered(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_settle_metered(uuid) TO service_role;

-- ── Production readiness ────────────────────────────────────────────────────

-- A model check a CI probe ran against the live key (provider-hub records it).
CREATE TABLE IF NOT EXISTS public.ai_model_checks (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider   text NOT NULL CHECK (provider ~ '^[a-z0-9_-]{1,32}$'),
  model_id   text NOT NULL CHECK (model_id ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  check_name text NOT NULL CHECK (check_name ~ '^[a-z0-9_-]{1,64}$'),
  passed     boolean NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  run_url    text CHECK (run_url IS NULL OR run_url ~ '^https://github\.com/')
);
CREATE INDEX IF NOT EXISTS ai_model_checks_model_idx ON public.ai_model_checks (provider, model_id, checked_at DESC);
ALTER TABLE public.ai_model_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_model_checks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.ai_model_checks TO service_role;

-- Ready for a CHARGED service only when all four hold: a price in force, usage
-- that providers report (not estimate) on nearly every recent call, a recent
-- passing live check, and no failing check since. routing_enabled alone is
-- never enough. A model with no recent calls cannot prove its accounting, so
-- it is not ready.
CREATE OR REPLACE VIEW public.ai_model_readiness
WITH (security_invoker = true) AS
WITH priced AS (
  SELECT provider, model_id FROM public.ai_price_book
   WHERE effective_from <= now() AND (effective_to IS NULL OR effective_to > now())
),
usage AS (
  SELECT provider, COALESCE(resolved_model, model) AS model_id, model AS requested,
         count(*) FILTER (WHERE outcome = 'ok') AS ok_calls,
         count(*) FILTER (WHERE outcome = 'ok' AND usage_source = 'reported') AS reported_calls
    FROM public.ai_usage_events
   WHERE occurred_at > now() - interval '7 days'
   GROUP BY 1, 2, 3
),
usage_by_model AS (
  SELECT provider, requested AS model_id, sum(ok_calls) AS ok_calls, sum(reported_calls) AS reported_calls
    FROM usage GROUP BY 1, 2
),
checks AS (
  SELECT DISTINCT ON (provider, model_id) provider, model_id, passed, checked_at
    FROM public.ai_model_checks
   ORDER BY provider, model_id, checked_at DESC
)
SELECT p.provider,
       p.model_id,
       true                                              AS priced,
       COALESCE(u.ok_calls, 0)                           AS ok_calls_7d,
       COALESCE(u.reported_calls, 0)                     AS reported_calls_7d,
       (COALESCE(u.ok_calls, 0) > 0
        AND u.reported_calls >= 0.95 * u.ok_calls)       AS usage_reported,
       (c.passed IS TRUE AND c.checked_at > now() - interval '14 days') AS live_check_passed,
       (COALESCE(u.ok_calls, 0) > 0
        AND u.reported_calls >= 0.95 * u.ok_calls
        AND c.passed IS TRUE AND c.checked_at > now() - interval '14 days') AS production_ready
  FROM priced p
  LEFT JOIN usage_by_model u ON u.provider = p.provider AND u.model_id = p.model_id
  LEFT JOIN checks c         ON c.provider = p.provider AND c.model_id = p.model_id;

REVOKE ALL ON public.ai_model_readiness FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_model_readiness TO service_role;
