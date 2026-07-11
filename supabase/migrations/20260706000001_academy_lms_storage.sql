-- ============================================================
-- Academy course media/file storage buckets
-- Enables real instructor uploads (cover images, lesson video/audio,
-- PDFs/presentations) instead of pasted URLs — see
-- src/components/academy/instructor/CourseMediaUploader.tsx.
-- Pattern follows 20260610000000_contact_attachments.sql.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'academy-course-media',
  'academy-course-media',
  true,
  524288000, -- 500 MB
  ARRAY[
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/mp4','audio/wav','audio/webm',
    'image/png','image/jpeg','image/webp','image/gif'
  ]
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'academy-course-files',
  'academy-course-files',
  true,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Only signed-in users may upload (instructor ownership of the specific
-- course/lesson is enforced application-side before the upload call, same
-- trust boundary as the rest of the course-editor RLS in this phase).
DO $$ BEGIN
  CREATE POLICY "academy_course_media_upload"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'academy-course-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "academy_course_media_read"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'academy-course-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "academy_course_media_manage_own"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'academy-course-media' AND owner = auth.uid())
    WITH CHECK (bucket_id = 'academy-course-media' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "academy_course_media_delete_own"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'academy-course-media' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "academy_course_files_upload"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'academy-course-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "academy_course_files_read"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'academy-course-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "academy_course_files_manage_own"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'academy-course-files' AND owner = auth.uid())
    WITH CHECK (bucket_id = 'academy-course-files' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "academy_course_files_delete_own"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'academy-course-files' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
