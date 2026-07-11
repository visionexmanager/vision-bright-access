-- VisionEx Career Center — monitoring & structured logging storage (Phase 11).
-- AI-specific latency/token/cache metrics already live in ai_interactions
-- (20260705050000) — this covers the rest: periodic component health
-- snapshots, general request latency, and a structured error log. All three
-- are backend-only (no client policies beyond admin-read), written by new
-- Phase 11 Edge Functions only.

CREATE TABLE public.career_system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'warning', 'error', 'missing')),
  detail text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_system_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system health history"
  ON public.career_system_health_checks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_career_system_health_checks_component ON public.career_system_health_checks(component, checked_at DESC);

-- ── Request latency ───────────────────────────────────────────────────────
CREATE TABLE public.career_request_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id text NOT NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  latency_ms integer NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_request_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view request metrics"
  ON public.career_request_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_career_request_metrics_endpoint ON public.career_request_metrics(endpoint, created_at DESC);
CREATE INDEX idx_career_request_metrics_trace ON public.career_request_metrics(trace_id);
CREATE INDEX idx_career_request_metrics_status ON public.career_request_metrics(status_code) WHERE status_code >= 400;

-- ── Structured error log ─────────────────────────────────────────────────
CREATE TABLE public.career_error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id text,
  service text NOT NULL,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('debug', 'info', 'warn', 'error')),
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view the error log"
  ON public.career_error_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_career_error_log_service ON public.career_error_log(service, created_at DESC);
CREATE INDEX idx_career_error_log_severity ON public.career_error_log(severity) WHERE severity = 'error';
