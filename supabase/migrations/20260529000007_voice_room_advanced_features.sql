-- Stage mode and password
ALTER TABLE public.voice_rooms
  ADD COLUMN IF NOT EXISTS room_mode TEXT DEFAULT 'conversation'
    CHECK (room_mode IN ('conversation','stage')),
  ADD COLUMN IF NOT EXISTS room_password TEXT;

-- Listener and stage tracking
ALTER TABLE public.voice_room_members
  ADD COLUMN IF NOT EXISTS is_listener BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS is_on_stage BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS raised_at TIMESTAMPTZ;

-- Storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-room-uploads', 'voice-room-uploads', true,
  10485760,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain']
) ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'voice_room_uploads_insert'
  ) THEN
    CREATE POLICY "voice_room_uploads_insert"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'voice-room-uploads');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'voice_room_uploads_select'
  ) THEN
    CREATE POLICY "voice_room_uploads_select"
      ON storage.objects FOR SELECT TO authenticated, anon
      USING (bucket_id = 'voice-room-uploads');
  END IF;
END $$;
