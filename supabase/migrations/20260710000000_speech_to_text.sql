-- AI Media Studio — Speech-to-Text (Whisper transcription)
-- Table: ams_transcription_jobs

CREATE TABLE IF NOT EXISTS ams_transcription_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES ams_projects(id) ON DELETE SET NULL,
  source_asset_id  uuid REFERENCES ams_assets(id) ON DELETE SET NULL,

  -- Input
  input_filename   text NOT NULL,
  input_mime_type  text,
  input_size_bytes bigint,
  language_hint    text,
  provider         text NOT NULL DEFAULT 'openai-whisper',

  -- Output
  transcript_text  text,
  detected_language text,
  duration_sec     numeric,
  segments         jsonb,

  -- Status
  status           text NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  error_message    text,

  -- Timestamps
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS ams_transcription_jobs_user_idx    ON ams_transcription_jobs(user_id);
CREATE INDEX IF NOT EXISTS ams_transcription_jobs_status_idx  ON ams_transcription_jobs(status);
CREATE INDEX IF NOT EXISTS ams_transcription_jobs_created_idx ON ams_transcription_jobs(created_at DESC);

ALTER TABLE ams_transcription_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_transcription_jobs_owner_all" ON ams_transcription_jobs;
CREATE POLICY "ams_transcription_jobs_owner_all" ON ams_transcription_jobs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO billing_rules (id, vx_cost, description)
VALUES ('speech_to_text', 20, 'Speech-to-text transcription (per file, OpenAI Whisper)')
ON CONFLICT (id) DO NOTHING;
