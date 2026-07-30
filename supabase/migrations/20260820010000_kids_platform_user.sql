-- ============================================================
-- Migration: VisionKids Platform Core (Phase 14) — per-child platform state:
-- plugin installs, dashboard widgets, theme preference, notifications, audit.
--
-- PRIVACY / SECURITY: every table is per-child under strict owner-only RLS.
-- Installs record which optional plugins a child has enabled and the granted
-- permission set (permission isolation); dashboard widgets are the child's
-- chosen layout; notifications are their inbox. The audit log is written only
-- by SECURITY DEFINER RPCs (no client INSERT policy).
-- ============================================================

-- ============================================================
-- kids_plugin_installs — a child's enabled optional plugins + granted perms +
-- per-plugin settings. Core plugins are always on and are not listed here.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_plugin_installs (
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_slug        TEXT NOT NULL REFERENCES public.kids_plugins(slug) ON DELETE CASCADE,
  enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  granted_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings           JSONB NOT NULL DEFAULT '{}'::jsonb,
  installed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, plugin_slug)
);

ALTER TABLE public.kids_plugin_installs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_plugin_installs: owner reads" ON public.kids_plugin_installs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_plugin_installs: owner updates" ON public.kids_plugin_installs FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- INSERT/DELETE happen via install/uninstall RPCs (SECURITY DEFINER).

CREATE INDEX IF NOT EXISTS idx_kids_plugin_installs_user ON public.kids_plugin_installs(user_id);

-- ============================================================
-- kids_dashboard_widgets — the child's chosen dashboard layout (ordered).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_dashboard_widgets (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_slug  TEXT NOT NULL REFERENCES public.kids_widgets(slug) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, widget_slug)
);

ALTER TABLE public.kids_dashboard_widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_dashboard_widgets: owner reads" ON public.kids_dashboard_widgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_dashboard_widgets: owner writes" ON public.kids_dashboard_widgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_dashboard_widgets: owner updates" ON public.kids_dashboard_widgets FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_dashboard_widgets: owner deletes" ON public.kids_dashboard_widgets FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- kids_theme_prefs — the child's selected theme (the Theme Engine reads this).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_theme_prefs (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_slug  TEXT NOT NULL DEFAULT 'kids' REFERENCES public.kids_themes(slug) ON DELETE SET DEFAULT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_theme_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_theme_prefs: owner reads" ON public.kids_theme_prefs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_theme_prefs: owner writes" ON public.kids_theme_prefs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_theme_prefs: owner updates" ON public.kids_theme_prefs FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- kids_notifications — the in-app notification inbox (the Notification Engine's
-- store; push/email/SMS channels are delivered out-of-band by future workers).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  emoji       TEXT NOT NULL DEFAULT '🔔',
  channel     TEXT NOT NULL DEFAULT 'in-app' CHECK (channel IN ('in-app','push','email','sms','scheduled')),
  link        TEXT,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_notifications: owner reads" ON public.kids_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_notifications: owner updates" ON public.kids_notifications FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- INSERT via SECURITY DEFINER RPC / server workers only.

CREATE INDEX IF NOT EXISTS idx_kids_notifications_user ON public.kids_notifications(user_id, read, created_at DESC);

-- ============================================================
-- kids_platform_audit — audit trail of install/uninstall/theme actions.
-- Written only by SECURITY DEFINER RPCs.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_platform_audit (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_platform_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_platform_audit: owner reads" ON public.kids_platform_audit FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_platform_audit_user ON public.kids_platform_audit(user_id, created_at DESC);
