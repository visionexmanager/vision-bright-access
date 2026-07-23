-- ============================================================
-- Migration: Library storage buckets (Phase 2 backend)
-- Purpose:   6 buckets for the Library section. Pattern follows
--            20260706000001_academy_lms_storage.sql (idempotent
--            INSERT ... ON CONFLICT DO NOTHING + DO $$ ... EXCEPTION WHEN
--            duplicate_object policy blocks), EXCEPT library-book-files and
--            library-audiobooks are NOT public-read like academy's course
--            buckets — the prompt explicitly requires "visitor reads free
--            books only / member reads purchased books only", so their
--            SELECT policy calls public.can_access_library_book_content()
--            (20260720000000/20260720000002) keyed off the first path
--            segment as the book id — uploads MUST use the convention
--            `{book_id}/{filename}` for this to work.
-- ============================================================

-- ── library-book-covers (public — marketing/browsing) ───────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-book-covers', 'library-book-covers', true,
  5242880, -- 5 MB
  ARRAY['image/png','image/jpeg','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "library_book_covers_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'library-book-covers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_book_covers_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'library-book-covers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_book_covers_manage_own"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'library-book-covers' AND owner = auth.uid())
    WITH CHECK (bucket_id = 'library-book-covers' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_book_covers_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'library-book-covers' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── library-author-images (public — author profile photos) ──────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-author-images', 'library-author-images', true,
  5242880, -- 5 MB
  ARRAY['image/png','image/jpeg','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "library_author_images_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'library-author-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_author_images_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'library-author-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_author_images_manage_own"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'library-author-images' AND owner = auth.uid())
    WITH CHECK (bucket_id = 'library-author-images' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_author_images_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'library-author-images' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── library-category-images (public read, admin-only manage — categories
--    are admin-curated, mirrors library_categories table RLS) ────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-category-images', 'library-category-images', true,
  5242880, -- 5 MB
  ARRAY['image/png','image/jpeg','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "library_category_images_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'library-category-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_category_images_manage"
    ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'library-category-images' AND public.has_role(auth.uid(), 'admin'))
    WITH CHECK (bucket_id = 'library-category-images' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── library-book-files (NOT public — purchase/free/owner/admin gated;
--    path convention: {book_id}/{filename}) ──────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-book-files', 'library-book-files', false,
  209715200, -- 200 MB
  ARRAY[
    'application/pdf',
    'application/epub+zip',
    'text/plain',                -- also covers .brf (Braille Ready Format has no registered MIME type)
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- docx
    'application/octet-stream'   -- fallback for .brf / other formats the import pipeline emits
  ]
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "library_book_files_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'library-book-files'
      AND (public.is_library_book_owner(((storage.foldername(name))[1])::uuid) OR public.has_role(auth.uid(), 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_book_files_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (
      bucket_id = 'library-book-files'
      AND public.can_access_library_book_content(((storage.foldername(name))[1])::uuid)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_book_files_manage_own"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'library-book-files'
      AND (public.is_library_book_owner(((storage.foldername(name))[1])::uuid) OR public.has_role(auth.uid(), 'admin'))
    )
    WITH CHECK (
      bucket_id = 'library-book-files'
      AND (public.is_library_book_owner(((storage.foldername(name))[1])::uuid) OR public.has_role(auth.uid(), 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_book_files_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'library-book-files'
      AND (public.is_library_book_owner(((storage.foldername(name))[1])::uuid) OR public.has_role(auth.uid(), 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── library-audiobooks (same gating as book-files; path convention:
--    {book_id}/{filename}) ────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-audiobooks', 'library-audiobooks', false,
  1073741824, -- 1 GB
  ARRAY['audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "library_audiobooks_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'library-audiobooks'
      AND (public.is_library_book_owner(((storage.foldername(name))[1])::uuid) OR public.has_role(auth.uid(), 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_audiobooks_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (
      bucket_id = 'library-audiobooks'
      AND public.can_access_library_book_content(((storage.foldername(name))[1])::uuid)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_audiobooks_manage_own"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'library-audiobooks'
      AND (public.is_library_book_owner(((storage.foldername(name))[1])::uuid) OR public.has_role(auth.uid(), 'admin'))
    )
    WITH CHECK (
      bucket_id = 'library-audiobooks'
      AND (public.is_library_book_owner(((storage.foldername(name))[1])::uuid) OR public.has_role(auth.uid(), 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_audiobooks_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'library-audiobooks'
      AND (public.is_library_book_owner(((storage.foldername(name))[1])::uuid) OR public.has_role(auth.uid(), 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── library-temp-uploads (private staging for EPUB/PDF before
--    library-import-book processes them; owner-only, no public read) ──────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-temp-uploads', 'library-temp-uploads', false,
  209715200, -- 200 MB
  ARRAY['application/pdf','application/epub+zip','image/png','image/jpeg','application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "library_temp_uploads_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'library-temp-uploads' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_temp_uploads_read_own"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'library-temp-uploads' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_temp_uploads_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'library-temp-uploads' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
