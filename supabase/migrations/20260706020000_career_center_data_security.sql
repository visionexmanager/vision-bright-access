-- VisionEx Career Center — data security (Phase 11).
-- Encryption at rest and TLS in transit are already handled platform-wide
-- by Supabase (managed Postgres disk encryption + enforced TLS on every
-- connection) — nothing to add for those. This migration adds the pieces
-- that aren't automatic: an application-level encryption helper for
-- especially sensitive free-text fields, and a place for upload-scan
-- results to land.

-- pgcrypto ships with Supabase by default; this is idempotent if already enabled.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Application-level encryption helpers ─────────────────────────────────
-- The passphrase is supplied by the CALLER (an Edge Function reading
-- CAREER_ENCRYPTION_KEY from its own environment) and is never stored in
-- the database — these functions only perform the cipher operation.
CREATE OR REPLACE FUNCTION public.career_encrypt(_plaintext text, _key text)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pgp_sym_encrypt(_plaintext, _key);
$$;

CREATE OR REPLACE FUNCTION public.career_decrypt(_ciphertext bytea, _key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pgp_sym_decrypt(_ciphertext, _key);
$$;

-- ── Encrypted secrets store ──────────────────────────────────────────────
-- For any future especially-sensitive free-text a user attaches to their
-- Career Center profile (e.g. visa case notes) that shouldn't sit as plain
-- text even inside an owner-only-RLS table. Optional to use — most
-- Career Center data (resumes, applications) is normal PII already covered
-- by RLS + TLS and doesn't need this extra layer.
CREATE TABLE public.career_encrypted_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  ciphertext bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_encrypted_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own encrypted secrets"
  ON public.career_encrypted_secrets FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX idx_career_encrypted_secrets_owner ON public.career_encrypted_secrets(owner_user_id);

-- ── Upload scan results ───────────────────────────────────────────────────
-- A place for a future scanning step (MIME/extension re-verification today;
-- pluggable for a real malware scanner later) to record its verdict for
-- anything uploaded to the career-resumes/career-portfolios/
-- career-certificates/career-media buckets (20260705060000).
CREATE TABLE public.career_file_scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'flagged', 'error')),
  details jsonb NOT NULL DEFAULT '{}',
  scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);

ALTER TABLE public.career_file_scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scan results for their own uploads"
  ON public.career_file_scan_results FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Admins can view all scan results"
  ON public.career_file_scan_results FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_career_file_scan_results_owner ON public.career_file_scan_results(owner_user_id);
CREATE INDEX idx_career_file_scan_results_status ON public.career_file_scan_results(scan_status);
