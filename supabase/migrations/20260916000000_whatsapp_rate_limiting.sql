-- WhatsApp assistant: abuse control for ordinary senders.
--
-- Before this, only *owner commands* were rate limited. Any other number could
-- drive unbounded AI calls simply by sending messages in a loop — every one of
-- them a paid model call. This adds a per-sender budget, a short burst guard,
-- and a repeat-text guard, all evaluated against rows the webhook already
-- writes so no extra bookkeeping table is needed.
--
-- Deliberately not a ban list: the limit expires on its own. A real customer
-- who types quickly gets one explanatory reply and is answered again later,
-- rather than being silently dropped forever.

ALTER TABLE public.whatsapp_conversations
  -- While set and in the future, the assistant accepts and logs the message but
  -- does not call a model or reply. NULL means no limit is in force.
  ADD COLUMN IF NOT EXISTS blocked_until timestamptz,
  -- When the "you are sending too quickly" notice was last sent, so the notice
  -- goes out once per limit window instead of on every throttled message.
  ADD COLUMN IF NOT EXISTS rate_notified_at timestamptz,
  -- Running count of limit hits, for the abuse dashboard and for deciding
  -- whether a number deserves a human look.
  ADD COLUMN IF NOT EXISTS rate_limit_hits integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.whatsapp_conversations.blocked_until IS
  'Set by the webhook when a sender exceeds the hourly or burst budget. The assistant stays silent until this passes. Self-expiring: not a ban.';

-- Counting a sender's recent inbound messages is the hot path of the limiter,
-- and it runs on every delivery. The existing index is (conversation_id,
-- created_at DESC) which already serves it; this partial index narrows it to
-- the direction the limiter actually counts.
CREATE INDEX IF NOT EXISTS whatsapp_messages_inbound_recent_idx
  ON public.whatsapp_messages (conversation_id, created_at DESC)
  WHERE direction = 'inbound';

-- Abuse triage: which numbers are hitting limits, worst first.
CREATE INDEX IF NOT EXISTS whatsapp_conversations_rate_hits_idx
  ON public.whatsapp_conversations (rate_limit_hits DESC)
  WHERE rate_limit_hits > 0;
