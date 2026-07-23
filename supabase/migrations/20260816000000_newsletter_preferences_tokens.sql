-- Opaque per-subscriber capability token. The email address alone must never
-- grant access to subscription preferences.
ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS manage_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_manage_token_key
  ON public.newsletter_subscribers (manage_token);

