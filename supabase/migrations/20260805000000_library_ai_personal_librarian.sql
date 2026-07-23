-- ─── Library — AI Personal Librarian ───────────────────────────────────────
-- A unifying AI companion layer. Most of the underlying data already exists
-- (library_reading_progress, library_bookmarks/notes/highlights,
-- library_favorites, library_reader_profiles, library_reading_goals,
-- library_challenges, library_ai_preferences, library_ai_chat_sessions,
-- library_book_recommendations, library_certificates, library_research_*,
-- library_analytics_events) — this migration only adds what's genuinely
-- missing: extended AI-memory preference columns, favorite topics, skills,
-- qualitative goals, a cross-book "librarian" chat mode, persisted daily
-- plans/summaries/recommendations, and a privacy/data-request audit log.

-- ============================================================================
-- 1. EXTEND library_ai_preferences — the "AI Memory" section
-- ============================================================================

ALTER TABLE public.library_ai_preferences
  ADD COLUMN IF NOT EXISTS reading_speed_pages_per_hour NUMERIC,
  ADD COLUMN IF NOT EXISTS listening_speed_preference NUMERIC NOT NULL DEFAULT 1.0
    CHECK (listening_speed_preference BETWEEN 0.5 AND 3.0),
  ADD COLUMN IF NOT EXISTS preferred_book_length TEXT
    CHECK (preferred_book_length IS NULL OR preferred_book_length IN ('short', 'medium', 'long', 'any')),
  ADD COLUMN IF NOT EXISTS learning_style TEXT
    CHECK (learning_style IS NULL OR learning_style IN ('visual', 'auditory', 'reading_writing', 'kinesthetic', 'mixed')),
  ADD COLUMN IF NOT EXISTS preferred_reading_time TEXT
    CHECK (preferred_reading_time IS NULL OR preferred_reading_time IN ('morning', 'afternoon', 'evening', 'night', 'any')),
  ADD COLUMN IF NOT EXISTS accessibility_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS memory_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS memory_paused_at TIMESTAMPTZ;

-- ============================================================================
-- 2. FAVORITE TOPICS — favorite knowledge-graph entities/topics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_favorite_topics (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id  UUID NOT NULL REFERENCES public.library_kg_entities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_id)
);

ALTER TABLE public.library_favorite_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_favorite_topics: user manages own"
  ON public.library_favorite_topics FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. SKILLS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.library_skill_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.library_skill_source AS ENUM ('manual', 'certificate', 'course');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_skills (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name            TEXT NOT NULL,
  proficiency_level     public.library_skill_level NOT NULL DEFAULT 'beginner',
  source                public.library_skill_source NOT NULL DEFAULT 'manual',
  related_certificate_id UUID REFERENCES public.library_certificates(id) ON DELETE SET NULL,
  related_course_id     UUID REFERENCES public.library_book_courses(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_name)
);

ALTER TABLE public.library_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_skills: user manages own"
  ON public.library_skills FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER library_skills_updated_at
  BEFORE UPDATE ON public.library_skills
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 4. QUALITATIVE GOALS — learning/study/career/custom (distinct from the
-- quantitative library_reading_goals cadence targets)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.library_librarian_goal_category AS ENUM ('learning', 'study', 'career', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.library_librarian_goal_status AS ENUM ('active', 'completed', 'abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_librarian_goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_category public.library_librarian_goal_category NOT NULL DEFAULT 'custom',
  title         TEXT NOT NULL,
  description   TEXT,
  target_date   DATE,
  status        public.library_librarian_goal_status NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_library_librarian_goals_user ON public.library_librarian_goals(user_id, status);

ALTER TABLE public.library_librarian_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_librarian_goals: user manages own"
  ON public.library_librarian_goals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER library_librarian_goals_updated_at
  BEFORE UPDATE ON public.library_librarian_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 5. WIDEN library_ai_chat_sessions for a cross-book "librarian chat" mode
-- ============================================================================

ALTER TABLE public.library_ai_chat_sessions ALTER COLUMN book_id DROP NOT NULL;

ALTER TABLE public.library_ai_chat_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'book_chat'
    CHECK (session_type IN ('book_chat', 'librarian_chat')),
  ADD COLUMN IF NOT EXISTS title TEXT;

-- A librarian_chat row must never carry a book_id, and a book_chat row must
-- always carry one — keeps the two modes from ever being ambiguous.
ALTER TABLE public.library_ai_chat_sessions
  DROP CONSTRAINT IF EXISTS library_ai_chat_sessions_session_type_book_id_check;
ALTER TABLE public.library_ai_chat_sessions
  ADD CONSTRAINT library_ai_chat_sessions_session_type_book_id_check
  CHECK (
    (session_type = 'book_chat' AND book_id IS NOT NULL)
    OR (session_type = 'librarian_chat' AND book_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_library_ai_chat_sessions_librarian
  ON public.library_ai_chat_sessions(user_id, session_type, session_id, created_at);

-- ============================================================================
-- 6. DAILY ASSISTANT — persisted daily plan bundle
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_librarian_daily_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date             DATE NOT NULL,
  reading_plan          JSONB NOT NULL DEFAULT '{}'::jsonb,
  study_plan            JSONB NOT NULL DEFAULT '{}'::jsonb,
  listening_plan        JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_plan           JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_flashcard_ids      UUID[] NOT NULL DEFAULT '{}',
  practice_questions    JSONB NOT NULL DEFAULT '[]'::jsonb,
  motivational_summary  TEXT,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date)
);

ALTER TABLE public.library_librarian_daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_librarian_daily_plans: user manages own"
  ON public.library_librarian_daily_plans FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 7. SMART SUMMARIES — persisted period summaries
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.library_summary_period AS ENUM ('daily', 'weekly', 'monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_librarian_summaries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_period    public.library_summary_period NOT NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  reading_insights  TEXT,
  learning_insights TEXT,
  skill_insights    TEXT,
  summary_text      TEXT,
  stats             JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, summary_period, period_start)
);

CREATE INDEX IF NOT EXISTS idx_library_librarian_summaries_user ON public.library_librarian_summaries(user_id, summary_period, period_start DESC);

ALTER TABLE public.library_librarian_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_librarian_summaries: user manages own"
  ON public.library_librarian_summaries FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 8. MULTI-TYPE RECOMMENDATIONS FEED
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.library_librarian_recommendation_type AS ENUM
    ('book', 'audiobook', 'article', 'course', 'author', 'book_club', 'learning_path', 'challenge', 'event', 'research_topic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_librarian_recommendations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_type public.library_librarian_recommendation_type NOT NULL,
  entity_id           UUID NOT NULL,
  title               TEXT NOT NULL,
  reason              TEXT,
  score               NUMERIC NOT NULL DEFAULT 0,
  is_dismissed        BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_librarian_recommendations_user
  ON public.library_librarian_recommendations(user_id, is_dismissed, recommendation_type, score DESC);

ALTER TABLE public.library_librarian_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_librarian_recommendations: user manages own"
  ON public.library_librarian_recommendations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 9. PRIVACY — data request audit log (mirrors career_data_requests)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.library_librarian_request_type AS ENUM ('export', 'delete_all', 'delete_category', 'pause', 'resume');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.library_librarian_request_status AS ENUM ('pending', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_librarian_data_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type public.library_librarian_request_type NOT NULL,
  category     TEXT,
  status       public.library_librarian_request_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_library_librarian_data_requests_user ON public.library_librarian_data_requests(user_id, created_at DESC);

ALTER TABLE public.library_librarian_data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_librarian_data_requests: user reads own"
  ON public.library_librarian_data_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts/updates only via the service-role edge function — no direct
-- authenticated write policy, matching library_quiz_questions'
-- no-direct-write-surface precedent for security-sensitive tables.

-- ============================================================================
-- 10. HELPER FUNCTIONS
-- ============================================================================

-- Due flashcards across ALL of a user's decks (get_library_due_flashcards is
-- per-deck; the Daily Assistant needs a cross-deck "what's due today" list).
CREATE OR REPLACE FUNCTION public.get_library_due_flashcards_for_user(_limit INTEGER DEFAULT 20)
RETURNS SETOF public.library_flashcards
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.* FROM public.library_flashcards f
  JOIN public.library_flashcard_decks d ON d.id = f.deck_id
  WHERE d.user_id = auth.uid() AND f.due_at <= now()
  ORDER BY f.due_at ASC
  LIMIT GREATEST(_limit, 1)
$$;

GRANT EXECUTE ON FUNCTION public.get_library_due_flashcards_for_user(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.pause_library_ai_memory()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.library_ai_preferences (user_id, memory_paused, memory_paused_at)
  VALUES (auth.uid(), true, now())
  ON CONFLICT (user_id) DO UPDATE SET memory_paused = true, memory_paused_at = now();
$$;

GRANT EXECUTE ON FUNCTION public.pause_library_ai_memory() TO authenticated;

CREATE OR REPLACE FUNCTION public.resume_library_ai_memory()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.library_ai_preferences (user_id, memory_paused, memory_paused_at)
  VALUES (auth.uid(), false, NULL)
  ON CONFLICT (user_id) DO UPDATE SET memory_paused = false, memory_paused_at = NULL;
$$;

GRANT EXECUTE ON FUNCTION public.resume_library_ai_memory() TO authenticated;

-- Selective memory deletion by a fixed category allow-list (never dynamic
-- SQL / string-built table names, to keep this injection-proof).
CREATE OR REPLACE FUNCTION public.delete_library_librarian_category(_category TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _category = 'highlights' THEN
    DELETE FROM public.library_highlights WHERE user_id = auth.uid();
  ELSIF _category = 'notes' THEN
    DELETE FROM public.library_notes WHERE user_id = auth.uid();
  ELSIF _category = 'bookmarks' THEN
    DELETE FROM public.library_bookmarks WHERE user_id = auth.uid();
  ELSIF _category = 'chat_history' THEN
    DELETE FROM public.library_ai_chat_sessions WHERE user_id = auth.uid();
  ELSIF _category = 'recommendations' THEN
    DELETE FROM public.library_librarian_recommendations WHERE user_id = auth.uid();
  ELSIF _category = 'daily_plans' THEN
    DELETE FROM public.library_librarian_daily_plans WHERE user_id = auth.uid();
  ELSIF _category = 'summaries' THEN
    DELETE FROM public.library_librarian_summaries WHERE user_id = auth.uid();
  ELSIF _category = 'goals' THEN
    DELETE FROM public.library_librarian_goals WHERE user_id = auth.uid();
  ELSIF _category = 'favorite_topics' THEN
    DELETE FROM public.library_favorite_topics WHERE user_id = auth.uid();
  ELSE
    RAISE EXCEPTION 'Unknown memory category: %', _category;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_library_librarian_category(TEXT) TO authenticated;
