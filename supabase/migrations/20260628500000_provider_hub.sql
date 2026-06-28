-- AI Provider Hub — centralized provider management
-- Tables: ph_providers, ph_metrics, ph_logs, ph_configs, ph_failovers

-- ─── PROVIDER REGISTRY ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ph_providers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  type                  text NOT NULL
                          CHECK (type IN ('tts', 'voice_cloning', 'text_to_video')),
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'inactive', 'degraded', 'error')),
  priority              integer NOT NULL DEFAULT 100,   -- lower = preferred
  api_key_ref           text,     -- secret name in Supabase secrets (not raw key)
  base_url              text,
  default_model         text,
  regions               text[] DEFAULT '{}',           -- allowed regions, empty = all
  max_rpm               integer DEFAULT 60,
  cost_per_request      numeric(10,6) DEFAULT 0,
  cost_limit_daily_usd  numeric(10,4) DEFAULT 0,       -- 0 = no limit
  health_score          numeric(5,2) NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  avg_latency_ms        integer DEFAULT 0,
  success_rate          numeric(5,2) DEFAULT 100,
  last_health_check     timestamptz,
  last_failure_at       timestamptz,
  consecutive_failures  integer NOT NULL DEFAULT 0,
  capabilities          text[] DEFAULT '{}',           -- e.g. ['ssml','emotions','streaming']
  config                jsonb NOT NULL DEFAULT '{}',
  is_system             boolean NOT NULL DEFAULT false, -- system providers can't be deleted
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ph_providers_type_idx     ON ph_providers(type);
CREATE INDEX IF NOT EXISTS ph_providers_status_idx   ON ph_providers(status);
CREATE INDEX IF NOT EXISTS ph_providers_priority_idx ON ph_providers(type, priority, health_score DESC);

-- RLS: read for all authenticated; write admin only (enforced at edge function level)
ALTER TABLE ph_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_providers_read_auth" ON ph_providers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ph_providers_write_service" ON ph_providers
  FOR ALL USING (true);  -- service_role bypasses RLS

CREATE TRIGGER ph_providers_updated_at
  BEFORE UPDATE ON ph_providers
  FOR EACH ROW EXECUTE FUNCTION ams_touch_updated_at();

-- ─── PROVIDER METRICS (time-series, per minute) ───────────────────────────────

CREATE TABLE IF NOT EXISTS ph_metrics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     uuid NOT NULL REFERENCES ph_providers(id) ON DELETE CASCADE,
  period_start    timestamptz NOT NULL,  -- truncated to minute
  requests        integer NOT NULL DEFAULT 0,
  successes       integer NOT NULL DEFAULT 0,
  failures        integer NOT NULL DEFAULT 0,
  total_latency_ms bigint NOT NULL DEFAULT 0,
  total_cost_usd  numeric(12,8) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, period_start)
);

CREATE INDEX IF NOT EXISTS ph_metrics_provider_time_idx
  ON ph_metrics(provider_id, period_start DESC);
CREATE INDEX IF NOT EXISTS ph_metrics_time_idx ON ph_metrics(period_start DESC);

ALTER TABLE ph_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_metrics_read_auth" ON ph_metrics
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ph_metrics_write_service" ON ph_metrics
  FOR ALL USING (true);

-- ─── PROVIDER LOGS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ph_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   uuid REFERENCES ph_providers(id) ON DELETE SET NULL,
  provider_slug text,
  job_type      text,   -- 'tts' | 'voice_cloning' | 'text_to_video'
  action        text NOT NULL,
  status        text NOT NULL CHECK (status IN ('success', 'failure', 'timeout', 'skipped')),
  latency_ms    integer,
  cost_usd      numeric(10,6),
  error_code    text,
  error_message text,
  retry_count   integer DEFAULT 0,
  failover_to   uuid REFERENCES ph_providers(id) ON DELETE SET NULL,
  request_meta  jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ph_logs_provider_idx  ON ph_logs(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ph_logs_status_idx    ON ph_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ph_logs_type_idx      ON ph_logs(job_type, created_at DESC);

ALTER TABLE ph_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_logs_read_auth" ON ph_logs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ph_logs_write_service" ON ph_logs
  FOR ALL USING (true);

-- ─── PROVIDER CONFIGS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ph_configs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  value       jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Hub-wide settings
INSERT INTO ph_configs (key, value, description) VALUES
  ('routing_strategy', '"smart"',        'Routing strategy: smart | priority | round_robin | least_latency | cheapest'),
  ('failover_enabled', 'true',           'Automatically failover to next provider on failure'),
  ('health_check_interval_sec', '60',    'How often to run health checks (seconds)'),
  ('max_consecutive_failures', '3',      'Failures before marking provider as degraded'),
  ('health_score_decay_rate', '10',      'Health score decrease per failure'),
  ('health_score_recovery_rate', '5',    'Health score increase per successful request'),
  ('cost_tracking_enabled', 'true',      'Track estimated cost per request'),
  ('metrics_retention_hours', '168',     'How many hours of metrics to retain (168 = 1 week)')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE ph_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_configs_read_auth" ON ph_configs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ph_configs_write_service" ON ph_configs
  FOR ALL USING (true);

-- ─── PROVIDER FAILOVERS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ph_failovers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_provider_id  uuid REFERENCES ph_providers(id) ON DELETE SET NULL,
  to_provider_id    uuid REFERENCES ph_providers(id) ON DELETE SET NULL,
  from_slug         text,
  to_slug           text,
  job_type          text,
  reason            text,
  error_message     text,
  resolved          boolean NOT NULL DEFAULT false,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ph_failovers_created_idx ON ph_failovers(created_at DESC);
CREATE INDEX IF NOT EXISTS ph_failovers_from_idx    ON ph_failovers(from_provider_id, created_at DESC);

ALTER TABLE ph_failovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_failovers_read_auth" ON ph_failovers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ph_failovers_write_service" ON ph_failovers
  FOR ALL USING (true);

-- ─── RPCs ─────────────────────────────────────────────────────────────────────

-- Upsert a metrics record (called by edge function after each generation)
CREATE OR REPLACE FUNCTION ph_record_metric(
  p_provider_id   uuid,
  p_success       boolean,
  p_latency_ms    integer,
  p_cost_usd      numeric DEFAULT 0
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_period timestamptz := date_trunc('minute', now());
BEGIN
  INSERT INTO ph_metrics (provider_id, period_start, requests, successes, failures, total_latency_ms, total_cost_usd)
  VALUES (p_provider_id, v_period, 1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    COALESCE(p_latency_ms, 0),
    COALESCE(p_cost_usd, 0))
  ON CONFLICT (provider_id, period_start)
  DO UPDATE SET
    requests          = ph_metrics.requests + 1,
    successes         = ph_metrics.successes + CASE WHEN p_success THEN 1 ELSE 0 END,
    failures          = ph_metrics.failures  + CASE WHEN p_success THEN 0 ELSE 1 END,
    total_latency_ms  = ph_metrics.total_latency_ms + COALESCE(p_latency_ms, 0),
    total_cost_usd    = ph_metrics.total_cost_usd   + COALESCE(p_cost_usd, 0);

  -- Update rolling averages on the provider
  UPDATE ph_providers SET
    health_score = LEAST(100, GREATEST(0,
      health_score + CASE WHEN p_success THEN 5 ELSE -10 END)),
    avg_latency_ms = CASE
      WHEN p_latency_ms IS NOT NULL
      THEN (COALESCE(avg_latency_ms, 0) * 9 + p_latency_ms) / 10  -- EMA 10
      ELSE avg_latency_ms
    END,
    consecutive_failures = CASE WHEN p_success THEN 0 ELSE consecutive_failures + 1 END,
    last_failure_at = CASE WHEN p_success THEN last_failure_at ELSE now() END,
    success_rate = (
      SELECT CASE WHEN SUM(requests) = 0 THEN 100
             ELSE ROUND(SUM(successes)::numeric / SUM(requests) * 100, 2)
             END
      FROM ph_metrics
      WHERE provider_id = p_provider_id
        AND period_start >= now() - interval '1 hour'
    ),
    updated_at = now()
  WHERE id = p_provider_id;

  -- Auto-degrade if too many consecutive failures
  UPDATE ph_providers
  SET status = 'degraded', updated_at = now()
  WHERE id = p_provider_id
    AND consecutive_failures >= 3
    AND status = 'active';
END;
$$;

-- Get aggregate metrics for a provider over a window
CREATE OR REPLACE FUNCTION ph_get_provider_stats(
  p_provider_id uuid,
  p_hours       integer DEFAULT 24
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_requests',  COALESCE(SUM(requests), 0),
    'total_successes', COALESCE(SUM(successes), 0),
    'total_failures',  COALESCE(SUM(failures), 0),
    'total_cost_usd',  COALESCE(SUM(total_cost_usd), 0),
    'avg_latency_ms',  CASE WHEN SUM(requests) > 0
                       THEN ROUND(SUM(total_latency_ms)::numeric / SUM(requests))
                       ELSE 0 END,
    'success_rate',    CASE WHEN SUM(requests) > 0
                       THEN ROUND(SUM(successes)::numeric / SUM(requests) * 100, 2)
                       ELSE 100 END,
    'rpm',             ROUND(COALESCE(SUM(requests), 0)::numeric / (p_hours * 60), 2)
  )
  INTO v_result
  FROM ph_metrics
  WHERE provider_id = p_provider_id
    AND period_start >= now() - make_interval(hours => p_hours);

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ─── SEED DEFAULT PROVIDERS ───────────────────────────────────────────────────

INSERT INTO ph_providers
  (name, slug, type, status, priority, api_key_ref, default_model, capabilities, cost_per_request, is_system, config)
VALUES
  -- TTS
  ('OpenAI TTS',       'openai-tts',    'tts',            'active',   10, 'OPENAI_API_KEY',     'tts-1',           ARRAY['emotions','speed','format'],  0.015,  true,  '{"max_chars": 4096, "formats": ["mp3","opus","aac","flac"]}'),
  ('ElevenLabs TTS',   'elevenlabs-tts','tts',            'inactive', 20, 'ELEVENLABS_API_KEY', 'eleven_turbo_v2', ARRAY['emotions','ssml','streaming'], 0.030,  true,  '{"max_chars": 10000}'),
  ('Demo TTS',         'mock-tts',      'tts',            'active',   99, null,                 'mock-v1',         ARRAY['demo'],                       0.0,    true,  '{}'),
  -- Voice Cloning
  ('ElevenLabs Cloning','elevenlabs-vc','voice_cloning',  'inactive', 10, 'ELEVENLABS_API_KEY', 'eleven_multilingual_v2', ARRAY['multilingual'],       0.050,  true,  '{"min_samples_sec": 30}'),
  ('Demo Voice Clone', 'mock-vc',       'voice_cloning',  'active',   99, null,                 'mock-v1',         ARRAY['demo'],                       0.0,    true,  '{}'),
  -- Text-to-Video
  ('Luma Dream Machine','luma-video',   'text_to_video',  'inactive', 10, 'LUMA_API_KEY',       'dream-machine',   ARRAY['text-to-video','720p','1080p'],0.200,  true,  '{"max_duration_sec": 10}'),
  ('Demo Video',       'mock-video',    'text_to_video',  'active',   99, null,                 'mock-v1',         ARRAY['demo'],                       0.0,    true,  '{}')
ON CONFLICT (slug) DO NOTHING;
