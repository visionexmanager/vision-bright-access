-- VisionEx Career Center — admin overview RPCs (Phase 11).
-- Most admin needs (users, companies, jobs, billing, AI usage, system
-- health) are already reachable by an admin through the RLS policies
-- already in place (career_profiles/companies are public, jobs/
-- applications/ai_interactions/career_billing_*/career_system_health_checks
-- all already grant admin SELECT). These two RPCs add the two things that
-- aren't a plain SELECT: a one-call dashboard summary, and a unified
-- security-alerts feed. No frontend page is added per this phase's "no UI
-- changes" rule — these are ready for whichever admin page later calls them.

CREATE OR REPLACE FUNCTION public.get_career_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'total_candidates', (SELECT COUNT(*) FROM public.career_user_roles WHERE role = 'candidate'),
    'total_employers', (SELECT COUNT(*) FROM public.career_user_roles WHERE role = 'employer'),
    'total_companies', (SELECT COUNT(*) FROM public.companies),
    'active_jobs', (SELECT COUNT(*) FROM public.jobs WHERE status = 'active'),
    'total_applications', (SELECT COUNT(*) FROM public.applications),
    'paying_subscriptions', (SELECT COUNT(*) FROM public.career_billing_subscriptions WHERE plan_id <> 'free' AND status IN ('active', 'trialing', 'past_due')),
    'past_due_subscriptions', (SELECT COUNT(*) FROM public.career_billing_subscriptions WHERE status = 'past_due'),
    'estimated_mrr_cents', (
      SELECT COALESCE(SUM((p.price_monthly_usd * 100)::bigint), 0)
      FROM public.career_billing_subscriptions s
      JOIN public.career_billing_plans p ON p.id = s.plan_id
      WHERE s.status IN ('active', 'trialing')
    ),
    'ai_calls_last_24h', (SELECT COUNT(*) FROM public.ai_interactions WHERE created_at > now() - interval '24 hours'),
    'open_error_count_last_24h', (SELECT COUNT(*) FROM public.career_error_log WHERE severity = 'error' AND created_at > now() - interval '24 hours'),
    'latest_health_check_at', (SELECT MAX(checked_at) FROM public.career_system_health_checks)
  ) INTO _result;

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_career_security_alerts(_limit integer DEFAULT 50)
RETURNS TABLE (
  alert_type text,
  severity text,
  description text,
  user_id uuid,
  occurred_at timestamptz
)
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
  (
    SELECT 'suspicious_activity'::text, 'high'::text, event_type, career_security_events.user_id, created_at
    FROM public.career_security_events
    WHERE event_type IN ('suspicious_activity', 'permission_denied')
    ORDER BY created_at DESC
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'billing_past_due'::text, 'medium'::text, 'Subscription past due for company ' || company_id::text, NULL::uuid, updated_at
    FROM public.career_billing_subscriptions
    WHERE status = 'past_due'
    ORDER BY updated_at DESC
    LIMIT _limit
  )
  ORDER BY occurred_at DESC
  LIMIT _limit;
END;
$$;
