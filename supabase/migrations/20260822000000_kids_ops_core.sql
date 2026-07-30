-- ============================================================
-- Migration: VisionKids AI Operations & Quality Platform (Phase 16) — core.
--
-- An INTERNAL ops console. Every operational table is admin-only (has_role
-- 'admin') for both read and write — this is not user-facing data. The two
-- exceptions are kids_ops_feature_flags and kids_ops_maintenance, which are
-- publicly READABLE (so the app can react to a flag / maintenance mode) but
-- only admin-writable.
--
-- Honesty note: true infra metrics (CPU, live connections, Core Web Vitals)
-- come from real monitoring integrations. This schema stores what the platform
-- itself owns — incidents, errors, reviews, reports, releases, flags,
-- maintenance, logs, and periodic health snapshots written by jobs — and the
-- UI labels anything that requires an external provider as an integration point.
-- ============================================================

-- ── Incidents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_ops_incidents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  severity    TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('critical','major','minor','info')),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','monitoring','resolved')),
  area        TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_ops_incidents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_ops_incidents_status ON public.kids_ops_incidents(status, severity, created_at DESC);
CREATE POLICY "kids_ops_incidents: admins" ON public.kids_ops_incidents FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Error events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_ops_error_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL DEFAULT 'javascript' CHECK (kind IN ('javascript','api','database','ai','network')),
  message     TEXT NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  count       INTEGER NOT NULL DEFAULT 1,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_ops_error_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_ops_errors_kind ON public.kids_ops_error_events(kind, resolved, last_seen DESC);
CREATE POLICY "kids_ops_error_events: admins" ON public.kids_ops_error_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Content review queue (platform-wide, beyond marketplace) ─────────────────
CREATE TABLE IF NOT EXISTS public.kids_ops_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_kind TEXT NOT NULL CHECK (content_kind IN ('story','game','course','video','image','audio','project','ai_generated')),
  ref_id      TEXT,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  flags       JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_ops_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_ops_reviews_status ON public.kids_ops_reviews(status, content_kind, created_at);
CREATE POLICY "kids_ops_reviews: admins" ON public.kids_ops_reviews FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Quality reports (accessibility / performance / security) ─────────────────
CREATE TABLE IF NOT EXISTS public.kids_ops_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL CHECK (kind IN ('accessibility','performance','security','ai')),
  score       NUMERIC(5,2),
  summary     TEXT,
  metrics     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_ops_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_ops_reports_kind ON public.kids_ops_reports(kind, created_at DESC);
CREATE POLICY "kids_ops_reports: admins" ON public.kids_ops_reports FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Health snapshots (periodic, written by a job) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_ops_health_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational','degraded','down')),
  latency_ms   INTEGER,
  detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_ops_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_ops_health_service ON public.kids_ops_health_snapshots(service, captured_at DESC);
CREATE POLICY "kids_ops_health: admins" ON public.kids_ops_health_snapshots FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Logs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_ops_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  level       TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug','info','warn','error')),
  source      TEXT,
  message     TEXT NOT NULL,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_ops_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_ops_logs_time ON public.kids_ops_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_ops_logs_level ON public.kids_ops_logs(level, created_at DESC);
CREATE POLICY "kids_ops_logs: admins" ON public.kids_ops_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Releases ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_ops_releases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version     TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'stable' CHECK (channel IN ('stable','beta','canary')),
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'deployed' CHECK (status IN ('deployed','rolled_back')),
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_ops_releases ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_ops_releases_time ON public.kids_ops_releases(deployed_at DESC);
CREATE POLICY "kids_ops_releases: admins" ON public.kids_ops_releases FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Feature flags (PUBLIC read, admin write) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_ops_feature_flags (
  key         TEXT PRIMARY KEY,
  description TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  channel     TEXT NOT NULL DEFAULT 'stable' CHECK (channel IN ('stable','beta','canary')),
  rollout_pct INTEGER NOT NULL DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_ops_feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_ops_feature_flags: public read" ON public.kids_ops_feature_flags FOR SELECT USING (true);
CREATE POLICY "kids_ops_feature_flags: admins write" ON public.kids_ops_feature_flags FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_ops_feature_flags (key, description, enabled, channel) VALUES
  ('kids_world',        'VisionKids World open-world section',       true,  'stable'),
  ('kids_market',       'Creator & Education Marketplace',           true,  'stable'),
  ('kids_ai_companion', 'AI Companion beta',                         false, 'beta'),
  ('kids_voice_search', 'Voice search (canary)',                     false, 'canary')
ON CONFLICT (key) DO NOTHING;

-- ── Maintenance mode (single row, PUBLIC read, admin write) ──────────────────
CREATE TABLE IF NOT EXISTS public.kids_ops_maintenance (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  mode          TEXT NOT NULL DEFAULT 'full' CHECK (mode IN ('full','partial')),
  message       TEXT,
  admins_bypass BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_ops_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_ops_maintenance: public read" ON public.kids_ops_maintenance FOR SELECT USING (true);
CREATE POLICY "kids_ops_maintenance: admins write" ON public.kids_ops_maintenance FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_ops_maintenance (id, enabled, mode) VALUES (1, false, 'full')
ON CONFLICT (id) DO NOTHING;

-- ── Ops audit ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_ops_audit (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_ops_audit ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_ops_audit_time ON public.kids_ops_audit(created_at DESC);
CREATE POLICY "kids_ops_audit: admins" ON public.kids_ops_audit FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
