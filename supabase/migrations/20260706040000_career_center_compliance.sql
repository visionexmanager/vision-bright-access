-- VisionEx Career Center — GDPR/compliance (Phase 11).
-- Data-subject requests (export/deletion) and consent management. Audit
-- trail for these actions reuses career_security_events
-- (20260706010000) via log_career_security_event() rather than a second
-- parallel audit table.

CREATE TYPE public.career_data_request_type AS ENUM ('export', 'deletion');
CREATE TYPE public.career_data_request_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE public.career_data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type public.career_data_request_type NOT NULL,
  status public.career_data_request_status NOT NULL DEFAULT 'pending',
  -- Signed URL to the export bundle once ready; never a public path.
  result_url text,
  notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.career_data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and file their own data requests"
  ON public.career_data_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can file a new data request for themselves"
  ON public.career_data_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all data requests"
  ON public.career_data_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_career_data_requests_user ON public.career_data_requests(user_id);
CREATE INDEX idx_career_data_requests_status ON public.career_data_requests(status);

-- ── Consent management ────────────────────────────────────────────────────
CREATE TABLE public.career_consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL, -- 'ai_personalization' | 'marketing_emails' | 'data_processing' | ...
  granted boolean NOT NULL,
  policy_version text NOT NULL DEFAULT 'v1',
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, consent_type)
);

ALTER TABLE public.career_consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own consent records"
  ON public.career_consent_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all consent records"
  ON public.career_consent_records FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_career_consent_records_user ON public.career_consent_records(user_id);
