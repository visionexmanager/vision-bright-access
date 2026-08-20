-- WhatsApp assistant: triage, handoff briefing and operational counters.
--
-- Three things staff need that did not exist:
--   * what a conversation is about, without reading it
--   * a briefing when it lands on a human, so the customer is not asked to
--     repeat themselves
--   * counts, so a provider outage or an abuse spike is visible

ALTER TABLE public.whatsapp_messages
  -- Set on inbound messages by a cheap classifier. NULL means unclassified,
  -- which is a normal state, not an error.
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IS NULL OR category IN (
      'general', 'technical', 'billing', 'account', 'bazaar', 'order',
      'complaint', 'feedback', 'media', 'human_request'
    ));

ALTER TABLE public.whatsapp_conversations
  -- Written when the conversation escalates. Facts and open issues only.
  ADD COLUMN IF NOT EXISTS handoff_summary text,
  ADD COLUMN IF NOT EXISTS handoff_summary_at timestamptz,
  -- Last category seen, so the queue can be filtered without a join.
  ADD COLUMN IF NOT EXISTS last_category text;

COMMENT ON COLUMN public.whatsapp_messages.category IS
  'Lightweight triage label for an inbound message. NULL when classification was skipped or failed.';
COMMENT ON COLUMN public.whatsapp_conversations.handoff_summary IS
  'Briefing written when the conversation reached a human, so the customer is not asked to repeat themselves. Never contains credentials.';

CREATE INDEX IF NOT EXISTS whatsapp_messages_category_idx
  ON public.whatsapp_messages (category, created_at DESC)
  WHERE category IS NOT NULL;

-- ── Operational counters ────────────────────────────────────────────────
--
-- A view rather than a table: the rows already exist, and a second copy would
-- be one more thing to keep true. Admin-only, like everything else here.
CREATE OR REPLACE VIEW public.whatsapp_daily_metrics
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', m.created_at)                                   AS day,
  count(*) FILTER (WHERE m.direction = 'inbound')                   AS inbound,
  count(*) FILTER (WHERE m.direction = 'outbound' AND m.kind = 'reply')      AS replies,
  count(*) FILTER (WHERE m.direction = 'outbound' AND m.kind = 'handover')   AS handovers,
  count(*) FILTER (WHERE m.direction = 'outbound' AND m.kind = 'unsupported') AS declined,
  count(*) FILTER (WHERE m.direction = 'outbound' AND m.kind = 'welcome')    AS welcomes,
  count(DISTINCT m.conversation_id)                                 AS conversations
FROM public.whatsapp_messages m
GROUP BY 1;

COMMENT ON VIEW public.whatsapp_daily_metrics IS
  'Daily WhatsApp volume by message kind. security_invoker, so the caller''s RLS applies and only admins can read it.';

-- Escalation and abuse counters, one row.
CREATE OR REPLACE VIEW public.whatsapp_health
WITH (security_invoker = true) AS
SELECT
  count(*)                                                     AS conversations,
  count(*) FILTER (WHERE escalated)                            AS escalated,
  count(*) FILTER (WHERE control = 'human')                    AS human_controlled,
  count(*) FILTER (WHERE rate_limit_hits > 0)                  AS rate_limited,
  count(*) FILTER (WHERE blocked_until > now())                AS currently_paused,
  count(*) FILTER (WHERE last_message_at > now() - interval '24 hours') AS active_last_day
FROM public.whatsapp_conversations;

COMMENT ON VIEW public.whatsapp_health IS
  'One-row WhatsApp health snapshot: escalations, human-controlled conversations and abuse counters.';
