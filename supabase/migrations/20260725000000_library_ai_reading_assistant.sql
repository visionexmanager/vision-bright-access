-- ============================================================
-- Migration: Library AI Reading Assistant (Phase 6.5)
--
-- Purpose: replace the flat "concatenate every accessible chapter up to a
-- 40,000-character cutoff" approach every AI mode has used since Phase 5
-- with a real chunk + embed + retrieve (RAG) pipeline, so no AI call ever
-- sends more than a handful of relevant excerpts to the model — the
-- explicit Phase 6.5 security requirement. Also adds persistence for chat
-- history, cached/"remembered" summaries, saved flashcards, and quiz
-- attempts, plus a stats-only (non-generative) reading-coach RPC.
--
-- Added: pgvector extension (2nd extension ever enabled on this project,
--   after pgcrypto), library_chapter_chunks, library_ai_chat_sessions,
--   library_ai_summaries, library_ai_flashcards, library_ai_quiz_attempts.
-- Functions added: match_library_chapter_chunks, get_library_reading_coach_stats.
-- Functions extended (CREATE OR REPLACE, same signature): award_library_xp,
--   check_ai_rate_limit.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- library_chapter_chunks — sub-chapter chunks of content_text, embedded via
-- OpenAI text-embedding-3-small (1536 dims, matching the existing
-- ai_embeddings/embed-content precedent in 20260614000000_ai_embeddings.sql).
-- NOT the same table as ai_embeddings: that table embeds one whole row per
-- source record with a blanket "authenticated" read policy, which would
-- leak paid-book text to non-purchasers if reused here. This table mirrors
-- library_chapters' own RLS exactly instead.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_chapter_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  chapter_id    UUID NOT NULL REFERENCES public.library_chapters(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  content       TEXT NOT NULL,
  embedding     VECTOR(1536),
  char_count    INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, chunk_index)
);

ALTER TABLE public.library_chapter_chunks ENABLE ROW LEVEL SECURITY;

-- Mirrors library_chapters' own SELECT policy exactly (is_free_preview OR
-- can_access_library_book_content) — a chunk is exactly as sensitive as the
-- chapter it was cut from.
CREATE POLICY "library_chapter_chunks: read if accessible"
  ON public.library_chapter_chunks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.library_chapters c WHERE c.id = chapter_id AND c.is_free_preview = true)
    OR public.can_access_library_book_content(book_id)
  );

-- No client INSERT/UPDATE/DELETE policy — chunks are only ever written by
-- the service-role client inside ensureBookIndexed() (edge functions), same
-- write model as ai_embeddings.

CREATE INDEX IF NOT EXISTS idx_library_chapter_chunks_embedding
  ON public.library_chapter_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_library_chapter_chunks_book ON public.library_chapter_chunks(book_id);

COMMENT ON TABLE public.library_chapter_chunks IS 'RAG chunk store for the AI Reading Assistant — chapters split into ~800-character overlapping chunks and embedded, so AI calls retrieve a handful of relevant excerpts instead of ever sending a whole book/chapter to the model.';

-- ============================================================
-- match_library_chapter_chunks — semantic search over one book's chunks.
-- SECURITY DEFINER bypasses RLS, so access is re-checked explicitly inside
-- the query body (same defense-in-depth as every other access-gated RPC in
-- this codebase, e.g. get_library_reader_analytics_summary's self-scoped
-- auth.uid() check) — never rely on the table's RLS alone once inside a
-- SECURITY DEFINER function.
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_library_chapter_chunks(
  _book_id uuid,
  _query_embedding vector(1536),
  _match_count integer DEFAULT 8,
  _chapter_id uuid DEFAULT NULL
)
RETURNS TABLE (
  chunk_id      uuid,
  chapter_id    uuid,
  chapter_title text,
  content       text,
  similarity    float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cc.id, cc.chapter_id, ch.title, cc.content, 1 - (cc.embedding <=> _query_embedding) AS similarity
  FROM public.library_chapter_chunks cc
  JOIN public.library_chapters ch ON ch.id = cc.chapter_id
  WHERE cc.book_id = _book_id
    AND (_chapter_id IS NULL OR cc.chapter_id = _chapter_id)
    AND (ch.is_free_preview = true OR public.can_access_library_book_content(_book_id))
    AND cc.embedding IS NOT NULL
  ORDER BY cc.embedding <=> _query_embedding
  LIMIT GREATEST(_match_count, 1)
$$;

COMMENT ON FUNCTION public.match_library_chapter_chunks IS 'Cosine-similarity search over one book''s chunks, access-checked explicitly (is_free_preview OR can_access_library_book_content) since SECURITY DEFINER bypasses table RLS. Granted to anon so free-preview chapters stay searchable for signed-out visitors, same as library_chapters itself.';

GRANT EXECUTE ON FUNCTION public.match_library_chapter_chunks(uuid, vector, integer, uuid) TO anon, authenticated;

-- ============================================================
-- library_ai_chat_sessions — mirrors academy_chat_sessions
-- (20260609100001_academy_chat_sessions.sql) exactly, plus book_id since
-- Library's chat is per-book rather than one global assistant.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_ai_chat_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  session_id    UUID NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_ai_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_ai_chat_sessions: user manages own"
  ON public.library_ai_chat_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_ai_chat_user_book_session ON public.library_ai_chat_sessions(user_id, book_id, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_ai_chat_user_recent ON public.library_ai_chat_sessions(user_id, created_at DESC);

COMMENT ON TABLE public.library_ai_chat_sessions IS 'Persisted "chat with the book" message history, grouped by session_id — same shape as academy_chat_sessions, scoped per-book.';

-- ============================================================
-- library_ai_summaries — cache AND memory in one table: repeated summary
-- requests hit this instead of re-calling the LLM (performance), and it's
-- what the reader's Summaries tab lists as "your book's summaries so far"
-- (the AI-memory requirement). Public-readable under the same access gate
-- as the content it summarizes.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_ai_summaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  chapter_id    UUID REFERENCES public.library_chapters(id) ON DELETE CASCADE,
  scope         TEXT NOT NULL CHECK (scope IN ('page', 'chapter', 'book')),
  length        TEXT NOT NULL CHECK (length IN ('quick', 'medium', 'detailed')),
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, chapter_id, scope, length)
);

ALTER TABLE public.library_ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_ai_summaries: read if accessible"
  ON public.library_ai_summaries FOR SELECT
  USING (
    (chapter_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.library_chapters c WHERE c.id = chapter_id AND c.is_free_preview = true))
    OR public.can_access_library_book_content(book_id)
  );

-- No client write policy — written only by the service-role client from
-- inside the smart-summary mode handler, right after generating.

CREATE INDEX IF NOT EXISTS idx_library_ai_summaries_book ON public.library_ai_summaries(book_id);

COMMENT ON TABLE public.library_ai_summaries IS 'Cache + memory for generated summaries, keyed by (book, chapter-or-null-for-whole-book, scope, length) — satisfies both "remember past summaries" and "cache repeated summary requests" in one table.';

-- ============================================================
-- library_ai_flashcards
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_ai_flashcards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  chapter_id    UUID REFERENCES public.library_chapters(id) ON DELETE SET NULL,
  front         TEXT NOT NULL,
  back          TEXT NOT NULL,
  mastered      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_ai_flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_ai_flashcards: user manages own"
  ON public.library_ai_flashcards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_ai_flashcards_user_book ON public.library_ai_flashcards(user_id, book_id);

-- ============================================================
-- library_ai_quiz_attempts — the generated quiz (with its answer key) and
-- the user's submitted answers/score are stored together so "your past
-- quizzes" can be reviewed later; auto-grading itself is a simple
-- normalized-string/index comparison done by the client (or a thin service
-- function) at submit time, not new backend grading logic.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_ai_quiz_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  chapter_id    UUID REFERENCES public.library_chapters(id) ON DELETE SET NULL,
  quiz          JSONB NOT NULL,
  answers       JSONB NOT NULL,
  score         INTEGER NOT NULL CHECK (score >= 0),
  total         INTEGER NOT NULL CHECK (total > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_ai_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_ai_quiz_attempts: user manages own"
  ON public.library_ai_quiz_attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_ai_quiz_attempts_user_book ON public.library_ai_quiz_attempts(user_id, book_id, created_at DESC);

-- ============================================================
-- get_library_reading_coach_stats — self-scoped (auth.uid() derived
-- internally), computed from data already being collected
-- (library_reading_progress, library_analytics_events, the existing
-- library_challenges/library_challenge_progress tables) — deliberately NOT
-- an LLM call, arithmetic is faster/cheaper/more honest here than a model
-- guessing at a user's reading pace.
--
-- "Reading speed" is expressed as pages/day (derived from current_page vs.
-- days elapsed since started_at), not words-per-minute — no per-session
-- time-spent instrumentation exists in this codebase to support a more
-- precise figure, and a fabricated one would be worse than an honest,
-- coarser one. Documented scope choice, not an oversight.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_library_reading_coach_stats(_book_id uuid)
RETURNS TABLE (
  current_page          integer,
  total_pages           integer,
  percent_complete      numeric,
  days_reading          integer,
  pages_per_day         numeric,
  estimated_days_left   numeric,
  active_goals          jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH progress AS (
    SELECT rp.current_page, rp.percent_complete, rp.started_at, rp.last_read_at, b.page_count
    FROM public.library_reading_progress rp
    JOIN public.library_books b ON b.id = rp.book_id
    WHERE rp.user_id = auth.uid() AND rp.book_id = _book_id
  ),
  computed AS (
    SELECT
      p.current_page,
      p.page_count AS total_pages,
      p.percent_complete,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (p.last_read_at - p.started_at)) / 86400.0))::integer AS days_reading,
      p.current_page::numeric / GREATEST(1, CEIL(EXTRACT(EPOCH FROM (p.last_read_at - p.started_at)) / 86400.0)) AS pages_per_day
    FROM progress p
  ),
  goals AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'title', c.title, 'goal_type', c.goal_type, 'goal_target', c.goal_target,
      'current_value', COALESCE(cp.current_value, 0), 'reward_vx', c.reward_vx,
      'completed', cp.completed_at IS NOT NULL
    )), '[]'::jsonb) AS active_goals
    FROM public.library_challenges c
    LEFT JOIN public.library_challenge_progress cp ON cp.challenge_id = c.id AND cp.user_id = auth.uid()
    WHERE c.is_active = true AND (c.ends_at IS NULL OR c.ends_at > now())
  )
  SELECT
    c.current_page, c.total_pages, c.percent_complete, c.days_reading,
    ROUND(c.pages_per_day, 1),
    CASE WHEN c.pages_per_day > 0 AND c.total_pages IS NOT NULL
      THEN ROUND(GREATEST(0, c.total_pages - c.current_page) / c.pages_per_day, 1)
      ELSE NULL END,
    g.active_goals
  FROM computed c, goals g
$$;

COMMENT ON FUNCTION public.get_library_reading_coach_stats IS 'Self-scoped, stats-only reading-pace summary for one book — pages/day and estimated days-to-finish derived from library_reading_progress, plus the user''s current active reading-goal progress from library_challenges. No LLM call.';

GRANT EXECUTE ON FUNCTION public.get_library_reading_coach_stats(uuid) TO authenticated;

-- ============================================================
-- award_library_xp — extended reason whitelist (CREATE OR REPLACE, same
-- signature as 20260720000002_library_core_commerce_gamification.sql).
-- Every existing WHEN branch is preserved unchanged; four new branches
-- added for Phase 6.5's VX triggers. 'Book completed:%' and 'Daily reading
-- goal:%' already exist and are reused as-is for their matching spec
-- bullets (finishing a book, hitting a daily goal) — not duplicated here.
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_library_xp(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  CASE
    WHEN _reason LIKE 'Book completed:%'      THEN _max_amount := 100;
    WHEN _reason LIKE 'Review written:%'      THEN _max_amount := 25;
    WHEN _reason LIKE 'Reading streak:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'Challenge completed:%' THEN _max_amount := 300;
    WHEN _reason LIKE 'Daily reading goal:%'  THEN _max_amount := 20;
    WHEN _reason LIKE 'Summary completed:%'   THEN _max_amount := 10;
    WHEN _reason LIKE 'Quiz completed:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'Flashcards created:%'  THEN _max_amount := 15;
    WHEN _reason LIKE 'Weekly reading goal:%' THEN _max_amount := 40;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN
    RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason;
  END IF;

  INSERT INTO public.library_xp_events(user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);

  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_library_xp(INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.award_library_xp IS 'Self-only, amount-capped VX award for Library actions — writes to library_xp_events (audit) and public.user_points (the real balance). Phase 6.5 added Summary/Quiz/Flashcards/Weekly-goal reasons alongside the original Phase 2 set.';

-- ============================================================
-- check_ai_rate_limit — extended with explicit daily caps for the two new
-- Phase 6.5 edge functions (CREATE OR REPLACE, same signature as
-- 20260602000000_ai_rate_limiting.sql). Every existing WHEN branch is
-- preserved unchanged; library-ai-assistant previously fell through to the
-- default 30/day with no explicit case — now explicit. library-embed-book
-- is admin-only (role-gated in the edge function itself) and intentionally
-- has no entry here, matching how library-import-book (also admin/author-
-- gated) has never called this RPC either.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _user_id      UUID,
  _function_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _daily_count  BIGINT;
  _daily_limit  INTEGER;
BEGIN
  _daily_limit := CASE _function_name
    WHEN 'ai-chat'              THEN 60
    WHEN 'academy-chat'         THEN 60
    WHEN 'ocr-scan'             THEN 20
    WHEN 'radar-ai'             THEN 20
    WHEN 'analyze-meal'         THEN 20
    WHEN 'generate-diet-plan'   THEN 10
    WHEN 'realtime-session'     THEN 10
    WHEN 'enrich-product'       THEN 50
    WHEN 'library-ai-assistant' THEN 40
    WHEN 'library-ai-chat'      THEN 60
    ELSE 30
  END;

  SELECT COUNT(*) INTO _daily_count
  FROM public.ai_usage_log
  WHERE user_id       = _user_id
    AND function_name = _function_name
    AND created_at   >= current_date::timestamptz
    AND created_at   <  (current_date + interval '1 day')::timestamptz;

  IF _daily_count >= _daily_limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_usage_log (user_id, function_name)
  VALUES (_user_id, _function_name);

  DELETE FROM public.ai_usage_log
  WHERE user_id = _user_id
    AND created_at < now() - interval '48 hours';

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO service_role;
