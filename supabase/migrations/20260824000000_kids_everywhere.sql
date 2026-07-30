-- ============================================================
-- Migration: VisionKids Everywhere — Multi-Platform & Offline (Phase 18).
--
-- Backs the sync + device layer. Everything is per-user under strict owner-only
-- RLS. The client keeps an offline queue in IndexedDB and flushes it here when
-- back online; the server records devices, sessions, a durable sync queue, an
-- append-only sync-event log (so no sync silently loses data), downloads, and
-- per-user preferences that roam across devices.
-- ============================================================

-- ── Devices ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_key   TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT 'Device',
  platform     TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','pwa','android','ios','windows','macos','tv')),
  app_version  TEXT,
  last_active  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_key)
);
ALTER TABLE public.kids_devices ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_devices_user ON public.kids_devices(user_id, last_active DESC);
CREATE POLICY "kids_devices: owner reads" ON public.kids_devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_devices: owner deletes" ON public.kids_devices FOR DELETE USING (auth.uid() = user_id);
-- Insert/update via register/touch RPCs.

-- ── Device sessions (login history per device) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_device_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id    UUID REFERENCES public.kids_devices(id) ON DELETE CASCADE,
  login_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  revoked      BOOLEAN NOT NULL DEFAULT FALSE
);
ALTER TABLE public.kids_device_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_device_sessions_user ON public.kids_device_sessions(user_id, login_at DESC);
CREATE POLICY "kids_device_sessions: owner reads" ON public.kids_device_sessions FOR SELECT USING (auth.uid() = user_id);

-- ── Sync queue (durable server copy of pending client changes) ───────────────
CREATE TABLE IF NOT EXISTS public.kids_sync_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_key   TEXT,
  entity       TEXT NOT NULL,
  entity_id    TEXT,
  op           TEXT NOT NULL DEFAULT 'upsert' CHECK (op IN ('upsert','delete')),
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_ts    TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','conflict')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_sync_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_sync_queue_user ON public.kids_sync_queue(user_id, status, client_ts);
CREATE POLICY "kids_sync_queue: owner reads" ON public.kids_sync_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_sync_queue: owner writes" ON public.kids_sync_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_sync_queue: owner updates" ON public.kids_sync_queue FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Sync events (append-only audit; never lose data silently) ────────────────
CREATE TABLE IF NOT EXISTS public.kids_sync_events (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_key   TEXT,
  kind         TEXT NOT NULL CHECK (kind IN ('sync_start','sync_complete','sync_failed','conflict_resolved','conflict_kept_both')),
  entity       TEXT,
  detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_sync_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_sync_events_user ON public.kids_sync_events(user_id, created_at DESC);
CREATE POLICY "kids_sync_events: owner reads" ON public.kids_sync_events FOR SELECT USING (auth.uid() = user_id);
-- Written via log_kids_sync_event RPC.

-- ── Downloads (registry of offline-downloaded content) ───────────────────────
CREATE TABLE IF NOT EXISTS public.kids_downloads (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_kind TEXT NOT NULL CHECK (content_kind IN ('story','audio','lesson','game','quiz','worksheet')),
  ref_id       TEXT NOT NULL,
  title        TEXT NOT NULL,
  size_kb      INTEGER NOT NULL DEFAULT 0,
  device_key   TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_kind, ref_id)
);
ALTER TABLE public.kids_downloads ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_downloads_user ON public.kids_downloads(user_id, content_kind);
CREATE POLICY "kids_downloads: owner reads" ON public.kids_downloads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_downloads: owner writes" ON public.kids_downloads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_downloads: owner deletes" ON public.kids_downloads FOR DELETE USING (auth.uid() = user_id);

-- ── Offline sessions (usage while offline, for later analytics) ──────────────
CREATE TABLE IF NOT EXISTS public.kids_offline_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_key   TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  minutes      INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.kids_offline_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_offline_sessions: owner reads" ON public.kids_offline_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_offline_sessions: owner writes" ON public.kids_offline_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── User preferences (roam across devices: low-data, tv mode, autodownload) ──
CREATE TABLE IF NOT EXISTS public.kids_user_preferences (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  low_data      BOOLEAN NOT NULL DEFAULT FALSE,
  wifi_only     BOOLEAN NOT NULL DEFAULT TRUE,
  auto_download BOOLEAN NOT NULL DEFAULT FALSE,
  tv_mode       BOOLEAN NOT NULL DEFAULT FALSE,
  audio_guidance BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_user_preferences: owner reads" ON public.kids_user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_user_preferences: owner writes" ON public.kids_user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_user_preferences: owner updates" ON public.kids_user_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- RPCs
-- ============================================================

-- Register (or refresh) the current device; opens a session on first sight.
CREATE OR REPLACE FUNCTION public.register_kids_device(_device_key TEXT, _name TEXT, _platform TEXT, _app_version TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid(); _id UUID; _existed BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _platform NOT IN ('web','pwa','android','ios','windows','macos','tv') THEN _platform := 'web'; END IF;

  SELECT id INTO _id FROM public.kids_devices WHERE user_id = _uid AND device_key = _device_key;
  _existed := _id IS NOT NULL;

  INSERT INTO public.kids_devices (user_id, device_key, name, platform, app_version, last_active)
  VALUES (_uid, _device_key, COALESCE(NULLIF(btrim(_name), ''), 'Device'), _platform, _app_version, now())
  ON CONFLICT (user_id, device_key) DO UPDATE
    SET name = EXCLUDED.name, platform = EXCLUDED.platform, app_version = EXCLUDED.app_version, last_active = now()
  RETURNING id INTO _id;

  IF NOT _existed THEN
    INSERT INTO public.kids_device_sessions (user_id, device_id) VALUES (_uid, _id);
  END IF;
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_kids_device(TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_kids_device(_device_key TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.kids_devices SET last_active = now() WHERE user_id = auth.uid() AND device_key = _device_key;
END;
$$;
GRANT EXECUTE ON FUNCTION public.touch_kids_device(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.sign_out_kids_device(_device_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  UPDATE public.kids_device_sessions SET revoked = TRUE, ended_at = now()
    WHERE user_id = auth.uid() AND device_id = _device_id AND NOT revoked;
  DELETE FROM public.kids_devices WHERE user_id = auth.uid() AND id = _device_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sign_out_kids_device(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.sign_out_all_kids_devices(_keep_device_key TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  UPDATE public.kids_device_sessions SET revoked = TRUE, ended_at = now() WHERE user_id = auth.uid() AND NOT revoked;
  DELETE FROM public.kids_devices WHERE user_id = auth.uid() AND (_keep_device_key IS NULL OR device_key <> _keep_device_key);
END;
$$;
GRANT EXECUTE ON FUNCTION public.sign_out_all_kids_devices(TEXT) TO authenticated;

-- Log a sync event (append-only). Used by the client sync engine.
CREATE OR REPLACE FUNCTION public.log_kids_sync_event(_device_key TEXT, _kind TEXT, _entity TEXT, _detail JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  INSERT INTO public.kids_sync_events (user_id, device_key, kind, entity, detail)
  VALUES (auth.uid(), _device_key, _kind, _entity, COALESCE(_detail, '{}'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_kids_sync_event(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Upsert roaming preferences.
CREATE OR REPLACE FUNCTION public.save_kids_preferences(_low_data BOOLEAN, _wifi_only BOOLEAN, _auto_download BOOLEAN, _tv_mode BOOLEAN, _audio_guidance BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  INSERT INTO public.kids_user_preferences (user_id, low_data, wifi_only, auto_download, tv_mode, audio_guidance, updated_at)
  VALUES (auth.uid(), _low_data, _wifi_only, _auto_download, _tv_mode, _audio_guidance, now())
  ON CONFLICT (user_id) DO UPDATE
    SET low_data = EXCLUDED.low_data, wifi_only = EXCLUDED.wifi_only, auto_download = EXCLUDED.auto_download,
        tv_mode = EXCLUDED.tv_mode, audio_guidance = EXCLUDED.audio_guidance, updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_kids_preferences(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
