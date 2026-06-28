-- AI Media Studio: complete schema
-- Tables: projects, assets, folders, templates, activity_logs, favorites, user_preferences, storage_usage

-- ─── PROJECTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_projects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deleted')),
  is_favorite    boolean NOT NULL DEFAULT false,
  tags           text[] NOT NULL DEFAULT '{}',
  language       text NOT NULL DEFAULT 'en',
  voice_preset   text,
  video_preset   text,
  thumbnail_url  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ams_projects_owner_idx ON ams_projects(owner_id);
CREATE INDEX IF NOT EXISTS ams_projects_status_idx ON ams_projects(status);
CREATE INDEX IF NOT EXISTS ams_projects_created_at_idx ON ams_projects(created_at DESC);

ALTER TABLE ams_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ams_projects_owner_all" ON ams_projects
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ─── FOLDERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES ams_projects(id) ON DELETE CASCADE,
  parent_id  uuid REFERENCES ams_folders(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ams_folders_owner_idx    ON ams_folders(owner_id);
CREATE INDEX IF NOT EXISTS ams_folders_project_idx  ON ams_folders(project_id);

ALTER TABLE ams_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ams_folders_owner_all" ON ams_folders
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ─── ASSETS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_assets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id     uuid REFERENCES ams_projects(id) ON DELETE SET NULL,
  folder_id      uuid REFERENCES ams_folders(id) ON DELETE SET NULL,
  filename       text NOT NULL,
  original_name  text NOT NULL,
  asset_type     text NOT NULL CHECK (asset_type IN ('audio','video','image','document','generated','other')),
  mime_type      text,
  size_bytes     bigint NOT NULL DEFAULT 0,
  duration_sec   numeric,
  thumbnail_url  text,
  storage_path   text,
  public_url     text,
  status         text NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading','processing','ready','error','deleted')),
  metadata       jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ams_assets_owner_idx    ON ams_assets(owner_id);
CREATE INDEX IF NOT EXISTS ams_assets_project_idx  ON ams_assets(project_id);
CREATE INDEX IF NOT EXISTS ams_assets_type_idx     ON ams_assets(asset_type);
CREATE INDEX IF NOT EXISTS ams_assets_status_idx   ON ams_assets(status);
CREATE INDEX IF NOT EXISTS ams_assets_created_idx  ON ams_assets(created_at DESC);

ALTER TABLE ams_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ams_assets_owner_all" ON ams_assets
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ─── TEMPLATES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  category     text NOT NULL DEFAULT 'general',
  template_type text NOT NULL CHECK (template_type IN ('speech','voice','video','general')),
  config       jsonb NOT NULL DEFAULT '{}',
  thumbnail_url text,
  is_public    boolean NOT NULL DEFAULT true,
  owner_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usage_count  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ams_templates_type_idx      ON ams_templates(template_type);
CREATE INDEX IF NOT EXISTS ams_templates_category_idx  ON ams_templates(category);
CREATE INDEX IF NOT EXISTS ams_templates_public_idx    ON ams_templates(is_public);

ALTER TABLE ams_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ams_templates_public_read" ON ams_templates
  FOR SELECT USING (is_public = true OR owner_id = auth.uid());

CREATE POLICY "ams_templates_owner_write" ON ams_templates
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ─── ACTIVITY LOGS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_activity_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES ams_projects(id) ON DELETE CASCADE,
  asset_id    uuid REFERENCES ams_assets(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  details     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ams_activity_user_idx    ON ams_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS ams_activity_project_idx ON ams_activity_logs(project_id);
CREATE INDEX IF NOT EXISTS ams_activity_created_idx ON ams_activity_logs(created_at DESC);

ALTER TABLE ams_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ams_activity_owner_read" ON ams_activity_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "ams_activity_owner_insert" ON ams_activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── FAVORITES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('project','asset','template')),
  entity_id   uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS ams_favorites_user_idx ON ams_favorites(user_id);

ALTER TABLE ams_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ams_favorites_owner_all" ON ams_favorites
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── USER PREFERENCES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_user_preferences (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_language     text NOT NULL DEFAULT 'en',
  default_voice_preset text,
  default_video_preset text,
  notifications        jsonb NOT NULL DEFAULT '{"upload_complete":true,"upload_failed":true,"project_created":true,"storage_warning":true}',
  ui_preferences       jsonb NOT NULL DEFAULT '{"theme":"system","sidebar_collapsed":false,"default_view":"grid"}',
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ams_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ams_prefs_owner_all" ON ams_user_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── STORAGE USAGE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_storage_usage (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  used_bytes     bigint NOT NULL DEFAULT 0,
  quota_bytes    bigint NOT NULL DEFAULT 5368709120, -- 5 GB default
  asset_count    integer NOT NULL DEFAULT 0,
  project_count  integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ams_storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ams_storage_owner_read" ON ams_storage_usage
  FOR SELECT USING (user_id = auth.uid());

-- ─── TRIGGERS: updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ams_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ams_projects_updated_at
  BEFORE UPDATE ON ams_projects
  FOR EACH ROW EXECUTE FUNCTION ams_touch_updated_at();

CREATE TRIGGER ams_assets_updated_at
  BEFORE UPDATE ON ams_assets
  FOR EACH ROW EXECUTE FUNCTION ams_touch_updated_at();

-- ─── RPC: log activity ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ams_log_activity(
  p_project_id  uuid,
  p_asset_id    uuid,
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_details     jsonb DEFAULT '{}'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ams_activity_logs(user_id, project_id, asset_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), p_project_id, p_asset_id, p_action, p_entity_type, p_entity_id, p_details);
END;
$$;

-- ─── RPC: update storage usage ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ams_recalculate_storage(p_user_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_used bigint;
  v_assets integer;
  v_projects integer;
BEGIN
  SELECT COALESCE(SUM(size_bytes), 0), COUNT(*)
    INTO v_used, v_assets
    FROM ams_assets
    WHERE owner_id = v_uid AND status != 'deleted';

  SELECT COUNT(*) INTO v_projects
    FROM ams_projects
    WHERE owner_id = v_uid AND status != 'deleted';

  INSERT INTO ams_storage_usage(user_id, used_bytes, asset_count, project_count, updated_at)
  VALUES (v_uid, v_used, v_assets, v_projects, now())
  ON CONFLICT (user_id) DO UPDATE SET
    used_bytes    = EXCLUDED.used_bytes,
    asset_count   = EXCLUDED.asset_count,
    project_count = EXCLUDED.project_count,
    updated_at    = now();
END;
$$;

-- ─── SEED DEFAULT TEMPLATES ──────────────────────────────────────────────────
INSERT INTO ams_templates(name, description, category, template_type, config, is_public, owner_id) VALUES
  ('Professional Narration', 'Clear, neutral voice for corporate content', 'business', 'speech', '{"speed":1.0,"pitch":0,"style":"neutral"}', true, NULL),
  ('News Broadcast', 'Authoritative news-reading style', 'news', 'speech', '{"speed":1.1,"pitch":-1,"style":"news"}', true, NULL),
  ('Storytelling', 'Warm, engaging tone for storytelling', 'creative', 'speech', '{"speed":0.95,"pitch":1,"style":"storytelling"}', true, NULL),
  ('E-Learning Module', 'Clear and educational delivery style', 'education', 'speech', '{"speed":0.9,"pitch":0,"style":"educational"}', true, NULL),
  ('Podcast Intro', 'Energetic podcast-style opener', 'media', 'speech', '{"speed":1.05,"pitch":2,"style":"energetic"}', true, NULL),
  ('Meditation Guide', 'Slow, calming voice for wellness content', 'wellness', 'speech', '{"speed":0.8,"pitch":-2,"style":"calm"}', true, NULL)
ON CONFLICT DO NOTHING;
