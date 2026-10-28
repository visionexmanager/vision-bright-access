-- The owner's ISP desk on WhatsApp keeps exactly one step waiting: which action,
-- how the customer is named, and what the owner typed, until Confirm or a tap
-- on Reject. One row, keyed by a constant, so there is never more than one thing
-- a "confirm" can mean.
--
-- It holds a customer identifier for at most ten minutes (`expires_at`), is
-- overwritten by the next `/isp`, and is deleted on every outcome.

CREATE TABLE IF NOT EXISTS public.whatsapp_isp_pending (
  key         text PRIMARY KEY DEFAULT 'owner' CHECK (key = 'owner'),
  action      text NOT NULL CHECK (action IN ('ping','resetmac','renew','disconnect','inactive','resetfup','status')),
  kind        text CHECK (kind IN ('username','name')),
  stage       text NOT NULL CHECK (stage IN ('await_kind','await_value','await_confirm')),
  value       text CHECK (value IS NULL OR char_length(value) <= 80),
  nonce       text NOT NULL CHECK (nonce ~ '^[A-Za-z0-9]{6,32}$'),
  lang        text NOT NULL DEFAULT 'ar' CHECK (lang IN ('ar','en')),
  expires_at  timestamptz NOT NULL
);

ALTER TABLE public.whatsapp_isp_pending ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_isp_pending FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_isp_pending TO service_role;

COMMENT ON TABLE public.whatsapp_isp_pending IS
  'The single step the owner''s WhatsApp ISP desk is waiting on. Holds a customer identifier for at most ten minutes. RLS on with NO policy on purpose: service role only.';
