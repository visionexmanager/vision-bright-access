-- VisionEx Career Center — business analytics (Phase 11).
-- Admin-only reporting RPCs over existing tables (no new base tables, no
-- duplicated data). Each function does its own admin check internally
-- (same pattern analytics-insights/index.ts already uses at the
-- application layer, moved into SQL here so any admin surface can call
-- these directly as RPCs) rather than relying on RLS, since these
-- aggregate across every company/user and a per-row RLS policy can't
-- express "admin sees the aggregate of everyone's rows."

CREATE OR REPLACE FUNCTION public.get_career_revenue_analytics(_start date, _end date)
RETURNS TABLE (day date, revenue_cents bigint, invoice_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT created_at::date AS day, SUM(amount_cents)::bigint AS revenue_cents, COUNT(*)::bigint AS invoice_count
  FROM public.career_billing_invoices
  WHERE status = 'paid' AND created_at::date BETWEEN _start AND _end
  GROUP BY created_at::date
  ORDER BY day;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_career_user_growth(_start date, _end date)
RETURNS TABLE (day date, new_candidates bigint, new_employers bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    cur.created_at::date AS day,
    COUNT(*) FILTER (WHERE cur.role = 'candidate')::bigint AS new_candidates,
    COUNT(*) FILTER (WHERE cur.role = 'employer')::bigint AS new_employers
  FROM public.career_user_roles cur
  WHERE cur.created_at::date BETWEEN _start AND _end
  GROUP BY cur.created_at::date
  ORDER BY day;
END;
$$;

-- Approximate 30-day retention: of users active (any AI interaction or job
-- application) in the prior 30-day window, what share were active again in
-- the most recent 30-day window. A lightweight proxy, not full cohort analysis.
CREATE OR REPLACE FUNCTION public.get_career_retention_rate()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prior_active bigint;
  _retained bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  WITH prior_window AS (
    SELECT DISTINCT user_id FROM public.ai_interactions
    WHERE created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days' AND user_id IS NOT NULL
    UNION
    SELECT DISTINCT user_id FROM public.applications
    WHERE created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days'
  ),
  recent_window AS (
    SELECT DISTINCT user_id FROM public.ai_interactions
    WHERE created_at >= now() - interval '30 days' AND user_id IS NOT NULL
    UNION
    SELECT DISTINCT user_id FROM public.applications
    WHERE created_at >= now() - interval '30 days'
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE prior_window.user_id IN (SELECT user_id FROM recent_window))
  INTO _prior_active, _retained
  FROM prior_window;

  IF _prior_active = 0 THEN RETURN NULL; END IF;
  RETURN ROUND((_retained::numeric / _prior_active) * 100, 2);
END;
$$;

-- Free-to-paid conversion: share of companies with a subscription row whose
-- current plan is not 'free'.
CREATE OR REPLACE FUNCTION public.get_career_conversion_rate()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total bigint;
  _paid bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE plan_id <> 'free')
  INTO _total, _paid
  FROM public.career_billing_subscriptions
  WHERE status IN ('trialing', 'active', 'past_due');

  IF _total = 0 THEN RETURN NULL; END IF;
  RETURN ROUND((_paid::numeric / _total) * 100, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_career_job_posting_trends(_start date, _end date)
RETURNS TABLE (day date, jobs_posted bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT created_at::date AS day, COUNT(*)::bigint AS jobs_posted
  FROM public.jobs
  WHERE created_at::date BETWEEN _start AND _end
  GROUP BY created_at::date
  ORDER BY day;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_career_ai_usage_analytics(_start date, _end date)
RETURNS TABLE (service text, calls bigint, avg_latency_ms numeric, cache_hit_rate numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    ai.service,
    COUNT(*)::bigint AS calls,
    ROUND(AVG(ai.latency_ms), 2) AS avg_latency_ms,
    ROUND((COUNT(*) FILTER (WHERE ai.cache_hit)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS cache_hit_rate
  FROM public.ai_interactions ai
  WHERE ai.created_at::date BETWEEN _start AND _end
  GROUP BY ai.service
  ORDER BY calls DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_career_geographic_distribution()
RETURNS TABLE (location text, candidate_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT COALESCE(cp.location, 'Unknown') AS location, COUNT(*)::bigint AS candidate_count
  FROM public.career_profiles cp
  GROUP BY COALESCE(cp.location, 'Unknown')
  ORDER BY candidate_count DESC;
END;
$$;
