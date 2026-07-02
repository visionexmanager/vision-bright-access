-- VisionEx Career Center — storage buckets
-- Resumes/CVs stay private (owner-only); portfolios, certificates, and
-- general media are public so they can be shown on public profiles, company
-- pages, and verified via QR without requiring a signed-in viewer.
-- Files are stored under a per-user folder prefix: `<user_id>/<filename>`.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('career-resumes', 'career-resumes', false, 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('career-portfolios', 'career-portfolios', true, 20971520, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('career-certificates', 'career-certificates', true, 10485760, ARRAY['image/png', 'image/jpeg', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('career-media', 'career-media', true, 104857600, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO NOTHING;

-- ── career-resumes (private) ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "career_resumes_owner_write"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'career-resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "career_resumes_owner_read"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'career-resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "career_resumes_owner_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'career-resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── career-portfolios (public read, owner write) ────────────────────────
DO $$ BEGIN
  CREATE POLICY "career_portfolios_public_read"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'career-portfolios');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "career_portfolios_owner_write"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'career-portfolios' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "career_portfolios_owner_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'career-portfolios' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── career-certificates (public read for QR verification, owner write) ──
DO $$ BEGIN
  CREATE POLICY "career_certificates_public_read"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'career-certificates');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "career_certificates_owner_write"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'career-certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "career_certificates_owner_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'career-certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── career-media (public read, owner write) — feed images/video, company
--    photos, video profiles/intros/portfolio/presentation videos.
DO $$ BEGIN
  CREATE POLICY "career_media_public_read"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'career-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "career_media_owner_write"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'career-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "career_media_owner_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'career-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
