-- IVX — Intelligent Visionex Learning: the core schema and the engine.
--
-- ── Where the engine lives, and why ─────────────────────────────────────────
--
-- IVX has to answer the same student on the website and on WhatsApp, and their
-- progress has to be one thing. The webhook is Deno, the site is React, and
-- neither can import the other's code — so an engine written in TypeScript
-- would have to exist twice, and two copies of a mastery calculation is two
-- different answers to "have I learned this yet".
--
-- So the engine is here. Selection, validation, mastery and XP are SQL
-- functions; the channels are thin. That buys three things beyond having one
-- copy:
--
--   * The answer never reaches the client. `ivx_questions.answer` is not
--     readable by anybody but the definer functions, so a student cannot read
--     it out of a network response, and "correct" is decided by the server.
--   * Progress is transactional. An attempt and the mastery it changes are one
--     statement, not a read-modify-write race between two tabs.
--   * WhatsApp gets progress without getting identity. The `_wa_phone`
--     variants resolve the account internally and return only the lesson —
--     the same decision `whatsapp_identity_state` and `whatsapp_entitlements`
--     already took.
--
-- ── What is reused rather than rebuilt ──────────────────────────────────────
--
-- `academy_profiles` is the student. `award_academy_xp` is the XP. `auth.users`
-- is the identity, `whatsapp_identities` is the phone binding. None of them is
-- duplicated here.
--
-- ── Multilingual by construction ────────────────────────────────────────────
--
-- Every human-readable string is `jsonb` keyed by language tag, never a pair of
-- `_en`/`_ar` columns. Adding Turkish is a key in a row, not a migration.

-- ── Subjects ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ivx_subjects (
  slug        text PRIMARY KEY,
  title       jsonb NOT NULL,           -- { "en": "Mathematics", "ar": "الرياضيات" }
  description jsonb NOT NULL DEFAULT '{}',
  icon        text,
  sort_order  integer NOT NULL DEFAULT 100,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ivx_subjects IS
  'IVX subject areas. Titles are jsonb keyed by language tag so a new language is a key, not a column.';

-- ── Skills ──────────────────────────────────────────────────────────────────
--
-- The unit a student masters. A skill belongs to a subject and sits at a level;
-- what unlocks it is the prerequisite table below, so a skill can appear in
-- several learning paths without being copied.

CREATE TABLE IF NOT EXISTS public.ivx_skills (
  slug         text PRIMARY KEY,
  subject_slug text NOT NULL REFERENCES public.ivx_subjects(slug) ON DELETE CASCADE,
  title        jsonb NOT NULL,
  objective    jsonb NOT NULL DEFAULT '{}',
  -- 1 (first steps) … 10 (advanced). Used for ordering and for the difficulty
  -- floor a skill's questions are expected to sit around.
  level        integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  sort_order   integer NOT NULL DEFAULT 100,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ivx_skills_subject_idx ON public.ivx_skills(subject_slug, sort_order);

CREATE TABLE IF NOT EXISTS public.ivx_skill_prerequisites (
  skill_slug    text NOT NULL REFERENCES public.ivx_skills(slug) ON DELETE CASCADE,
  requires_slug text NOT NULL REFERENCES public.ivx_skills(slug) ON DELETE CASCADE,
  PRIMARY KEY (skill_slug, requires_slug),
  CONSTRAINT ivx_prereq_not_self CHECK (skill_slug <> requires_slug)
);

-- ── Questions ───────────────────────────────────────────────────────────────
--
-- `answer` is the reason this table has no read policy at all. Everything a
-- student may see is projected by `ivx_next_question`; everything they may not
-- stays here.

CREATE TABLE IF NOT EXISTS public.ivx_questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_slug   text NOT NULL REFERENCES public.ivx_skills(slug) ON DELETE CASCADE,
  kind         text NOT NULL DEFAULT 'multiple_choice'
               CHECK (kind IN ('multiple_choice','true_false','numeric','text','fill_blank','ordering','code')),
  prompt       jsonb NOT NULL,                    -- { "en": "...", "ar": "..." }
  options      jsonb NOT NULL DEFAULT '[]',       -- [{ "id":"a", "label": {"en":"…"} }]
  answer       jsonb NOT NULL,                    -- { "value": "a" } or { "value": "0.75", "tolerance": 0.001 }
  explanation  jsonb NOT NULL DEFAULT '{}',
  hint         jsonb NOT NULL DEFAULT '{}',
  -- What a screen reader should hear instead of a rendered figure. Required in
  -- spirit for anything visual; enforced by the content validator, not here,
  -- because a text question legitimately has none.
  accessible   jsonb NOT NULL DEFAULT '{}',
  difficulty   integer NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ivx_questions_skill_idx
  ON public.ivx_questions(skill_slug, difficulty) WHERE is_active;

COMMENT ON COLUMN public.ivx_questions.answer IS
  'Never projected to a client. Answers are checked by ivx_submit_answer inside the database, so a student cannot read the answer out of a response or mark themselves correct.';

-- ── What a student has done ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ivx_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES public.ivx_questions(id) ON DELETE CASCADE,
  skill_slug   text NOT NULL REFERENCES public.ivx_skills(slug) ON DELETE CASCADE,
  is_correct   boolean NOT NULL,
  given        text,
  hints_used   integer NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  elapsed_ms   integer CHECK (elapsed_ms IS NULL OR elapsed_ms >= 0),
  channel      text NOT NULL DEFAULT 'web' CHECK (channel IN ('web','whatsapp','voice','api')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ivx_attempts_user_skill_idx
  ON public.ivx_attempts(user_id, skill_slug, created_at DESC);

-- ── Mastery ─────────────────────────────────────────────────────────────────
--
-- One row per student per skill. `score` is 0–100 and is not a percentage of
-- correct answers: see `ivx_apply_attempt` for what it actually measures.

CREATE TABLE IF NOT EXISTS public.ivx_mastery (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_slug   text NOT NULL REFERENCES public.ivx_skills(slug) ON DELETE CASCADE,
  state        text NOT NULL DEFAULT 'introduced'
               CHECK (state IN ('not_started','introduced','learning','developing','proficient','mastered')),
  score        numeric(5,2) NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  attempts     integer NOT NULL DEFAULT 0,
  correct      integer NOT NULL DEFAULT 0,
  -- Distinct questions answered correctly. Mastery needs breadth, which is what
  -- stops somebody answering the same easy question twenty times.
  distinct_correct integer NOT NULL DEFAULT 0,
  best_difficulty integer NOT NULL DEFAULT 0,
  streak       integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  -- When this skill should come back for review. Spaced repetition, widened by
  -- mastery and reset by a mistake.
  due_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_slug)
);

CREATE INDEX IF NOT EXISTS ivx_mastery_due_idx ON public.ivx_mastery(user_id, due_at);

-- ── Sessions ────────────────────────────────────────────────────────────────
--
-- What a channel needs to carry a practice run across messages: which question
-- is open, and what has been asked already so it is not asked twice.

CREATE TABLE IF NOT EXISTS public.ivx_sessions (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel       text NOT NULL CHECK (channel IN ('web','whatsapp','voice','api')),
  skill_slug    text REFERENCES public.ivx_skills(slug) ON DELETE SET NULL,
  open_question uuid REFERENCES public.ivx_questions(id) ON DELETE SET NULL,
  asked         uuid[] NOT NULL DEFAULT '{}',
  correct_count integer NOT NULL DEFAULT 0,
  asked_count   integer NOT NULL DEFAULT 0,
  hints_used    integer NOT NULL DEFAULT 0,
  started_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel)
);

-- ── Row level security ──────────────────────────────────────────────────────

ALTER TABLE public.ivx_subjects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ivx_skills              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ivx_skill_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ivx_questions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ivx_attempts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ivx_mastery             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ivx_sessions            ENABLE ROW LEVEL SECURITY;

-- The curriculum is public reading. The question bank is not.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ivx_subjects' AND policyname = 'ivx_subjects_read') THEN
    CREATE POLICY "ivx_subjects_read" ON public.ivx_subjects FOR SELECT USING (is_active);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ivx_skills' AND policyname = 'ivx_skills_read') THEN
    CREATE POLICY "ivx_skills_read" ON public.ivx_skills FOR SELECT USING (is_active);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ivx_skill_prerequisites' AND policyname = 'ivx_prereq_read') THEN
    CREATE POLICY "ivx_prereq_read" ON public.ivx_skill_prerequisites FOR SELECT USING (true);
  END IF;

  -- A student reads their own progress and nothing else. Writes go through the
  -- functions below, which is why there is no INSERT or UPDATE policy here:
  -- a client that could write its own mastery row could award itself mastery.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ivx_attempts' AND policyname = 'ivx_attempts_own') THEN
    CREATE POLICY "ivx_attempts_own" ON public.ivx_attempts FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ivx_mastery' AND policyname = 'ivx_mastery_own') THEN
    CREATE POLICY "ivx_mastery_own" ON public.ivx_mastery FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ivx_sessions' AND policyname = 'ivx_sessions_own') THEN
    CREATE POLICY "ivx_sessions_own" ON public.ivx_sessions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- `ivx_questions` gets no policy at all: RLS with no policy denies every role
-- except the service role, and the definer functions below are the only way in.
REVOKE ALL ON TABLE public.ivx_questions FROM PUBLIC;
REVOKE ALL ON TABLE public.ivx_questions FROM anon;
REVOKE ALL ON TABLE public.ivx_questions FROM authenticated;
GRANT ALL ON TABLE public.ivx_questions TO service_role;

GRANT SELECT ON public.ivx_subjects, public.ivx_skills, public.ivx_skill_prerequisites TO anon, authenticated;
GRANT SELECT ON public.ivx_attempts, public.ivx_mastery, public.ivx_sessions TO authenticated;
GRANT ALL ON public.ivx_subjects, public.ivx_skills, public.ivx_skill_prerequisites,
             public.ivx_attempts, public.ivx_mastery, public.ivx_sessions TO service_role;

-- ── Language fallback ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ivx_text(_field jsonb, _language text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  -- The asked-for language, then English, then whatever exists. A missing
  -- translation shows the lesson in another language rather than showing a
  -- blank, which is the failure a learner cannot work around.
  SELECT COALESCE(
    NULLIF(_field ->> COALESCE(_language, 'en'), ''),
    NULLIF(_field ->> 'en', ''),
    (SELECT value FROM jsonb_each_text(_field) WHERE value <> '' LIMIT 1),
    ''
  );
$$;

COMMENT ON FUNCTION public.ivx_text(jsonb, text) IS
  'Read a localized field with a fallback chain: requested language, English, then any translation that exists.';
