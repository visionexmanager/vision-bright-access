-- ============================================================
-- Migration: Library Publishing Studio storage (Phase 9)
-- Purpose: one new bucket for gallery images + trailer videos — no
-- gallery/trailer bucket existed before this. Follows the exact idempotent
-- pattern established in 20260720000004_library_storage.sql (INSERT ...
-- ON CONFLICT DO NOTHING + DO $$ ... EXCEPTION WHEN duplicate_object policy
-- blocks). Public bucket + unrestricted SELECT, same convention as
-- library-book-covers/library-author-images (gallery images are meant to
-- be publicly viewable once uploaded; the actual row-level visibility of
-- WHICH gallery entries appear in the app is separately gated by
-- library_book_gallery's own RLS). Write access uses can_edit_library_book
-- (owner/admin/owner-or-editor-role collaborator) rather than
-- is_library_book_owner alone, since collaborators must be able to manage
-- gallery/trailer media too.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-book-gallery', 'library-book-gallery', true,
  524288000, -- 500 MB (accommodates trailer video, larger than the 5 MB image-only buckets)
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "library_book_gallery_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'library-book-gallery'
      AND public.can_edit_library_book(((storage.foldername(name))[1])::uuid)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_book_gallery_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'library-book-gallery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_book_gallery_manage_own"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'library-book-gallery'
      AND public.can_edit_library_book(((storage.foldername(name))[1])::uuid)
    )
    WITH CHECK (
      bucket_id = 'library-book-gallery'
      AND public.can_edit_library_book(((storage.foldername(name))[1])::uuid)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_book_gallery_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'library-book-gallery'
      AND public.can_edit_library_book(((storage.foldername(name))[1])::uuid)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
