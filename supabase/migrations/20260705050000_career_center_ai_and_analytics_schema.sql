-- VisionEx Career Center — AI data layer, career goals, analytics, and the
-- serverless job queue (the Postgres-native equivalent of a BullMQ+Redis
-- queue, since Edge Functions are stateless and can't host a worker process).

-- ── ai_interactions ──────────────────────────────────────────────────────
-- One row per AI service call. Stores summaries rather than full prompt/
-- response text to keep storage bounded and avoid retaining excess personal
-- data; pair with ai_response_cache for the full cached payload when needed.
CREATE TABLE public.ai_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  service text NOT NULL,
  provider text NOT NULL,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  latency_ms integer,
  cache_hit boolean NOT NULL DEFAULT false,
  request_summary text,
  response_summary text,
  feedback_rating integer CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI interaction history"
  ON public.ai_interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all AI interactions for performance tracking"
  ON public.ai_interactions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can leave feedback on their own AI interaction"
  ON public.ai_interactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ai_interactions_user ON public.ai_interactions(user_id);
CREATE INDEX idx_ai_interactions_service ON public.ai_interactions(service);
CREATE INDEX idx_ai_interactions_created_at ON public.ai_interactions(created_at DESC);

-- ── ai_response_cache ────────────────────────────────────────────────────
-- Backend-only response cache keyed by a hash of (service + normalized
-- prompt + params). No client-facing policies are defined, so RLS denies
-- all access from anon/authenticated roles by default — only the Edge
-- Function service-role client can read or write it. Swappable later for
-- Upstash Redis (or any REDIS_URL-compatible store) without touching the
-- calling code, since callers only see a getCached()/setCached() interface.
CREATE TABLE public.ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  service text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ai_response_cache_key ON public.ai_response_cache(cache_key);
CREATE INDEX idx_ai_response_cache_expires_at ON public.ai_response_cache(expires_at);

-- ── career_goals ─────────────────────────────────────────────────────────
CREATE TABLE public.career_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  deadline date,
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  estimated_completion date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own career goals"
  ON public.career_goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_career_goals_updated_at BEFORE UPDATE ON public.career_goals
  FOR EACH ROW EXECUTE FUNCTION public.career_set_updated_at();

CREATE INDEX idx_career_goals_user ON public.career_goals(user_id);

-- ── career_analytics_events ──────────────────────────────────────────────
-- Namespaced separately from the existing site-wide `page_events` table —
-- this one tracks Career Center-specific funnel events (job views,
-- application starts/completions, AI usage, employer performance) with a
-- flexible jsonb payload so new event types never require a migration.
CREATE TABLE public.career_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record an analytics event"
  ON public.career_analytics_events FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Admins can read analytics events"
  ON public.career_analytics_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_career_analytics_events_type ON public.career_analytics_events(event_type);
CREATE INDEX idx_career_analytics_events_entity ON public.career_analytics_events(entity_type, entity_id);
CREATE INDEX idx_career_analytics_events_created_at ON public.career_analytics_events(created_at DESC);

-- ── queue_jobs ───────────────────────────────────────────────────────────
-- Postgres-native background queue: the serverless-compatible equivalent of
-- BullMQ+Redis. A scheduled Edge Function (career-queue-worker) polls
-- `pending` rows where run_at <= now(), claims them via the locked_at
-- compare-and-set below, and processes them. Swappable for real BullMQ if
-- this ever moves to a long-running Node process — callers only depend on
-- enqueue()/claim()/complete()/fail(), never on the storage engine.
CREATE TABLE public.queue_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.queue_jobs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_queue_jobs_updated_at BEFORE UPDATE ON public.queue_jobs
  FOR EACH ROW EXECUTE FUNCTION public.career_set_updated_at();

CREATE INDEX idx_queue_jobs_status_run_at ON public.queue_jobs(status, run_at) WHERE status = 'pending';
CREATE INDEX idx_queue_jobs_job_type ON public.queue_jobs(job_type);

-- Atomically claim up to `_limit` pending, due jobs for a worker run.
-- SECURITY DEFINER + SKIP LOCKED so concurrent worker invocations never
-- double-process the same row.
CREATE OR REPLACE FUNCTION public.claim_queue_jobs(_job_type text, _limit integer DEFAULT 10)
RETURNS SETOF public.queue_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.queue_jobs
  SET status = 'processing', locked_at = now(), attempts = attempts + 1
  WHERE id IN (
    SELECT q.id FROM public.queue_jobs q
    WHERE q.job_type = _job_type
      AND q.status = 'pending'
      AND q.run_at <= now()
    ORDER BY q.run_at
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
