-- ============================================================
-- Contact form attachments
-- 1. attachment_url column on service_requests
-- 2. public storage bucket for contact attachments
--    (images / PDF, 5 MB limit — enforced by the bucket itself)
-- ============================================================

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contact-attachments',
  'contact-attachments',
  true,
  5242880,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Guests can also submit the contact form, so anon may upload too.
-- The bucket's mime-type and size limits bound what can be stored.
DO $$ BEGIN
  CREATE POLICY "contact_attachments_upload"
    ON storage.objects FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'contact-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "contact_attachments_read"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'contact-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
