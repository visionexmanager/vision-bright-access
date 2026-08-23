-- WhatsApp navigation state: where each sender is, between deliveries.
--
-- No new table. `whatsapp_conversations` is already one row per phone number
-- with a unique index on it, already service-role only, and already the thing
-- the webhook loads on every message. A second table keyed on the same phone
-- number would be a second round trip and a new way for the two to disagree
-- about the same person.
--
-- What lives here is navigation state and short-lived working context — the
-- things a timeout is allowed to drop. What deliberately does not live here is
-- anything permanent about the sender: `preferred_language`, `voice_mode` and
-- `verbosity` are their own columns, are not part of the session, and survive
-- a reset. That separation is the reason "your language stayed but your
-- half-finished upload did not" is a property of the schema rather than a rule
-- someone has to remember in application code.
--
-- Message bodies are not stored here. The transcript in `whatsapp_messages`
-- already holds what was said, under its own retention; `session_context` is
-- for a few keys a feature needs mid-task and is cleared when the task ends.

ALTER TABLE public.whatsapp_conversations
  -- Root-first node ids, e.g. ["main","ocr"]. jsonb rather than text[] so a
  -- feature can never be tempted to widen it into something structured.
  ADD COLUMN IF NOT EXISTS nav_path jsonb NOT NULL DEFAULT '["main"]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_feature text,
  ADD COLUMN IF NOT EXISTS current_step text,
  -- {operation, startedAt, context} — what `#` cancels and a timeout drops.
  ADD COLUMN IF NOT EXISTS pending_operation jsonb,
  ADD COLUMN IF NOT EXISTS session_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS session_updated_at timestamptz;

COMMENT ON COLUMN public.whatsapp_conversations.nav_path IS
  'Root-first navigation path as node ids from the WhatsApp catalog. Reset by the session timeout.';

COMMENT ON COLUMN public.whatsapp_conversations.current_feature IS
  'The catalog action the sender is inside, if any. NULL at a menu.';

COMMENT ON COLUMN public.whatsapp_conversations.current_step IS
  'Where inside that feature, named by the feature itself (e.g. awaiting_image).';

COMMENT ON COLUMN public.whatsapp_conversations.pending_operation IS
  'What the assistant is waiting on: {operation, startedAt, context}. Cleared by # and by the session timeout.';

COMMENT ON COLUMN public.whatsapp_conversations.session_context IS
  'Short-lived working context for the current task. Not a place for anything permanent, and not a message store.';

COMMENT ON COLUMN public.whatsapp_conversations.session_updated_at IS
  'Last interaction. The session timeout is measured from here; permanent preferences are not affected by it.';

-- Sessions are always read by wa_phone, which is already unique, so no index is
-- added for the read path. This one exists for the sweep that will eventually
-- clear abandoned working state, and is partial so it stays small: a row with
-- nothing pending has nothing to clean up.
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_stale_sessions
  ON public.whatsapp_conversations (session_updated_at)
  WHERE pending_operation IS NOT NULL;
