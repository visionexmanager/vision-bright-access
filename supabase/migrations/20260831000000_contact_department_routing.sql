-- Contact Us department routing.
--
-- The form already stored a free-text `service_type` (Website Design, Digital
-- Marketing, …), which says what the sender wants but not who should answer.
-- `department` is the routing key: it decides which public inbox receives the
-- notification and which acknowledgement wording the sender gets back.
--
-- Nullable with a default so historic rows stay valid and an older client that
-- omits the field still inserts successfully — an unroutable request must
-- still reach a human rather than being rejected.

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT 'general';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.service_requests'::regclass
      AND conname = 'service_requests_department_known'
  ) THEN
    ALTER TABLE public.service_requests
      ADD CONSTRAINT service_requests_department_known
      CHECK (department IN ('general', 'support', 'billing', 'news'));
  END IF;
END $$;

-- Admins triage by department; the volume is small but the index keeps the
-- admin list responsive as it grows.
CREATE INDEX IF NOT EXISTS service_requests_department_created_idx
  ON public.service_requests (department, created_at DESC);

COMMENT ON COLUMN public.service_requests.department IS
  'Routing target for the contact form: general -> hello@, support -> support@, billing -> billing@, news -> news@. Mirrored in supabase/functions/_shared/contactRouting.ts.';
