-- Migration 004: stream health metrics + user preferences column

-- ── Users: preferences JSONB ──────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── tv_stream_sources: health tracking columns ────────────────────────────
ALTER TABLE tv_stream_sources
  ADD COLUMN IF NOT EXISTS latency_ms    INTEGER,
  ADD COLUMN IF NOT EXISTS success_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

-- ── tv_watch_history: source tracking ────────────────────────────────────
ALTER TABLE tv_watch_history
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES tv_stream_sources(id) ON DELETE SET NULL;

-- ── tv_stream_sessions: tracking for active sessions ─────────────────────
CREATE TABLE IF NOT EXISTS tv_stream_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id   UUID        NOT NULL REFERENCES tv_channels(id) ON DELETE CASCADE,
  source_id    UUID        REFERENCES tv_stream_sources(id) ON DELETE SET NULL,
  token        TEXT        NOT NULL UNIQUE,
  ip_address   INET,
  user_agent   TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stream_sessions_token     ON tv_stream_sessions(token);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_user      ON tv_stream_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_expires   ON tv_stream_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_stream_sources_reliability ON tv_stream_sources(reliability DESC);
CREATE INDEX IF NOT EXISTS idx_stream_sources_last_check ON tv_stream_sources(last_checked_at ASC NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_users_email               ON users(email);

-- ── Cleanup job: remove expired sessions ──────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM tv_stream_sessions WHERE expires_at < NOW();
END;
$$;

-- ── upsert_watch_stats (safe to recreate) ────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_watch_stats(
  p_user_id    UUID,
  p_channel_id UUID,
  p_seconds    INT
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO tv_watch_stats (user_id, channel_id, date, total_watch_sec, watch_count)
  VALUES (p_user_id, p_channel_id, CURRENT_DATE, p_seconds, 1)
  ON CONFLICT (user_id, channel_id, date)
  DO UPDATE SET
    total_watch_sec = tv_watch_stats.total_watch_sec + EXCLUDED.total_watch_sec,
    watch_count     = tv_watch_stats.watch_count     + 1;
END;
$$;
