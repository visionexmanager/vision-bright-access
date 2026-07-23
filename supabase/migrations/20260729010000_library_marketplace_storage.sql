-- ============================================================
-- Migration: Library Marketplace storage (Phase 10)
-- Purpose: one new bucket for review image/video uploads. Follows the exact
-- idempotent pattern established in 20260720000004_library_storage.sql and
-- 20260728010000_library_publishing_studio_storage.sql (INSERT ... ON
-- CONFLICT DO NOTHING + DO $$ ... EXCEPTION WHEN duplicate_object policy
-- blocks). Public bucket + unrestricted SELECT (review media is meant to be
-- publicly viewable once approved); write access is gated to the review's
-- own author via a join through library_reviews, mirrored from
-- library_review_media's table-level RLS (20260729000000 migration) rather
-- than re-deriving it here.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-review-media', 'library-review-media', true,
  104857600, -- 100 MB (photos + short video clips)
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "library_review_media_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'library-review-media'
      AND EXISTS (
        SELECT 1 FROM public.library_reviews r
        WHERE r.id::text = (storage.foldername(name))[1] AND r.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_review_media_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'library-review-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "library_review_media_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'library-review-media'
      AND EXISTS (
        SELECT 1 FROM public.library_reviews r
        WHERE r.id::text = (storage.foldername(name))[1] AND r.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
