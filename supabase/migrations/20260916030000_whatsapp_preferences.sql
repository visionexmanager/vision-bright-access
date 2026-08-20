-- WhatsApp assistant: the few preferences worth remembering.
--
-- Only what changes how the assistant answers. A phone number is already
-- personal data; adding anything not needed to reply well would be collecting
-- for its own sake.
--
--   voice_replies - opt-in. A spoken reply is never the default: it cannot be
--                   skimmed, searched or quoted, and it arrives in a room the
--                   sender may not control.
--   verbosity     - 'concise' or 'detailed'. NULL is the normal middle.
--
-- Marketing opt-in is deliberately absent: there is no marketing send path in
-- this feature, and a consent flag with nothing reading it is a liability
-- pretending to be a feature.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS voice_replies boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verbosity text
    CHECK (verbosity IS NULL OR verbosity IN ('concise', 'detailed'));

COMMENT ON COLUMN public.whatsapp_conversations.voice_replies IS
  'Opt-in spoken replies. False by default: a voice note cannot be skimmed or searched, and may arrive somewhere the sender does not control.';

COMMENT ON COLUMN public.whatsapp_conversations.verbosity IS
  'How much detail the sender asked for. NULL is the default middle.';
