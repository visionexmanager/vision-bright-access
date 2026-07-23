-- Real private file storage for AI Media Studio assets.
-- The original schemas require owner/user columns but several browser-side
-- creation flows intentionally rely on the authenticated session. Safe
-- defaults keep those inserts RLS-protected and prevent NOT NULL failures.
ALTER TABLE public.ams_projects       ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.ams_folders        ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.ams_assets         ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.ams_voice_favorites ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.ams_voice_recent   ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.ams_speech_presets ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.vs_voice_profiles  ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.vs_voice_datasets  ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.vx_video_templates ALTER COLUMN user_id SET DEFAULT auth.uid();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ams-assets',
  'ams-assets',
  false,
  104857600,
  ARRAY[
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg',
    'video/mp4', 'video/webm', 'video/quicktime',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "ams_assets_storage_insert" ON storage.objects;
CREATE POLICY "ams_assets_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ams-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "ams_assets_storage_select" ON storage.objects;
CREATE POLICY "ams_assets_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'ams-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "ams_assets_storage_delete" ON storage.objects;
CREATE POLICY "ams_assets_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'ams-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
