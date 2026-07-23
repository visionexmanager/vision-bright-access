-- ============================================================
-- Migration: Reading Community storage (Phase 12)
-- One bucket for discussion reply image attachments. Unlike review media
-- (keyed by an existing review_id), a discussion reply's images are
-- uploaded BEFORE the reply row exists (the compose UI attaches images,
-- then submits the reply with the resulting URLs in image_urls) — so the
-- folder is keyed by the uploader's own auth.uid(), not a row id.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-discussion-media', 'library-discussion-media', true,
  20971520, -- 20 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "library_discussion_media_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'library-discussion-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_discussion_media_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'library-discussion-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_discussion_media_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'library-discussion-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
