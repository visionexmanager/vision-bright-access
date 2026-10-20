-- admin_ai_cost_daily / admin_ai_reconciliation: read-only views of AI cost for admins.
--
-- Why. Provider cost is recorded for every metered call (ai_usage_events) but
-- nothing an admin can open reads it, and nothing lines it up against what users were
-- charged, what plans granted, or what the global budget can see
-- (docs/audit/VISIONEX_VX_FINANCIAL_AUDIT_2026-10-20.md). These two functions are
-- the read side only.
--
-- What they are not. They write nothing, change no balance, price, budget, grant or
-- policy, and they are not an invoice: the dollar figure is what Visionex recorded
-- from reported or estimated usage and the price book. Calls with no price, no usage
-- or estimated usage are COUNTED beside the figure so it cannot be mistaken for a
-- complete total, and every result carries `verified_invoice_total = false` and
-- `cost_is_lower_bound`.
--
-- What they return. Aggregates only: counts, token totals, dollar sums, model and
-- provider names. Never a prompt, an answer, a user id, an email or a row.
--
-- Access. SECURITY DEFINER (the tables are not readable by an admin session), so each
-- function refuses everyone who is not an admin inside the function. EXECUTE is held by
-- `authenticated` only: anon has none, and service_role has none either because it has
-- no admin identity (auth.uid() is null) and would be refused by the check anyway. The
-- search_path is fixed and every object is schema-qualified.
-- The result is one jsonb value, not a row set, so the REST row cap cannot silently
-- cut it off; the one potentially large list is bounded and says so (`rows_truncated`).

CREATE OR REPLACE FUNCTION public.admin_ai_cost_daily(_days integer DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _d        integer := LEAST(GREATEST(COALESCE(_days, 14), 1), 90);
  _since    timestamptz;
  _groups   integer;
  _rows     jsonb;
  _totals   jsonb;
  _lower    boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Whole UTC days, today included.
  _since := (date_trunc('day', now() AT TIME ZONE 'UTC') - ((_d - 1) * interval '1 day')) AT TIME ZONE 'UTC';

  WITH g AS (
    SELECT (e.occurred_at AT TIME ZONE 'UTC')::date                                  AS day,
           e.function_name,
           e.provider,
           COALESCE(e.resolved_model, e.model)                                       AS model,
           count(*)::integer                                                         AS calls,
           (count(*) FILTER (WHERE e.outcome = 'error'))::integer                    AS failed_calls,
           (count(*) FILTER (WHERE e.cost_status = 'priced'))::integer               AS priced_calls,
           (count(*) FILTER (WHERE e.cost_status = 'free'))::integer                 AS free_calls,
           (count(*) FILTER (WHERE e.cost_status = 'unpriced'))::integer             AS unpriced_calls,
           (count(*) FILTER (WHERE e.cost_status = 'no_usage'))::integer             AS no_usage_calls,
           (count(*) FILTER (WHERE e.usage_source = 'estimated'))::integer           AS estimated_usage_calls,
           (count(*) FILTER (WHERE e.usage_source = 'missing'))::integer             AS missing_usage_calls,
           COALESCE(sum(e.provider_cost_usd), 0)::numeric(14, 6)                     AS priced_cost_usd
      FROM public.ai_usage_events e
     WHERE e.occurred_at >= _since
     GROUP BY 1, 2, 3, 4
  )
  SELECT (SELECT count(*) FROM g)::integer,
         COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.day DESC, x.function_name, x.provider, x.model)
                     FROM (SELECT g.*, (g.unpriced_calls + g.no_usage_calls + g.missing_usage_calls = 0) AS fully_priced
                             FROM g ORDER BY g.day DESC, g.function_name, g.provider, g.model LIMIT 2000) x), '[]'::jsonb),
         jsonb_build_object(
           'calls',                 COALESCE((SELECT sum(calls) FROM g), 0),
           'failed_calls',          COALESCE((SELECT sum(failed_calls) FROM g), 0),
           'unpriced_calls',        COALESCE((SELECT sum(unpriced_calls) FROM g), 0),
           'no_usage_calls',        COALESCE((SELECT sum(no_usage_calls) FROM g), 0),
           'estimated_usage_calls', COALESCE((SELECT sum(estimated_usage_calls) FROM g), 0),
           'missing_usage_calls',   COALESCE((SELECT sum(missing_usage_calls) FROM g), 0),
           'priced_cost_usd',       COALESCE((SELECT sum(priced_cost_usd) FROM g), 0)),
         COALESCE((SELECT sum(unpriced_calls + no_usage_calls + missing_usage_calls) FROM g), 0) > 0
    INTO _groups, _rows, _totals, _lower;

  RETURN jsonb_build_object(
    'generated_at',            now(),
    'days',                    _d,
    'since',                   _since,
    'rows',                    _rows,
    'rows_truncated',          _groups > 2000,
    'totals',                  _totals,
    -- True when any call in the window has no price or no usage: the dollar figure is then a
    -- floor, not a total.
    'cost_is_lower_bound',     _lower,
    'verified_invoice_total',  false
  );
END;
$$;

COMMENT ON FUNCTION public.admin_ai_cost_daily(integer) IS
  'Admin only. Per day, function, provider and model: calls, failures, unpriced / no-usage / estimated / missing-usage calls, and the recorded provider dollars. Read-only aggregates; not an invoice (verified_invoice_total is always false).';

REVOKE ALL ON FUNCTION public.admin_ai_cost_daily(integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_ai_cost_daily(integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_ai_reconciliation(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _d          integer := LEAST(GREATEST(COALESCE(_days, 7), 1), 90);
  _since      timestamptz;
  _today      timestamptz;
  _events     jsonb;
  _status     jsonb;
  _source     jsonb;
  _unpriced   jsonb;
  _dups       jsonb;
  _ledger     jsonb;
  _metered    jsonb;
  _registry   jsonb;
  _grants     jsonb;
  _budget     jsonb;
  _seen       jsonb;
  _today_ev   jsonb;
  _flags      jsonb := '[]'::jsonb;
  _b          public.ai_budgets%ROWTYPE;
  _have_b     boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  _today := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  _since := (date_trunc('day', now() AT TIME ZONE 'UTC') - ((_d - 1) * interval '1 day')) AT TIME ZONE 'UTC';

  -- 1. Provider usage records.
  SELECT jsonb_build_object('total', count(*), 'failed', count(*) FILTER (WHERE outcome = 'error'))
    INTO _events FROM public.ai_usage_events WHERE occurred_at >= _since;

  SELECT COALESCE(jsonb_object_agg(cost_status, n), '{}'::jsonb) INTO _status
    FROM (SELECT cost_status, count(*) AS n FROM public.ai_usage_events WHERE occurred_at >= _since GROUP BY 1) s;
  SELECT COALESCE(jsonb_object_agg(usage_source, n), '{}'::jsonb) INTO _source
    FROM (SELECT usage_source, count(*) AS n FROM public.ai_usage_events WHERE occurred_at >= _since GROUP BY 1) s;

  -- Models that were called but have no price (names only).
  SELECT COALESCE(jsonb_agg(jsonb_build_object('provider', provider, 'model', model, 'calls', calls) ORDER BY calls DESC), '[]'::jsonb)
    INTO _unpriced
    FROM (SELECT provider, COALESCE(resolved_model, model) AS model, count(*) AS calls
            FROM public.ai_usage_events
           WHERE occurred_at >= _since AND cost_status = 'unpriced'
           GROUP BY 1, 2 ORDER BY calls DESC LIMIT 20) u;

  -- The same attempt of the same chain stored more than once.
  SELECT jsonb_build_object('groups', count(*), 'extra_rows', COALESCE(sum(n - 1), 0))
    INTO _dups
    FROM (SELECT count(*) AS n
            FROM public.ai_usage_events
           WHERE occurred_at >= _since AND chain_id IS NOT NULL AND attempt IS NOT NULL
           GROUP BY chain_id, attempt, provider, model
          HAVING count(*) > 1) d;

  -- 2. User charges (the metered ledger). reservation_id is a foreign key, so an event
  --    pointing at a missing ledger row cannot exist; the gaps that can are below.
  SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb) INTO _ledger
    FROM (SELECT status, count(*) AS n FROM public.vx_usage_ledger WHERE created_at >= _since GROUP BY 1) s;

  SELECT jsonb_build_object(
    'settled_without_events',
      (SELECT count(*) FROM public.vx_usage_ledger l
        WHERE l.created_at >= _since AND l.status = 'settled'
          AND NOT EXISTS (SELECT 1 FROM public.ai_usage_events e WHERE e.reservation_id = l.id)),
    'expired_holds_with_events',
      (SELECT count(DISTINCT l.id) FROM public.vx_usage_ledger l
         JOIN public.ai_usage_events e ON e.reservation_id = l.id
        WHERE l.created_at >= _since AND l.status = 'expired'),
    'expired_holds_event_cost_usd',
      COALESCE((SELECT sum(e.provider_cost_usd) FROM public.vx_usage_ledger l
                  JOIN public.ai_usage_events e ON e.reservation_id = l.id
                 WHERE l.created_at >= _since AND l.status = 'expired'), 0)::numeric(14, 6),
    'late_events',
      (SELECT count(*) FROM public.vx_usage_ledger l
         JOIN public.ai_usage_events e ON e.reservation_id = l.id
        WHERE l.created_at >= _since AND l.settled_at IS NOT NULL AND e.occurred_at > l.settled_at),
    'late_event_cost_usd',
      COALESCE((SELECT sum(e.provider_cost_usd) FROM public.vx_usage_ledger l
                  JOIN public.ai_usage_events e ON e.reservation_id = l.id
                 WHERE l.created_at >= _since AND l.settled_at IS NOT NULL AND e.occurred_at > l.settled_at), 0)::numeric(14, 6),
    -- Reservations whose calls have a recorded dollar cost but whose consumed VX is zero:
    -- provider cost with no user charge.
    'reservations_with_cost_and_no_charge',
      (SELECT count(*) FROM (
         SELECT l.id FROM public.vx_usage_ledger l
           JOIN public.ai_usage_events e ON e.reservation_id = l.id
          WHERE l.created_at >= _since AND l.consumed_vx = 0
          GROUP BY l.id HAVING COALESCE(sum(e.provider_cost_usd), 0) > 0) z),
    'reservations_cost_and_no_charge_usd',
      COALESCE((SELECT sum(c) FROM (
         SELECT sum(e.provider_cost_usd) AS c FROM public.vx_usage_ledger l
           JOIN public.ai_usage_events e ON e.reservation_id = l.id
          WHERE l.created_at >= _since AND l.consumed_vx = 0
          GROUP BY l.id HAVING COALESCE(sum(e.provider_cost_usd), 0) > 0) z), 0)::numeric(14, 6),
    'events_without_reservation',
      (SELECT count(*) FROM public.ai_usage_events e WHERE e.occurred_at >= _since AND e.reservation_id IS NULL)
  ) INTO _metered;

  SELECT jsonb_build_object(
    'services_total',   count(*),
    'services_enabled', count(*) FILTER (WHERE enabled),
    'ai_chat_enabled',  COALESCE(bool_or(enabled) FILTER (WHERE service_id = 'ai_chat'), false))
    INTO _registry FROM public.central_pricing_registry;

  -- 3. Plan allowance grants (VX written into user_points by subscription activation).
  SELECT jsonb_build_object('subscription_grant_rows', count(*), 'subscription_grant_vx', COALESCE(sum(points), 0))
    INTO _grants
    FROM public.user_points WHERE created_at >= _since AND reason LIKE 'VX subscription:%';

  -- 4. Budget: what the row says, and what check_ai_budget can see today versus what
  --    ai_usage_events recorded today.
  SELECT * INTO _b FROM public.ai_budgets WHERE scope = 'global' AND active LIMIT 1;
  _have_b := FOUND;
  SELECT jsonb_build_object(
    'active_global_row',   _have_b,
    'daily_token_limit',   CASE WHEN _have_b THEN _b.daily_token_limit END,
    'daily_request_limit', CASE WHEN _have_b THEN _b.daily_request_limit END,
    'daily_vx_limit',      CASE WHEN _have_b THEN _b.daily_vx_limit END)
    INTO _budget;

  SELECT jsonb_build_object(
    'requests', count(*),
    'tokens',   COALESCE(sum(COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0)), 0))
    INTO _seen FROM public.ai_interactions WHERE created_at >= _today;
  _seen := _seen || jsonb_build_object('reserved_vx',
    COALESCE((SELECT sum(reserved_vx) FROM public.vx_usage_ledger
               WHERE created_at >= _today AND status NOT IN ('refunded', 'expired')), 0));

  SELECT jsonb_build_object(
    'calls', count(*),
    'tokens', COALESCE(sum(CASE
        WHEN jsonb_typeof(usage -> 'total_tokens') = 'number' THEN (usage ->> 'total_tokens')::numeric
        ELSE (CASE WHEN jsonb_typeof(usage -> 'input_tokens') = 'number' THEN (usage ->> 'input_tokens')::numeric ELSE 0 END)
           + (CASE WHEN jsonb_typeof(usage -> 'output_tokens') = 'number' THEN (usage ->> 'output_tokens')::numeric ELSE 0 END)
      END), 0)::bigint,
    'priced_cost_usd', COALESCE(sum(provider_cost_usd), 0)::numeric(14, 6))
    INTO _today_ev FROM public.ai_usage_events WHERE occurred_at >= _today;

  -- 5. Flags: each is a statement about the data, not a verdict.
  IF (_status ->> 'unpriced')::integer > 0     THEN _flags := _flags || '"unpriced_calls_present"'::jsonb; END IF;
  IF (_status ->> 'no_usage')::integer > 0     THEN _flags := _flags || '"calls_without_usage_present"'::jsonb; END IF;
  IF (_source ->> 'missing')::integer > 0      THEN _flags := _flags || '"missing_usage_present"'::jsonb; END IF;
  IF (_source ->> 'estimated')::integer > 0    THEN _flags := _flags || '"estimated_usage_present"'::jsonb; END IF;
  IF (_dups ->> 'groups')::integer > 0         THEN _flags := _flags || '"duplicate_events_present"'::jsonb; END IF;
  IF (_metered ->> 'late_events')::integer > 0 THEN _flags := _flags || '"late_events_present"'::jsonb; END IF;
  IF (_metered ->> 'expired_holds_with_events')::integer > 0 THEN _flags := _flags || '"expired_holds_with_events"'::jsonb; END IF;
  IF (_metered ->> 'reservations_with_cost_and_no_charge')::integer > 0 THEN _flags := _flags || '"provider_cost_without_user_charge"'::jsonb; END IF;
  IF (_metered ->> 'settled_without_events')::integer > 0 THEN _flags := _flags || '"settled_holds_without_events"'::jsonb; END IF;
  IF (_events ->> 'total')::integer > 0 AND (_registry ->> 'services_enabled')::integer = 0 THEN
    _flags := _flags || '"provider_cost_recorded_but_no_service_enabled_for_charging"'::jsonb;
  END IF;
  IF NOT _have_b THEN _flags := _flags || '"no_active_global_budget_row"'::jsonb; END IF;
  -- check_ai_budget reads ai_interactions and vx_usage_ledger, never ai_usage_events.
  IF (_today_ev ->> 'calls')::integer > 0 THEN _flags := _flags || '"budget_token_and_request_limits_do_not_read_ai_usage_events"'::jsonb; END IF;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'days', _d,
    'since', _since,
    'usage_events', _events || jsonb_build_object('by_cost_status', _status, 'by_usage_source', _source,
                                                  'duplicates', _dups, 'unpriced_models', _unpriced),
    'vx_ledger', jsonb_build_object('by_status', _ledger, 'gaps', _metered),
    'charging_registry', _registry,
    'plan_allowance_grants', _grants,
    'budget', _budget || jsonb_build_object('as_seen_by_check_ai_budget_today', _seen,
                                           'recorded_in_ai_usage_events_today', _today_ev),
    'flags', _flags,
    'verified_invoice_total', false
  );
END;
$$;

COMMENT ON FUNCTION public.admin_ai_reconciliation(integer) IS
  'Admin only. Read-only aggregates lining provider usage records up against the VX ledger, plan allowance grants and the global budget, with named flags for missing, unpriced, duplicate and late records. Changes nothing.';

REVOKE ALL ON FUNCTION public.admin_ai_reconciliation(integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_ai_reconciliation(integer) TO authenticated;
