-- ============================================================
-- Migration: academy_chat_sessions
-- Purpose:   Persist Academy chat history per user.
--            Replaces ephemeral messages[] state in Academy.tsx.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.academy_chat_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  UUID        NOT NULL,      -- groups messages in one conversation
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.academy_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_chat: users manage own messages"
  ON public.academy_chat_sessions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_academy_chat_user_session
  ON public.academy_chat_sessions(user_id, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_academy_chat_user_recent
  ON public.academy_chat_sessions(user_id, created_at DESC);

COMMENT ON TABLE public.academy_chat_sessions IS
  'Persisted Academy (Munir) chat message history, grouped by session_id.';

COMMENT ON COLUMN public.academy_chat_sessions.session_id IS
  'UUID generated per chat session (cleared when user clears chat).
   Multiple sessions per user are retained for history.';
