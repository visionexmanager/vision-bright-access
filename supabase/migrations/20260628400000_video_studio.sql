-- AI Media Studio — Video Studio schema
-- Tables: vx_video_jobs, vx_video_templates
-- Storage: video-outputs bucket

-- ─── STORAGE BUCKET ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-outputs',
  'video-outputs',
  false,
  1073741824,   -- 1 GB per file
  ARRAY[
    'video/mp4','video/webm','video/quicktime',
    'video/x-msvideo','video/x-matroska',
    'image/jpeg','image/png','image/webp'   -- thumbnails
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: owner-only access keyed by user folder
CREATE POLICY "video_outputs_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'video-outputs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "video_outputs_owner_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'video-outputs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "video_outputs_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'video-outputs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── VIDEO JOBS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vx_video_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id          uuid REFERENCES ams_projects(id) ON DELETE SET NULL,
  asset_id            uuid REFERENCES ams_assets(id) ON DELETE SET NULL,

  -- Metadata
  title               text,
  prompt              text NOT NULL,
  negative_prompt     text,
  style               text NOT NULL DEFAULT 'realistic',
  duration_sec        integer NOT NULL DEFAULT 5 CHECK (duration_sec BETWEEN 3 AND 60),
  aspect_ratio        text NOT NULL DEFAULT '16:9'
                        CHECK (aspect_ratio IN ('16:9','9:16','1:1','4:3','21:9','3:4')),
  resolution          text NOT NULL DEFAULT '720p'
                        CHECK (resolution IN ('480p','720p','1080p','4k')),
  fps                 integer NOT NULL DEFAULT 24
                        CHECK (fps IN (24, 30, 60)),
  camera_motion       text DEFAULT 'static'
                        CHECK (camera_motion IN ('static','pan_left','pan_right','zoom_in','zoom_out','tilt_up','tilt_down','orbit','dolly_in','dolly_out')),
  creativity          numeric(3,1) NOT NULL DEFAULT 5.0
                        CHECK (creativity BETWEEN 1 AND 10),
  seed                bigint,

  -- Audio attachment
  audio_asset_id      uuid REFERENCES ams_assets(id) ON DELETE SET NULL,
  audio_mode          text DEFAULT 'none'
                        CHECK (audio_mode IN ('none','generated','uploaded')),

  -- Template reference
  template_id         uuid,  -- vx_video_templates.id (forward ref)

  -- Provider
  provider            text NOT NULL DEFAULT 'luma',
  provider_model      text DEFAULT 'dream-machine',
  provider_job_id     text,

  -- Output
  video_url           text,                    -- public/signed URL after completion
  storage_path        text,                    -- Supabase Storage path
  thumbnail_url       text,
  thumbnail_path      text,
  duration_actual_sec numeric,
  file_size_bytes     bigint,
  width               integer,
  height              integer,

  -- Queue / status
  status              text NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','preparing','generating','rendering','optimizing','uploading','completed','failed','cancelled')),
  progress            integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error_message       text,
  retry_count         integer NOT NULL DEFAULT 0,
  generation_time_ms  bigint,

  -- Favorites / archive
  is_favorite         boolean NOT NULL DEFAULT false,
  is_archived         boolean NOT NULL DEFAULT false,

  -- Timestamps
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz,
  completed_at        timestamptz,
  estimated_complete  timestamptz
);

CREATE INDEX IF NOT EXISTS vx_jobs_user_idx       ON vx_video_jobs(user_id);
CREATE INDEX IF NOT EXISTS vx_jobs_project_idx    ON vx_video_jobs(project_id);
CREATE INDEX IF NOT EXISTS vx_jobs_status_idx     ON vx_video_jobs(status);
CREATE INDEX IF NOT EXISTS vx_jobs_created_idx    ON vx_video_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS vx_jobs_provider_idx   ON vx_video_jobs(provider_job_id)
  WHERE provider_job_id IS NOT NULL;

ALTER TABLE vx_video_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vx_jobs_owner_all" ON vx_video_jobs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER vx_jobs_updated_at
  BEFORE UPDATE ON vx_video_jobs
  FOR EACH ROW EXECUTE FUNCTION ams_touch_updated_at();

-- ─── VIDEO TEMPLATES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vx_video_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name            text NOT NULL,
  description     text,
  prompt_template text NOT NULL,
  negative_prompt text,
  style           text NOT NULL DEFAULT 'realistic',
  duration_sec    integer NOT NULL DEFAULT 5,
  aspect_ratio    text NOT NULL DEFAULT '16:9',
  resolution      text NOT NULL DEFAULT '720p',
  fps             integer NOT NULL DEFAULT 24,
  camera_motion   text DEFAULT 'static',
  creativity      numeric(3,1) NOT NULL DEFAULT 5.0,
  provider        text NOT NULL DEFAULT 'luma',
  provider_model  text DEFAULT 'dream-machine',

  is_favorite     boolean NOT NULL DEFAULT false,
  use_count       integer NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vx_templates_user_idx ON vx_video_templates(user_id);

ALTER TABLE vx_video_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vx_templates_owner_all" ON vx_video_templates
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER vx_templates_updated_at
  BEFORE UPDATE ON vx_video_templates
  FOR EACH ROW EXECUTE FUNCTION ams_touch_updated_at();

-- ─── ADD TEMPLATE FK TO JOBS ─────────────────────────────────────────────────
ALTER TABLE vx_video_jobs
  ADD CONSTRAINT vx_jobs_template_fk
  FOREIGN KEY (template_id) REFERENCES vx_video_templates(id) ON DELETE SET NULL;

-- ─── RPC: increment template use_count ──────────────────────────────────────
CREATE OR REPLACE FUNCTION vx_use_template(p_template_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE vx_video_templates
  SET use_count = use_count + 1, updated_at = now()
  WHERE id = p_template_id AND user_id = auth.uid();
END;
$$;
