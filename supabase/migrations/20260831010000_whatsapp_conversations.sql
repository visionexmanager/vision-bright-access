-- WhatsApp assistant conversation log.
--
-- Two purposes: give the assistant enough prior turns to hold a conversation,
-- and give the team a queue of anything the assistant could not resolve.
--
-- These rows contain a phone number and whatever the sender typed, so they are
-- service-role only. RLS is enabled with no public policy at all: the webhook
-- writes with the service key, and staff read through an admin-only path.
-- There is deliberately no "users can read their own" policy — a WhatsApp
-- sender has no Visionex session to match against.

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone          text NOT NULL UNIQUE,
  language          text NOT NULL DEFAULT 'en',
  escalated         boolean NOT NULL DEFAULT false,
  escalated_at      timestamptz,
  escalation_reason text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_message_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction       text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  -- Meta's message id. Unique so a webhook retry cannot produce a second AI
  -- call and a duplicate reply; NULL for messages we originate.
  wa_message_id   text UNIQUE,
  -- NULL or 'reply' is conversational and is replayed to the model. 'welcome',
  -- 'handover' and 'unsupported' are canned text and are not.
  kind            text CHECK (kind IN ('welcome', 'reply', 'handover', 'unsupported')),
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages      ENABLE ROW LEVEL SECURITY;

-- Admins triage the escalation queue. No INSERT/UPDATE policy: only the
-- service role writes, which bypasses RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_conversations'
      AND policyname = 'Admins can view whatsapp conversations'
  ) THEN
    CREATE POLICY "Admins can view whatsapp conversations"
      ON public.whatsapp_conversations FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_messages'
      AND policyname = 'Admins can view whatsapp messages'
  ) THEN
    CREATE POLICY "Admins can view whatsapp messages"
      ON public.whatsapp_messages FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS whatsapp_messages_conversation_idx
  ON public.whatsapp_messages (conversation_id, created_at DESC);

-- The team's work queue: open escalations, oldest first.
CREATE INDEX IF NOT EXISTS whatsapp_conversations_escalated_idx
  ON public.whatsapp_conversations (escalated_at)
  WHERE escalated;

COMMENT ON TABLE public.whatsapp_conversations IS
  'One row per WhatsApp sender. Written only by the whatsapp-webhook edge function with the service role; readable by admins for escalation triage.';
