-- ============================================================
-- Learning Hub storage (Book-to-Course, Smart Notes, Flashcards, Group
-- Learning submissions). Two buckets:
--   library-learning-media   (public)  — note voice/image attachments,
--                                        manual flashcard image/audio cards
--   library-group-submissions (public, like library-discussion-media) —
--                                        study-group assignment submission
--                                        files. The bucket itself is
--                                        world-readable-if-you-know-the-URL;
--                                        the real access gate is the
--                                        library_group_assignment_submissions
--                                        row RLS (club-members-only), which
--                                        is what actually exposes the URL to
--                                        the right audience.
-- Both keyed by the uploader's own auth.uid() folder, since the owning row
-- (note/flashcard/submission) is usually created after the file exists.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-learning-media', 'library-learning-media', true,
  26214400, -- 25 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/webm', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "library_learning_media_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'library-learning-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_learning_media_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'library-learning-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_learning_media_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'library-learning-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-group-submissions', 'library-group-submissions', true,
  52428800, -- 50 MB
  NULL
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "library_group_submissions_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'library-group-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_group_submissions_read"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'library-group-submissions');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_group_submissions_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'library-group-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
