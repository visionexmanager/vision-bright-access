-- AI Media Studio — Voice Studio schema
-- Tables: vs_voice_profiles, vs_voice_datasets, vs_training_jobs, vs_training_logs

-- ─── STORAGE BUCKET ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-datasets',
  'voice-datasets',
  false,
  52428800,   -- 50 MB per file
  ARRAY[
    'audio/wav','audio/x-wav','audio/wave',
    'audio/mpeg','audio/mp3',
    'audio/flac','audio/x-flac',
    'audio/ogg','audio/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: owner-only access
CREATE POLICY "voice_datasets_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-datasets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "voice_datasets_owner_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-datasets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "voice_datasets_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'voice-datasets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── VOICE PROFILES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vs_voice_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES ams_projects(id) ON DELETE SET NULL,

  -- Identity
  name            text NOT NULL,
  description     text,
  language        text NOT NULL DEFAULT 'en',
  accent          text,
  gender          text CHECK (gender IN ('male','female','neutral')),
  tags            text[] NOT NULL DEFAULT '{}',

  -- Status
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','training','completed','failed','archived')),
  training_status text NOT NULL DEFAULT 'not_started'
                    CHECK (training_status IN (
                      'not_started','uploading','validating','queued',
                      'training','optimizing','completed','failed','cancelled'
                    )),

  -- Provider info (populated after successful training)
  provider        text NOT NULL DEFAULT 'elevenlabs',
  provider_voice_id text,               -- ElevenLabs voice_id after cloning
  provider_model  text DEFAULT 'eleven_multilingual_v2',

  -- Quality metrics (computed from dataset analysis)
  quality_score   numeric(3,1),        -- 0.0 – 10.0
  total_duration_sec numeric DEFAULT 0,
  sample_count    integer NOT NULL DEFAULT 0,

  -- Assets
  preview_asset_id  uuid REFERENCES ams_assets(id) ON DELETE SET NULL,
  thumbnail_url   text,

  -- Favorites / metadata
  is_favorite     boolean NOT NULL DEFAULT false,
  is_shared       boolean NOT NULL DEFAULT false,  -- future: sharing

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vs_profiles_user_idx    ON vs_voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS vs_profiles_project_idx ON vs_voice_profiles(project_id);
CREATE INDEX IF NOT EXISTS vs_profiles_status_idx  ON vs_voice_profiles(status);
CREATE INDEX IF NOT EXISTS vs_profiles_created_idx ON vs_voice_profiles(created_at DESC);

ALTER TABLE vs_voice_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vs_profiles_owner_all" ON vs_voice_profiles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER vs_profiles_updated_at
  BEFORE UPDATE ON vs_voice_profiles
  FOR EACH ROW EXECUTE FUNCTION ams_touch_updated_at();

-- ─── VOICE DATASETS (audio samples) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vs_voice_datasets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES vs_voice_profiles(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- File info
  filename        text NOT NULL,
  storage_path    text NOT NULL,        -- Supabase Storage path
  mime_type       text NOT NULL DEFAULT 'audio/wav',
  file_size_bytes bigint NOT NULL DEFAULT 0,

  -- Audio metadata
  duration_sec    numeric,
  sample_rate     integer,
  channels        integer,

  -- Quality analysis
  quality_score   numeric(3,1),        -- 0.0 – 10.0
  noise_level     numeric(3,1),        -- 0 = silent, 10 = very noisy
  clarity_score   numeric(3,1),
  snr_db          numeric,             -- signal-to-noise ratio (dB)
  is_valid        boolean DEFAULT NULL, -- null = not yet analyzed

  -- Status
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','uploaded','analyzing','accepted','rejected')),
  rejection_reason text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vs_datasets_profile_idx ON vs_voice_datasets(profile_id);
CREATE INDEX IF NOT EXISTS vs_datasets_user_idx    ON vs_voice_datasets(user_id);
CREATE INDEX IF NOT EXISTS vs_datasets_status_idx  ON vs_voice_datasets(status);

ALTER TABLE vs_voice_datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vs_datasets_owner_all" ON vs_voice_datasets
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── TRAINING JOBS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vs_training_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES vs_voice_profiles(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Status
  status          text NOT NULL DEFAULT 'queued'
                    CHECK (status IN (
                      'queued','uploading','validating','training',
                      'optimizing','completed','failed','cancelled'
                    )),
  progress        integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),

  -- Provider response
  provider        text NOT NULL DEFAULT 'elevenlabs',
  provider_job_id text,
  provider_voice_id text,

  -- Error tracking
  error_message   text,
  error_code      text,
  retry_count     integer NOT NULL DEFAULT 0,

  -- Timing
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  estimated_duration_sec integer
);

CREATE INDEX IF NOT EXISTS vs_training_profile_idx ON vs_training_jobs(profile_id);
CREATE INDEX IF NOT EXISTS vs_training_user_idx    ON vs_training_jobs(user_id);
CREATE INDEX IF NOT EXISTS vs_training_status_idx  ON vs_training_jobs(status);
CREATE INDEX IF NOT EXISTS vs_training_created_idx ON vs_training_jobs(created_at DESC);

ALTER TABLE vs_training_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vs_training_owner_all" ON vs_training_jobs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── TRAINING LOGS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vs_training_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES vs_training_jobs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level       text NOT NULL DEFAULT 'info'
                CHECK (level IN ('info','warning','error','success')),
  message     text NOT NULL,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vs_logs_job_idx  ON vs_training_logs(job_id);
CREATE INDEX IF NOT EXISTS vs_logs_time_idx ON vs_training_logs(created_at DESC);

ALTER TABLE vs_training_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vs_logs_owner_read" ON vs_training_logs
  FOR SELECT USING (user_id = auth.uid());

-- ─── RPCs ─────────────────────────────────────────────────────────────────────

-- Recalculate profile sample_count and total_duration_sec
CREATE OR REPLACE FUNCTION vs_sync_profile_stats(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE vs_voice_profiles
  SET
    sample_count      = (SELECT COUNT(*) FROM vs_voice_datasets WHERE profile_id = p_profile_id AND status = 'accepted'),
    total_duration_sec = (SELECT COALESCE(SUM(duration_sec), 0) FROM vs_voice_datasets WHERE profile_id = p_profile_id AND status = 'accepted'),
    updated_at        = now()
  WHERE id = p_profile_id;
END;
$$;

-- Log a training event
CREATE OR REPLACE FUNCTION vs_log_training(
  p_job_id  uuid,
  p_level   text,
  p_message text,
  p_meta    jsonb DEFAULT '{}'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO vs_training_logs(job_id, user_id, level, message, metadata)
  SELECT p_job_id, user_id, p_level, p_message, p_meta
  FROM   vs_training_jobs WHERE id = p_job_id;
END;
$$;
