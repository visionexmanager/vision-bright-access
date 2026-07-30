-- ============================================================
-- Migration: VisionKids Platform Core & Plugin System (Phase 14) — catalogs.
--
-- Turns VisionKids into a modular platform: features are described by PLUGIN
-- manifests (this catalog), the dashboard is composed of WIDGETS, and the look
-- is a swappable THEME. Everything here is a public, admin-curated catalog;
-- per-child install/enable state + settings live under owner-only RLS in the
-- 20260820010000 migration.
--
-- "Plugin migrations / assets / sandbox": a browser SPA can't run untrusted
-- native code, so a plugin's `entry` names a built-in module the client already
-- ships (see src/features/visionkids/platform/*). Installing toggles visibility
-- and grants the manifest's declared permissions — it never executes uploaded
-- code. This is the honest, safe shape of a plugin system on the web.
-- ============================================================

-- ============================================================
-- kids_plugins — the plugin catalog. `category` groups the marketplace;
-- `entry` is the built-in module key the client resolves; `manifest` carries
-- the full declarative manifest (permissions, routes, dependencies, author,
-- license, localization keys, settings schema).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_plugins (
  slug          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  summary       TEXT,
  emoji         TEXT NOT NULL DEFAULT '🧩',
  category      TEXT NOT NULL CHECK (category IN ('game','story','course','ai-tool','theme','language','widget','integration','core')),
  entry         TEXT NOT NULL,
  author        TEXT NOT NULL DEFAULT 'VisionKids',
  license       TEXT NOT NULL DEFAULT 'standard',
  permissions   JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependencies  JSONB NOT NULL DEFAULT '[]'::jsonb,
  routes        JSONB NOT NULL DEFAULT '[]'::jsonb,
  manifest      JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_core       BOOLEAN NOT NULL DEFAULT FALSE,
  color         TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary','secondary','accent','pink','green','purple')),
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_plugins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_plugins: public read published" ON public.kids_plugins FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_plugins: admins manage" ON public.kids_plugins FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_plugins_cat ON public.kids_plugins(category, order_index);

-- ============================================================
-- kids_plugin_versions — semantic version history per plugin (changelog).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_plugin_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_slug  TEXT NOT NULL REFERENCES public.kids_plugins(slug) ON DELETE CASCADE,
  version      TEXT NOT NULL,
  changelog    TEXT,
  is_current   BOOLEAN NOT NULL DEFAULT FALSE,
  released_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plugin_slug, version)
);

ALTER TABLE public.kids_plugin_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_plugin_versions: public read" ON public.kids_plugin_versions FOR SELECT USING (true);
CREATE POLICY "kids_plugin_versions: admins manage" ON public.kids_plugin_versions FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- kids_widgets — the dashboard widget catalog. `entry` resolves to a built-in
-- widget component (src/features/visionkids/platform/widgetRegistry).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_widgets (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '🔲',
  entry        TEXT NOT NULL,
  size         TEXT NOT NULL DEFAULT 'small' CHECK (size IN ('small','medium','large')),
  needs_auth   BOOLEAN NOT NULL DEFAULT FALSE,
  order_index  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_widgets: public read published" ON public.kids_widgets FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_widgets: admins manage" ON public.kids_widgets FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- kids_themes — the theme catalog. `variant` maps to the base color scheme the
-- Theme Engine applies; `data_theme` is the value stamped on <html data-kids-theme>.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_themes (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '🎨',
  variant      TEXT NOT NULL DEFAULT 'light' CHECK (variant IN ('light','dark','high-contrast')),
  data_theme   TEXT NOT NULL,
  is_seasonal  BOOLEAN NOT NULL DEFAULT FALSE,
  order_index  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_themes: public read published" ON public.kids_themes FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_themes: admins manage" ON public.kids_themes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Seeds — core feature plugins (map the existing VisionKids sections),
-- plus a few installable extensions, the dashboard widgets, and the themes.
-- ============================================================
INSERT INTO public.kids_plugins (slug, name, summary, emoji, category, entry, is_core, color, order_index, permissions) VALUES
  ('stories',  'Story Library',      'Read and listen to fun stories.',           '📚', 'core', 'section:stories', TRUE, 'primary',   0, '["read:stories"]'),
  ('games',    'Games Arcade',       'Play safe learning games.',                 '🎮', 'core', 'section:games',   TRUE, 'secondary', 1, '["read:games"]'),
  ('academy',  'Academy',            'Courses and lessons for every subject.',    '🎓', 'core', 'section:academy', TRUE, 'accent',    2, '["read:academy"]'),
  ('talent',   'Talent Hub',         'Grow real, future-ready skills.',           '🌟', 'core', 'section:talent',  TRUE, 'purple',    3, '["read:talent"]'),
  ('health',   'Health & Wellness',  'Healthy habits, mood, and safety.',         '💚', 'core', 'section:health',  TRUE, 'green',     4, '["read:health","write:health-logs"]'),
  ('stem',     'STEM Center',        'Experiments, robotics, and inventions.',    '🔬', 'core', 'section:stem',    TRUE, 'secondary', 5, '["read:stem","write:projects"]'),
  ('world',    'VisionKids World',   'An open world to explore and build.',       '🌍', 'core', 'section:world',   TRUE, 'primary',   6, '["read:world","spend:coins"]'),
  ('market',   'Creator Marketplace','Safe content from teachers and creators.',  '🛍️', 'core', 'section:market',  TRUE, 'accent',    7, '["read:market","spend:coins"]'),
  -- Installable extensions (marketplace demo entries)
  ('ai-tutor',       'AI Study Buddy',   'A friendly AI helper for lessons.',     '🤖', 'ai-tool',     'ext:ai-tutor',       FALSE, 'purple',   10, '["use:ai"]'),
  ('theme-pack-sea', 'Ocean Theme Pack', 'Calming ocean colors and seasonal art.','🌊', 'theme',       'ext:theme-sea',      FALSE, 'secondary',11, '["apply:theme"]'),
  ('lang-pack-fr',   'French Language',  'Adds a full French interface.',         '🇫🇷', 'language',     'ext:lang-fr',        FALSE, 'primary',  12, '["apply:language"]'),
  ('widget-pack',    'Extra Widgets',    'More dashboard widgets to choose from.','🔲', 'widget',      'ext:widget-pack',    FALSE, 'green',    13, '["add:widgets"]'),
  ('integ-calendar', 'Calendar Sync',    'Show learning events on a calendar.',   '📅', 'integration', 'ext:integ-calendar', FALSE, 'pink',     14, '["read:calendar"]')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_plugin_versions (plugin_slug, version, changelog, is_current) VALUES
  ('ai-tutor', '1.0.0', 'First release of the AI Study Buddy.', TRUE),
  ('theme-pack-sea', '1.0.0', 'Ocean colors and seasonal art.', TRUE),
  ('lang-pack-fr', '1.0.0', 'French interface strings.', TRUE),
  ('widget-pack', '1.0.0', 'Adds calendar, bookmarks, and AI suggestion widgets.', TRUE),
  ('integ-calendar', '1.0.0', 'Calendar integration.', TRUE)
ON CONFLICT (plugin_slug, version) DO NOTHING;

INSERT INTO public.kids_widgets (slug, name, emoji, entry, size, needs_auth, order_index) VALUES
  ('clock',            'Clock',              '🕐', 'widget:clock',            'small',  FALSE, 0),
  ('weather',          'Weather',            '⛅', 'widget:weather',          'small',  FALSE, 1),
  ('todays-challenge', 'Today''s Challenge', '🎯', 'widget:todaysChallenge',  'medium', FALSE, 2),
  ('continue-reading', 'Continue Reading',   '📖', 'widget:continueReading',  'medium', TRUE,  3),
  ('progress',         'My Progress',        '📈', 'widget:progress',         'small',  TRUE,  4),
  ('achievements',     'Achievements',       '🏅', 'widget:achievements',     'small',  TRUE,  5),
  ('daily-goal',       'Daily Goal',         '✅', 'widget:dailyGoal',        'small',  TRUE,  6),
  ('calendar',         'Calendar',           '📅', 'widget:calendar',         'medium', FALSE, 7),
  ('bookmarks',        'Bookmarks',          '🔖', 'widget:bookmarks',        'medium', TRUE,  8),
  ('ai-suggestions',   'AI Suggestions',     '💡', 'widget:aiSuggestions',    'medium', FALSE, 9)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_themes (slug, name, emoji, variant, data_theme, is_seasonal, order_index) VALUES
  ('kids',          'Kids',           '🌈', 'light',         'kids',          FALSE, 0),
  ('light',         'Light',          '☀️', 'light',         'light',         FALSE, 1),
  ('dark',          'Dark',           '🌙', 'dark',          'dark',          FALSE, 2),
  ('high-contrast', 'High Contrast',  '🔲', 'high-contrast', 'high-contrast', FALSE, 3),
  ('accessible',    'Accessible',     '♿', 'light',         'accessible',    FALSE, 4),
  ('spring',        'Spring',         '🌸', 'light',         'spring',        TRUE,  5),
  ('summer',        'Summer',         '🏖️', 'light',         'summer',        TRUE,  6),
  ('autumn',        'Autumn',         '🍂', 'light',         'autumn',        TRUE,  7),
  ('winter',        'Winter',         '❄️', 'dark',          'winter',        TRUE,  8)
ON CONFLICT (slug) DO NOTHING;
