-- ============================================================
-- VISIONEX TV — Production Upgrade Migration
-- Adds: favorites, multi-source failover, user playlists,
--       watch analytics, recommendations RPC
-- ============================================================

-- ─── 1. TV FAVORITES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tv_favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.tv_channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, channel_id)
);

ALTER TABLE public.tv_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tv_favorites_user_own"
  ON public.tv_favorites FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tv_favorites_user_idx ON public.tv_favorites (user_id);

-- ─── 2. TV STREAM SOURCES (multi-source failover) ────────────
-- Each channel can have multiple stream sources ranked by priority.
-- The player tries them in priority order; failed sources are
-- given a cooldown so alternate sources get promoted.
CREATE TABLE IF NOT EXISTS public.tv_stream_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      UUID NOT NULL REFERENCES public.tv_channels(id) ON DELETE CASCADE,
  label           TEXT NOT NULL DEFAULT 'Primary',
  url             TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'hls'
                  CHECK (type IN ('hls','dash','mp4','rtmp','youtube')),
  priority        INTEGER NOT NULL DEFAULT 0,   -- lower = higher priority
  reliability     NUMERIC(5,2) NOT NULL DEFAULT 100.0
                  CHECK (reliability BETWEEN 0 AND 100),
  last_checked_at TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tv_stream_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tv_stream_sources_read_active"
  ON public.tv_stream_sources FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

CREATE POLICY "tv_stream_sources_admin_all"
  ON public.tv_stream_sources FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS tv_stream_sources_channel_priority_idx
  ON public.tv_stream_sources (channel_id, priority ASC);

-- ─── 3. USER-IMPORTED PLAYLISTS (M3U / Xtream) ───────────────
CREATE TABLE IF NOT EXISTS public.tv_user_playlists (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'm3u'
                 CHECK (type IN ('m3u', 'xtream', 'url')),
  source_url     TEXT,         -- public M3U URL or Xtream server URL
  xtream_host    TEXT,
  xtream_user    TEXT,
  xtream_pass    TEXT,
  channel_count  INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tv_user_playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tv_user_playlists_user_own"
  ON public.tv_user_playlists FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tv_user_playlists_user_idx
  ON public.tv_user_playlists (user_id);

-- ─── 4. WATCH ANALYTICS (per-user, per-channel, per-day) ─────
-- Used for: recommendations, analytics dashboard, trending
CREATE TABLE IF NOT EXISTS public.tv_watch_stats (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id     UUID NOT NULL REFERENCES public.tv_channels(id) ON DELETE CASCADE,
  watch_duration INTEGER NOT NULL DEFAULT 0,    -- cumulative seconds for session_date
  session_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, channel_id, session_date)
);

ALTER TABLE public.tv_watch_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tv_watch_stats_user_own"
  ON public.tv_watch_stats FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tv_watch_stats_user_date_idx
  ON public.tv_watch_stats (user_id, session_date DESC);

CREATE INDEX IF NOT EXISTS tv_watch_stats_channel_idx
  ON public.tv_watch_stats (channel_id);

-- ─── 5. RPC: toggle_tv_favorite ──────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_tv_favorite(_channel_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists  BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM tv_favorites
    WHERE user_id = v_user_id AND channel_id = _channel_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM tv_favorites
    WHERE user_id = v_user_id AND channel_id = _channel_id;
    RETURN jsonb_build_object('success', true, 'action', 'removed');
  ELSE
    INSERT INTO tv_favorites (user_id, channel_id)
    VALUES (v_user_id, _channel_id);
    RETURN jsonb_build_object('success', true, 'action', 'added');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_tv_favorite TO authenticated;

-- ─── 6. RPC: get_tv_favorites ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_tv_favorites()
RETURNS TABLE (channel_id UUID, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT channel_id, created_at
  FROM   tv_favorites
  WHERE  user_id = auth.uid()
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_tv_favorites TO authenticated;

-- ─── 7. RPC: record_tv_watch ─────────────────────────────────
-- Called client-side every 30s while a channel is playing.
CREATE OR REPLACE FUNCTION public.record_tv_watch(
  _channel_id UUID,
  _seconds    INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL OR _seconds <= 0 THEN RETURN; END IF;

  INSERT INTO tv_watch_stats (user_id, channel_id, watch_duration, session_date)
  VALUES (v_user, _channel_id, _seconds, CURRENT_DATE)
  ON CONFLICT (user_id, channel_id, session_date)
  DO UPDATE SET
    watch_duration = tv_watch_stats.watch_duration + EXCLUDED.watch_duration,
    updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_tv_watch TO authenticated;

-- ─── 8. RPC: get_tv_recommendations ──────────────────────────
-- Returns channels ranked by watch time over last 30 days,
-- excluding channels already watched today.
CREATE OR REPLACE FUNCTION public.get_tv_recommendations(_limit INTEGER DEFAULT 12)
RETURNS TABLE (
  channel_id UUID,
  total_watch_seconds BIGINT,
  reason TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ws.channel_id,
    SUM(ws.watch_duration)::BIGINT AS total_watch_seconds,
    'based_on_watch_history' AS reason
  FROM tv_watch_stats ws
  JOIN tv_channels c ON c.id = ws.channel_id AND c.is_active = TRUE
  WHERE ws.user_id = auth.uid()
    AND ws.session_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY ws.channel_id
  ORDER BY SUM(ws.watch_duration) DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_tv_recommendations TO authenticated;

-- ─── 9. RPC: get_tv_trending ──────────────────────────────────
-- Most-watched channels platform-wide in the last 7 days.
CREATE OR REPLACE FUNCTION public.get_tv_trending(_limit INTEGER DEFAULT 12)
RETURNS TABLE (
  channel_id       UUID,
  unique_viewers   BIGINT,
  total_watch_time BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ws.channel_id,
    COUNT(DISTINCT ws.user_id) AS unique_viewers,
    SUM(ws.watch_duration)     AS total_watch_time
  FROM tv_watch_stats ws
  JOIN tv_channels c ON c.id = ws.channel_id AND c.is_active = TRUE
  WHERE ws.session_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY ws.channel_id
  ORDER BY unique_viewers DESC, total_watch_time DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_tv_trending TO authenticated;

-- ─── 10. RPC: update_source_reliability ──────────────────────
-- Called by health monitor edge function to update stream scores.
CREATE OR REPLACE FUNCTION public.update_source_reliability(
  _source_id   UUID,
  _reliability NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  UPDATE tv_stream_sources
  SET reliability     = GREATEST(0, LEAST(100, _reliability)),
      last_checked_at = NOW(),
      updated_at      = NOW()
  WHERE id = _source_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_source_reliability TO authenticated;
