-- ============================================================
-- Migration: Advanced AI Library Assistant (Phase 8)
--
-- Purpose: extends the Phase 6.5 AI Reading Assistant with per-user reading
-- preferences (reading-level mode, read-aloud voice/speed/pitch, last-used
-- translation language), a per-user activity log for the AI actions that
-- don't already have a user-scoped table (summaries and text-action-cache
-- results are shared/global, so a personal "history" needs its own log),
-- and a small global content cache so repeated identical translate/
-- explain-selection requests don't re-call the model — mirrors
-- library_ai_summaries' existing cache pattern exactly.
--
-- Added: library_ai_preferences, library_ai_activity_log,
--   library_ai_content_cache.
-- Realtime: library_ai_chat_sessions added to the supabase_realtime
--   publication so the same signed-in user's open tabs/devices for a book
--   see new chat turns live instead of requiring a manual refetch.
-- ============================================================

-- ============================================================
-- library_ai_preferences — one row per user. Drives every AI call's
-- reading-level style (beginner/student/professional/child/simple_language/
-- academic) without every call site needing to remember it, and remembers
-- read-aloud voice/speed/pitch plus the last translation target language
-- across sessions/devices.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_ai_preferences (
  user_id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reading_mode             TEXT NOT NULL DEFAULT 'student'
    CHECK (reading_mode IN ('beginner', 'student', 'professional', 'child', 'simple_language', 'academic')),
  voice                    TEXT NOT NULL DEFAULT 'nova',
  speech_speed             NUMERIC NOT NULL DEFAULT 1.0 CHECK (speech_speed BETWEEN 0.5 AND 2.0),
  speech_pitch             NUMERIC NOT NULL DEFAULT 0 CHECK (speech_pitch BETWEEN -600 AND 600),
  last_translation_language TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_ai_preferences: user manages own"
  ON public.library_ai_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Reuses the existing shared trigger (defined once, already used across the
-- rest of the Library schema — see LIBRARY_SCHEMA.md's Triggers section).
DROP TRIGGER IF EXISTS trg_library_ai_preferences_touch ON public.library_ai_preferences;
CREATE TRIGGER trg_library_ai_preferences_touch
  BEFORE UPDATE ON public.library_ai_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.library_ai_preferences IS 'Per-user AI Reading Assistant preferences — reading-level mode applied to every AI call''s system prompt, plus remembered read-aloud voice/speed/pitch and last translation language.';

-- ============================================================
-- library_ai_activity_log — per-user "what AI things have I done" history
-- for summary/translation/explain-selection actions. Chat already has its
-- own user-scoped table (library_ai_chat_sessions) and is merged with this
-- one client-side for a single History view — not duplicated here.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_ai_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('summary', 'translation', 'explain_selection')),
  title         TEXT NOT NULL,
  snippet       TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_ai_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_ai_activity_log: user manages own"
  ON public.library_ai_activity_log FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_ai_activity_log_user_recent ON public.library_ai_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_ai_activity_log_user_book ON public.library_ai_activity_log(user_id, book_id, created_at DESC);

COMMENT ON TABLE public.library_ai_activity_log IS 'Per-user history of summary/translation/explain-selection AI actions — written by the calling user''s own JWT client (RLS scopes writes/reads to auth.uid() = user_id automatically, no service-role bypass needed).';

-- ============================================================
-- library_ai_content_cache — global, unattributed result cache (mirrors
-- library_ai_summaries' pattern exactly): translate-paragraph and
-- explain-paragraph results are a deterministic function of
-- (action, target language / instruction, reading mode, input text), so a
-- repeated identical request is a free cache read instead of a new LLM
-- call. No user_id — this is shared across everyone, same privacy shape as
-- library_ai_summaries (the underlying text is whatever the requester
-- already had access to; the cache never introduces new access).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_ai_content_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash  TEXT NOT NULL,
  action        TEXT NOT NULL,
  result_text   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_hash)
);

ALTER TABLE public.library_ai_content_cache ENABLE ROW LEVEL SECURITY;

-- Any authenticated caller can read a cache hit — same shape as
-- library_ai_summaries' "read if accessible" policy, simplified because
-- this cache holds no book-scoped content (translate/explain-selection
-- operate on text the client already possesses, not on cached book text).
CREATE POLICY "library_ai_content_cache: authenticated read"
  ON public.library_ai_content_cache FOR SELECT
  TO authenticated
  USING (true);

-- No client write policy — written only by the service-role client from
-- inside library-ai-assistant's translate-paragraph/explain-paragraph
-- handling, right after generating (same write model as
-- library_ai_summaries).

CREATE INDEX IF NOT EXISTS idx_library_ai_content_cache_hash ON public.library_ai_content_cache(content_hash);

COMMENT ON TABLE public.library_ai_content_cache IS 'Global cache for translate-paragraph/explain-paragraph results, keyed by a hash of (action, params, reading mode, input text) — repeated identical requests are a free DB read instead of a new LLM call.';

-- ============================================================
-- Realtime — enables live cross-tab/device sync of "chat with the book"
-- turns (useLibraryAiChat subscribes to INSERT events filtered by
-- session_id; RLS on the table already scopes what a subscriber can
-- actually receive to their own rows).
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'library_ai_chat_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.library_ai_chat_sessions;
  END IF;
END $$;
