-- ─────────────────────────────────────────────────────────────────────────────
-- TV system hardening migration
-- 1. Concurrency-safe toggle_tv_favorite  (prevents race conditions)
-- 2. Performance indexes for common query patterns
-- 3. Cleanup function for old watch stats
-- 4. Limit extreme-growth on tv_user_playlists per user
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Concurrency-safe toggle_tv_favorite ───────────────────────────────────
-- pg_advisory_xact_lock serializes concurrent calls for the same user+channel.
-- The second concurrent click waits rather than racing and reversing the first.

CREATE OR REPLACE FUNCTION toggle_tv_favorite(_channel_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id  UUID  := auth.uid();
  _lock_key BIGINT;
  _exists   BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN
    RETURN '{"success":false,"error":"not_authenticated"}'::JSONB;
  END IF;

  -- Advisory lock scoped to this transaction — auto-released on commit/rollback.
  -- Prevents two concurrent toggles for the same user+channel from racing.
  _lock_key := hashtext(_user_id::TEXT || _channel_id::TEXT);
  PERFORM pg_advisory_xact_lock(_lock_key);

  SELECT EXISTS (
    SELECT 1 FROM tv_favorites
    WHERE user_id = _user_id AND channel_id = _channel_id
  ) INTO _exists;

  IF _exists THEN
    DELETE FROM tv_favorites
    WHERE user_id = _user_id AND channel_id = _channel_id;
    RETURN '{"success":true,"action":"removed"}'::JSONB;
  ELSE
    INSERT INTO tv_favorites (user_id, channel_id)
    VALUES (_user_id, _channel_id)
    ON CONFLICT (user_id, channel_id) DO NOTHING;
    RETURN '{"success":true,"action":"added"}'::JSONB;
  END IF;
END;
$$;

-- ── 2. Performance indexes ────────────────────────────────────────────────────

-- tv_watch_stats: analytics queries filter by date range, aggregate by channel
CREATE INDEX IF NOT EXISTS idx_tv_watch_stats_date
  ON tv_watch_stats (session_date DESC);

CREATE INDEX IF NOT EXISTS idx_tv_watch_stats_channel_date
  ON tv_watch_stats (channel_id, session_date DESC);

-- tv_stream_sources: failover query orders by priority then reliability
CREATE INDEX IF NOT EXISTS idx_tv_stream_sources_failover
  ON tv_stream_sources (channel_id, is_active, priority, reliability DESC);

-- tv_user_playlists: per-user active playlist queries
CREATE INDEX IF NOT EXISTS idx_tv_user_playlists_active
  ON tv_user_playlists (user_id, is_active, created_at DESC);

-- tv_favorites: cover index for get_tv_favorites RPC
CREATE INDEX IF NOT EXISTS idx_tv_favorites_user_channel
  ON tv_favorites (user_id, channel_id);

-- ── 3. Old data cleanup ───────────────────────────────────────────────────────
-- Callable by a scheduled cron job or admin; prunes watch stats older than 90 days.

CREATE OR REPLACE FUNCTION cleanup_old_tv_data()
RETURNS TABLE (deleted_watch_rows BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted BIGINT;
BEGIN
  DELETE FROM tv_watch_stats
  WHERE session_date < CURRENT_DATE - INTERVAL '90 days';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN QUERY SELECT _deleted;
END;
$$;

-- Only service role can call cleanup
REVOKE ALL ON FUNCTION cleanup_old_tv_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_old_tv_data() TO service_role;

-- ── 4. Playlist per-user cap ─────────────────────────────────────────────────
-- Enforce a max of 20 active playlists per user via a trigger, preventing
-- unbounded storage growth from automated imports.

CREATE OR REPLACE FUNCTION check_playlist_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  _count INT;
BEGIN
  SELECT COUNT(*) INTO _count
  FROM tv_user_playlists
  WHERE user_id = NEW.user_id AND is_active = TRUE;

  IF _count >= 20 THEN
    RAISE EXCEPTION 'Maximum of 20 active playlists allowed per user'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_playlist_limit ON tv_user_playlists;
CREATE TRIGGER trg_playlist_limit
  BEFORE INSERT ON tv_user_playlists
  FOR EACH ROW EXECUTE FUNCTION check_playlist_limit();
