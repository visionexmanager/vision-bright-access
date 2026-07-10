-- AI Media Studio — Image Studio extension: img2img, upscale, background
-- removal, restoration, avatar generation (Replicate-backed).
-- Extends the existing ams_image_jobs table rather than creating a new one.

-- ─── STORAGE BUCKET for source images ────────────────────────────────────────
-- Public (read) so Replicate's servers can fetch the image by URL directly —
-- writes are still restricted to the owning user via the policies below.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'image-tool-inputs',
  'image-tool-inputs',
  true,
  26214400,   -- 25 MB per file
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "image_tool_inputs_owner_write" ON storage.objects;
CREATE POLICY "image_tool_inputs_owner_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'image-tool-inputs' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "image_tool_inputs_owner_delete" ON storage.objects;
CREATE POLICY "image_tool_inputs_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'image-tool-inputs' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "image_tool_inputs_public_read" ON storage.objects;
CREATE POLICY "image_tool_inputs_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'image-tool-inputs');

ALTER TABLE ams_image_jobs
  ALTER COLUMN prompt DROP NOT NULL;               -- upscale/bg-remove/restore need no prompt

ALTER TABLE ams_image_jobs
  ADD COLUMN IF NOT EXISTS mode              text NOT NULL DEFAULT 'text2img'
    CHECK (mode IN ('text2img','img2img','upscale','bg-remove','restore','avatar')),
  ADD COLUMN IF NOT EXISTS source_asset_id   uuid REFERENCES ams_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_image_url  text,          -- input image for img2img/upscale/etc.
  ADD COLUMN IF NOT EXISTS provider          text NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS provider_job_id   text;          -- e.g. Replicate prediction id, while processing

CREATE INDEX IF NOT EXISTS ams_image_jobs_mode_idx ON ams_image_jobs(mode);

INSERT INTO billing_rules (id, vx_cost, description)
VALUES
  ('image_img2img',   60, 'AI image-to-image transformation (Replicate)'),
  ('image_upscale',   40, 'AI image upscaling (Replicate)'),
  ('image_bg_remove', 30, 'AI background removal (Replicate)'),
  ('image_restore',   40, 'AI image restoration (Replicate)'),
  ('image_avatar',    50, 'AI avatar generation (Replicate)')
ON CONFLICT (id) DO NOTHING;
