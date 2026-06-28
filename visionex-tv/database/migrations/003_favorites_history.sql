-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003 — Favorites, Watch History, Playlists, Analytics
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Favorites ────────────────────────────────────────────────────────────────
CREATE TABLE tv_favorites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel_id  UUID        NOT NULL REFERENCES tv_channels (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, channel_id)
);

CREATE INDEX idx_tv_favorites_user ON tv_favorites (user_id, created_at DESC);

-- ── Watch history ─────────────────────────────────────────────────────────────
CREATE TABLE tv_watch_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel_id   UUID        NOT NULL REFERENCES tv_channels (id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  duration_sec INT         NOT NULL DEFAULT 0,
  quality      TEXT,
  source_id    UUID        REFERENCES tv_stream_sources (id)
);

CREATE INDEX idx_watch_history_user    ON tv_watch_history (user_id, started_at DESC);
CREATE INDEX idx_watch_history_channel ON tv_watch_history (channel_id, started_at DESC);

-- ── Watch stats (daily aggregated) ───────────────────────────────────────────
CREATE TABLE tv_watch_stats (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel_id     UUID    NOT NULL REFERENCES tv_channels (id) ON DELETE CASCADE,
  session_date   DATE    NOT NULL DEFAULT CURRENT_DATE,
  watch_secs     INT     NOT NULL DEFAULT 0,
  session_count  INT     NOT NULL DEFAULT 0,
  UNIQUE (user_id, channel_id, session_date)
);

CREATE INDEX idx_watch_stats_user    ON tv_watch_stats (user_id, session_date DESC);
CREATE INDEX idx_watch_stats_channel ON tv_watch_stats (channel_id, session_date DESC);

-- ── User playlists (M3U / Xtream imports) ────────────────────────────────────
CREATE TABLE tv_user_playlists (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  type            TEXT        NOT NULL DEFAULT 'url'
                              CHECK (type IN ('url', 'paste', 'xtream')),
  source_url      TEXT,
  xtream_host     TEXT,
  xtream_user     TEXT,
  channel_count   INT         NOT NULL DEFAULT 0,
  last_synced_at  TIMESTAMPTZ,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_playlists_user ON tv_user_playlists (user_id, is_active, created_at DESC);

-- ── Stream session (active playback tracking) ─────────────────────────────────
CREATE TABLE tv_stream_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel_id    UUID        NOT NULL REFERENCES tv_channels (id),
  source_id     UUID        REFERENCES tv_stream_sources (id),
  token         TEXT        NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    TEXT,
  user_agent    TEXT
);

CREATE INDEX idx_sessions_token   ON tv_stream_sessions (token);
CREATE INDEX idx_sessions_user    ON tv_stream_sessions (user_id);
CREATE INDEX idx_sessions_expires ON tv_stream_sessions (expires_at);

-- ── Platform analytics (stream health events) ─────────────────────────────────
CREATE TABLE tv_stream_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID        NOT NULL REFERENCES tv_channels (id),
  source_id   UUID        REFERENCES tv_stream_sources (id),
  user_id     UUID        REFERENCES users (id),
  event_type  TEXT        NOT NULL
              CHECK (event_type IN ('start','stop','error','buffer','switch','quality_change')),
  latency_ms  INT,
  detail      JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (occurred_at);

-- Partition by month for efficient pruning
CREATE TABLE tv_stream_events_2026_06 PARTITION OF tv_stream_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE tv_stream_events_2026_07 PARTITION OF tv_stream_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE INDEX idx_stream_events_channel ON tv_stream_events (channel_id, occurred_at DESC);
CREATE INDEX idx_stream_events_source  ON tv_stream_events (source_id,  occurred_at DESC);

-- Convenience function: upsert watch stats
CREATE OR REPLACE FUNCTION upsert_watch_stats(
  _user_id    UUID,
  _channel_id UUID,
  _secs       INT
) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO tv_watch_stats (user_id, channel_id, session_date, watch_secs, session_count)
  VALUES (_user_id, _channel_id, CURRENT_DATE, _secs, 1)
  ON CONFLICT (user_id, channel_id, session_date)
  DO UPDATE SET
    watch_secs    = tv_watch_stats.watch_secs    + _secs,
    session_count = tv_watch_stats.session_count + 1;
$$;
