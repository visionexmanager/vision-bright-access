-- AI Media Studio — Image Studio schema
-- Table: ams_image_jobs
-- Storage: image-outputs bucket

-- ─── STORAGE BUCKET ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'image-outputs',
  'image-outputs',
  false,
  104857600,   -- 100 MB per file
  ARRAY[
    'image/png','image/jpeg','image/webp','image/gif'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ─── IMAGE JOBS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_image_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES ams_projects(id) ON DELETE SET NULL,
  asset_id         uuid REFERENCES ams_assets(id) ON DELETE SET NULL,

  -- Input
  prompt           text NOT NULL,
  revised_prompt   text,
  model            text NOT NULL DEFAULT 'dall-e-3',
  size             text NOT NULL DEFAULT '1024x1024',
  quality          text NOT NULL DEFAULT 'standard' CHECK (quality IN ('standard','hd')),
  style            text NOT NULL DEFAULT 'vivid'    CHECK (style IN ('vivid','natural')),

  -- Output
  image_url        text,
  storage_path     text,
  width            integer,
  height           integer,

  -- Status
  status           text NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  error_message    text,

  -- Timestamps
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS ams_image_jobs_user_idx    ON ams_image_jobs(user_id);
CREATE INDEX IF NOT EXISTS ams_image_jobs_status_idx  ON ams_image_jobs(status);
CREATE INDEX IF NOT EXISTS ams_image_jobs_created_idx ON ams_image_jobs(created_at DESC);

ALTER TABLE ams_image_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ams_image_jobs_owner_all" ON ams_image_jobs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── BILLING RULE for image generation ───────────────────────────────────────
INSERT INTO billing_rules (id, vx_cost, description)
VALUES ('image_generation', 50, 'DALL·E 3 image generation (1 image)')
ON CONFLICT (id) DO NOTHING;
