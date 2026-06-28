-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — TV Channels & Categories
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Categories ───────────────────────────────────────────────────────────────
CREATE TABLE tv_categories (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT  NOT NULL UNIQUE,
  name        TEXT  NOT NULL,
  name_ar     TEXT  NOT NULL DEFAULT '',
  icon        TEXT,
  sort_order  INT   NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO tv_categories (slug, name, name_ar, sort_order) VALUES
  ('news',        'News',          'أخبار',        1),
  ('sports',      'Sports',        'رياضة',        2),
  ('movies',      'Movies',        'أفلام',         3),
  ('kids',        'Kids',          'أطفال',         4),
  ('documentary', 'Documentary',   'وثائقية',       5),
  ('music',       'Music',         'موسيقى',        6),
  ('religious',   'Religious',     'ديني',          7),
  ('general',     'General',       'عام',           8);

-- ── Channels ─────────────────────────────────────────────────────────────────
CREATE TABLE tv_channels (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT        NOT NULL UNIQUE,
  name            TEXT        NOT NULL,
  name_ar         TEXT        NOT NULL DEFAULT '',
  description     TEXT,
  description_ar  TEXT,
  logo_url        TEXT,
  country         TEXT,                  -- ISO 3166-1 alpha-2
  language        TEXT        NOT NULL DEFAULT 'ar',
  category_id     UUID        REFERENCES tv_categories (id),
  quality         TEXT        NOT NULL DEFAULT 'HD'
                              CHECK (quality IN ('SD', 'HD', 'FHD', '4K')),
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  is_featured     BOOLEAN     NOT NULL DEFAULT FALSE,
  stream_url      TEXT,                  -- protected primary URL
  official_url    TEXT,                  -- public fallback (YouTube, etc.)
  epg_id          TEXT,                  -- for EPG integration
  view_count      BIGINT      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tv_channels_category ON tv_channels (category_id) WHERE is_active;
CREATE INDEX idx_tv_channels_country  ON tv_channels (country)     WHERE is_active;
CREATE INDEX idx_tv_channels_featured ON tv_channels (is_featured)  WHERE is_active;
CREATE INDEX idx_tv_channels_search   ON tv_channels USING gin (
  to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(name_ar,'') || ' ' || coalesce(country,''))
);

CREATE TRIGGER trg_channels_updated_at
  BEFORE UPDATE ON tv_channels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Stream sources (multi-source failover) ────────────────────────────────────
CREATE TABLE tv_stream_sources (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id       UUID        NOT NULL REFERENCES tv_channels (id) ON DELETE CASCADE,
  label            TEXT        NOT NULL DEFAULT 'primary',
  url              TEXT        NOT NULL,
  type             TEXT        NOT NULL DEFAULT 'hls'
                               CHECK (type IN ('hls', 'dash', 'rtmp', 'http', 'youtube')),
  priority         INT         NOT NULL DEFAULT 0,
  reliability      NUMERIC(5,2) NOT NULL DEFAULT 100.0
                               CHECK (reliability BETWEEN 0 AND 100),
  latency_ms       INT,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  last_checked_at  TIMESTAMPTZ,
  failure_count    INT         NOT NULL DEFAULT 0,
  success_count    INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stream_sources_channel   ON tv_stream_sources (channel_id, is_active, priority, reliability DESC);
CREATE INDEX idx_stream_sources_check_due ON tv_stream_sources (last_checked_at NULLS FIRST) WHERE is_active;

CREATE TRIGGER trg_stream_sources_updated_at
  BEFORE UPDATE ON tv_stream_sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
