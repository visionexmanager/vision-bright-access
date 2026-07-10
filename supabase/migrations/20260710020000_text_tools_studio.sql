-- AI Media Studio — Text Tools Studio (Code Generator, Writing Assistant,
-- Resume Builder, Presentation Generator). Logo/Icon reuse image-generate;
-- QR Generator is client-side only and needs no job table.

CREATE TABLE IF NOT EXISTS ams_text_tool_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES ams_projects(id) ON DELETE SET NULL,
  asset_id         uuid REFERENCES ams_assets(id) ON DELETE SET NULL,

  -- Input
  tool             text NOT NULL CHECK (tool IN ('code','writing','resume','presentation')),
  prompt           text NOT NULL,
  language         text NOT NULL DEFAULT 'en',
  options          jsonb NOT NULL DEFAULT '{}'::jsonb,

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

CREATE INDEX IF NOT EXISTS ams_text_tool_jobs_user_idx    ON ams_text_tool_jobs(user_id);
CREATE INDEX IF NOT EXISTS ams_text_tool_jobs_tool_idx    ON ams_text_tool_jobs(tool);
CREATE INDEX IF NOT EXISTS ams_text_tool_jobs_created_idx ON ams_text_tool_jobs(created_at DESC);

ALTER TABLE ams_text_tool_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_text_tool_jobs_owner_all" ON ams_text_tool_jobs;
CREATE POLICY "ams_text_tool_jobs_owner_all" ON ams_text_tool_jobs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO billing_rules (id, vx_cost, description)
VALUES ('text_tool_generation', 15, 'AI text tool generation (code, writing, resume, presentation)')
ON CONFLICT (id) DO NOTHING;
