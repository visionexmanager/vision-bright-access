-- AI Media Studio — Document Studio (OCR / PDF Assistant / Document Analyzer)
-- Table: ams_document_jobs

CREATE TABLE IF NOT EXISTS ams_document_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES ams_projects(id) ON DELETE SET NULL,
  source_asset_id  uuid REFERENCES ams_assets(id) ON DELETE SET NULL,

  -- Input
  mode             text NOT NULL CHECK (mode IN ('ocr','analyze','summarize')),
  input_filename   text,
  input_text       text,          -- raw text for analyze/summarize modes
  language         text NOT NULL DEFAULT 'en',

  -- Output
  result_text      text,
  result_json      jsonb,

  -- Status
  status           text NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  error_message    text,

  -- Timestamps
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS ams_document_jobs_user_idx    ON ams_document_jobs(user_id);
CREATE INDEX IF NOT EXISTS ams_document_jobs_status_idx  ON ams_document_jobs(status);
CREATE INDEX IF NOT EXISTS ams_document_jobs_created_idx ON ams_document_jobs(created_at DESC);

ALTER TABLE ams_document_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_document_jobs_owner_all" ON ams_document_jobs;
CREATE POLICY "ams_document_jobs_owner_all" ON ams_document_jobs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO billing_rules (id, vx_cost, description)
VALUES ('document_analysis', 30, 'AI document analysis / summarization (per document)')
ON CONFLICT (id) DO NOTHING;
