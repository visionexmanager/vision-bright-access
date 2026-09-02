-- IVX — projects.
--
-- ── What a project is, and what it deliberately is not ──────────────────────
--
-- A question asks whether you know something. A project asks whether you can
-- do something with it: a brief, a piece of work, and a rubric it is judged
-- against.
--
-- It does **not** move mastery, and that is a decision rather than an
-- omission. `ivx_mastery.score` answers exactly one question — "have I learned
-- this skill" — and it answers it from evidence of a very specific kind:
-- distinct questions, at difficulty, unaided. A project graded 78 by a
-- language model is evidence of something real, but it is not that kind of
-- evidence, and folding it in would make the mastery number mean two things at
-- once. Two meanings for one number is how a progress bar stops being worth
-- reading.
--
-- So a project earns XP through the Academy's own ledger — the same ledger a
-- question and a course lesson feed — and stands as its own record beside
-- mastery, not inside it.
--
-- ── Who grades ─────────────────────────────────────────────────────────────
--
-- Not the client. A submission is written here, graded by `ai-chat` under the
-- service role against the rubric stored here, and written back through
-- `ivx_project_grade`, which no browser can call. A client that could post its
-- own score could post a hundred.

-- ── The catalog ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ivx_projects (
  slug         text PRIMARY KEY,
  subject_slug text NOT NULL REFERENCES public.ivx_subjects(slug) ON DELETE CASCADE,
  title        jsonb NOT NULL,
  brief        jsonb NOT NULL,
  -- A plain-words reading of anything the brief only conveys on screen. Same
  -- contract as `ivx_questions.accessible`.
  accessible   jsonb NOT NULL DEFAULT '{}',
  -- [{ "id": "c1", "weight": 25, "criterion": { "en": "…", "ar": "…" } }]
  -- Weights are expected to total 100; the grader is told the weights and the
  -- total is checked when content is added, not enforced by a constraint that
  -- would block a half-written draft.
  rubric       jsonb NOT NULL DEFAULT '[]',
  -- The skills this project exercises. Shown to the student and used to
  -- recommend a project once the groundwork is there. Not a mastery input.
  skills       text[] NOT NULL DEFAULT '{}',
  level        integer NOT NULL DEFAULT 3 CHECK (level BETWEEN 1 AND 10),
  est_minutes  integer NOT NULL DEFAULT 45 CHECK (est_minutes > 0),
  xp_award     integer NOT NULL DEFAULT 60 CHECK (xp_award >= 0),
  sort_order   integer NOT NULL DEFAULT 100,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ivx_projects_subject_idx
  ON public.ivx_projects(subject_slug, sort_order) WHERE is_active;

COMMENT ON TABLE public.ivx_projects IS
  'Project briefs and their rubrics. Public reading: unlike a question, a brief has no hidden answer — the rubric is what the student is being asked to do, and hiding it would only make the task guesswork.';

-- ── Submissions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ivx_project_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_slug text NOT NULL REFERENCES public.ivx_projects(slug) ON DELETE CASCADE,
  content      text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','graded')),
  score        numeric(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  -- { "summary": "…", "criteria": [{ "id": "c1", "score": 20, "note": "…" }] }
  feedback     jsonb NOT NULL DEFAULT '{}',
  xp_awarded   integer NOT NULL DEFAULT 0,
  attempt_no   integer NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  graded_at    timestamptz
);

-- One live submission per student per project. Resubmitting reuses the row and
-- raises `attempt_no`, so a student's history is a score that moved rather than
-- a pile of rows nobody can compare.
CREATE UNIQUE INDEX IF NOT EXISTS ivx_project_submissions_one_idx
  ON public.ivx_project_submissions(user_id, project_slug);

CREATE INDEX IF NOT EXISTS ivx_project_submissions_user_idx
  ON public.ivx_project_submissions(user_id, updated_at DESC);

ALTER TABLE public.ivx_projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ivx_project_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ivx_projects' AND policyname = 'ivx_projects_read') THEN
    CREATE POLICY "ivx_projects_read" ON public.ivx_projects FOR SELECT USING (is_active);
  END IF;

  -- A student reads their own submissions. Writing goes through the functions:
  -- an UPDATE policy here would let a client set its own score.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ivx_project_submissions' AND policyname = 'ivx_project_submissions_own'
  ) THEN
    CREATE POLICY "ivx_project_submissions_own" ON public.ivx_project_submissions
      FOR SELECT USING ((select auth.uid()) = user_id);
  END IF;
END $$;

GRANT SELECT ON public.ivx_projects TO anon, authenticated;
GRANT SELECT ON public.ivx_project_submissions TO authenticated;
GRANT ALL    ON public.ivx_projects, public.ivx_project_submissions TO service_role;

-- ── Reading the catalog ─────────────────────────────────────────────────────

/**
 * Every project, with this student's standing on each.
 *
 * `unlocked` reuses `ivx_skill_unlocked` over the project's skills rather than
 * inventing a second idea of readiness: if the questions behind a skill are
 * still locked, a project built on that skill is not a challenge, it is a
 * wall.
 */
CREATE OR REPLACE FUNCTION public.ivx_projects_list(_language text DEFAULT 'en')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := (select auth.uid());
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'slug', p.slug,
               'subject', p.subject_slug,
               'title', public.ivx_text(p.title, _language),
               'level', p.level,
               'est_minutes', p.est_minutes,
               'xp_award', p.xp_award,
               'skills', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object(
                          'slug', k.slug,
                          'title', public.ivx_text(k.title, _language)))
                   FROM public.ivx_skills k WHERE k.slug = ANY(p.skills)
               ), '[]'::jsonb),
               'unlocked', NOT EXISTS (
                 SELECT 1 FROM unnest(p.skills) AS s(slug)
                  WHERE NOT public.ivx_skill_unlocked(_user_id, s.slug)
               ),
               'status', COALESCE(sub.status, 'not_started'),
               'score', sub.score,
               'attempt_no', sub.attempt_no
             ) ORDER BY p.subject_slug, p.sort_order)
        FROM public.ivx_projects p
        LEFT JOIN public.ivx_project_submissions sub
               ON sub.project_slug = p.slug AND sub.user_id = _user_id
       WHERE p.is_active
    ), '[]'::jsonb)
  );
END;
$$;

/** One brief, its rubric, and whatever this student has written so far. */
CREATE OR REPLACE FUNCTION public.ivx_project(_slug text, _language text DEFAULT 'en')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := (select auth.uid());
  _p       public.ivx_projects%ROWTYPE;
  _sub     public.ivx_project_submissions%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _p FROM public.ivx_projects WHERE slug = _slug AND is_active;
  IF _p.slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_project');
  END IF;

  SELECT * INTO _sub FROM public.ivx_project_submissions
   WHERE user_id = _user_id AND project_slug = _slug;

  RETURN jsonb_build_object(
    'ok', true,
    'slug', _p.slug,
    'subject', _p.subject_slug,
    'title', public.ivx_text(_p.title, _language),
    'brief', public.ivx_text(_p.brief, _language),
    'accessible', public.ivx_text(_p.accessible, _language),
    'level', _p.level,
    'est_minutes', _p.est_minutes,
    'xp_award', _p.xp_award,
    -- The rubric is shown, not hidden. A student who knows what they are being
    -- judged on does better work; a student who does not is guessing, and
    -- guessing is not the skill being taught.
    'rubric', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', c ->> 'id',
               'weight', (c ->> 'weight')::numeric,
               'criterion', public.ivx_text(c -> 'criterion', _language)))
        FROM jsonb_array_elements(_p.rubric) c
    ), '[]'::jsonb),
    'submission', CASE WHEN _sub.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', _sub.id,
      'content', _sub.content,
      'status', _sub.status,
      'score', _sub.score,
      'feedback', _sub.feedback,
      'xp_awarded', _sub.xp_awarded,
      'attempt_no', _sub.attempt_no,
      'graded_at', _sub.graded_at
    ) END
  );
END;
$$;

-- ── Writing ─────────────────────────────────────────────────────────────────

/** Save a draft. Nothing is graded and nothing is spent. */
CREATE OR REPLACE FUNCTION public.ivx_project_save(_slug text, _content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := (select auth.uid());
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ivx_projects WHERE slug = _slug AND is_active) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_project');
  END IF;

  INSERT INTO public.ivx_project_submissions (user_id, project_slug, content, status)
  VALUES (_user_id, _slug, left(COALESCE(_content, ''), 20000), 'draft')
  ON CONFLICT (user_id, project_slug) DO UPDATE
    SET content = EXCLUDED.content,
        -- A graded submission that is edited becomes a draft again. Leaving it
        -- "graded" would show a score for work that is no longer the work.
        status = CASE WHEN public.ivx_project_submissions.status = 'graded' THEN 'draft'
                      ELSE public.ivx_project_submissions.status END,
        updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

/**
 * Hand it in.
 *
 * Marks the row `submitted` and returns what the grader will need. It does not
 * grade: grading reaches a language model, which cannot happen inside a
 * transaction here, and must not happen in a browser at all.
 */
CREATE OR REPLACE FUNCTION public.ivx_project_submit(_slug text, _content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := (select auth.uid());
  _text    text := btrim(COALESCE(_content, ''));
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ivx_projects WHERE slug = _slug AND is_active) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_project');
  END IF;
  -- Something to grade. An empty submission graded by a model produces a
  -- confident paragraph about nothing, and costs the student a request.
  IF length(_text) < 40 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_short');
  END IF;

  INSERT INTO public.ivx_project_submissions
    (user_id, project_slug, content, status, submitted_at)
  VALUES (_user_id, _slug, left(_text, 20000), 'submitted', now())
  ON CONFLICT (user_id, project_slug) DO UPDATE
    SET content = EXCLUDED.content,
        status = 'submitted',
        submitted_at = now(),
        updated_at = now(),
        attempt_no = public.ivx_project_submissions.attempt_no
                     + CASE WHEN public.ivx_project_submissions.status = 'graded' THEN 1 ELSE 0 END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

/**
 * The grader's view of a submission.
 *
 * Service role only, and it takes the student as an argument because the
 * caller is `ai-chat` acting on a session it has already authenticated. It
 * returns the brief, the rubric and the work — never anything about the
 * person who wrote it, because a grader that knows whose work this is grades
 * it differently.
 */
CREATE OR REPLACE FUNCTION public.ivx_project_for_grading(
  _user_id  uuid,
  _slug     text,
  _language text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p   public.ivx_projects%ROWTYPE;
  _sub public.ivx_project_submissions%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.ivx_projects WHERE slug = _slug AND is_active;
  IF _p.slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_project');
  END IF;

  SELECT * INTO _sub FROM public.ivx_project_submissions
   WHERE user_id = _user_id AND project_slug = _slug;

  IF _sub.id IS NULL OR _sub.status <> 'submitted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_submitted');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'title', public.ivx_text(_p.title, _language),
    'brief', public.ivx_text(_p.brief, _language),
    'language', COALESCE(_language, 'en'),
    'rubric', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', c ->> 'id',
               'weight', (c ->> 'weight')::numeric,
               'criterion', public.ivx_text(c -> 'criterion', _language)))
        FROM jsonb_array_elements(_p.rubric) c
    ), '[]'::jsonb),
    'work', _sub.content
  );
END;
$$;

/**
 * Record a grade.
 *
 * Service role only. The score is clamped here rather than trusted: a model
 * asked for 0–100 will occasionally answer 105, and a stored 105 quietly
 * breaks every average built on this column afterwards.
 *
 * XP is awarded once per attempt and only above a pass mark, through the
 * Academy's ledger — so a project, a question and a course lesson still feed
 * one streak and one leaderboard.
 */
CREATE OR REPLACE FUNCTION public.ivx_project_grade(
  _user_id  uuid,
  _slug     text,
  _score    numeric,
  _feedback jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub    public.ivx_project_submissions%ROWTYPE;
  _award  integer := 0;
  _clamped numeric := LEAST(100, GREATEST(0, COALESCE(_score, 0)));
BEGIN
  SELECT * INTO _sub FROM public.ivx_project_submissions
   WHERE user_id = _user_id AND project_slug = _slug;

  IF _sub.id IS NULL OR _sub.status <> 'submitted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_submitted');
  END IF;

  IF _clamped >= 60 THEN
    SELECT xp_award INTO _award FROM public.ivx_projects WHERE slug = _slug;
    -- Only the difference. Resubmitting a project that already paid out should
    -- top up to the award, not pay it again.
    _award := GREATEST(0, COALESCE(_award, 0) - _sub.xp_awarded);
  END IF;

  UPDATE public.ivx_project_submissions
     SET status = 'graded',
         score = _clamped,
         feedback = COALESCE(_feedback, '{}'::jsonb),
         xp_awarded = xp_awarded + _award,
         graded_at = now(),
         updated_at = now()
   WHERE id = _sub.id;

  -- `award_academy_xp` derives the student from `auth.uid()`, which is null
  -- here because the service role is acting on somebody's behalf. It used to
  -- take a user id and that form was deliberately dropped in
  -- 20260705000000 — any authenticated caller could award XP to any account —
  -- so reintroducing one, even a service-role-only one, would put that shape
  -- back in the schema for somebody to widen later.
  --
  -- Instead this writes the same three tables the ledger writes, inline, the
  -- way `ivx_wa_submit_answer` already does for WhatsApp. All three matter:
  -- `academy_profiles` is the total, `academy_xp_events` is the history, and
  -- `user_points` is the leaderboard. Writing only the first would show a
  -- student XP that never reaches the board they are comparing against.
  IF _award > 0 THEN
    INSERT INTO public.academy_xp_events(user_id, amount, reason) VALUES (_user_id, _award, 'ivx_project');
    INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _award, 'ivx_project');
    UPDATE public.academy_profiles
       SET xp_total = xp_total + _award, last_active = now()
     WHERE user_id = _user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'score', _clamped, 'xp', _award);
END;
$$;

-- ── Permissions ─────────────────────────────────────────────────────────────

DO $$
DECLARE _fn text;
BEGIN
  -- Called by a browser; each derives the student from the session.
  FOREACH _fn IN ARRAY ARRAY[
    'public.ivx_projects_list(text)',
    'public.ivx_project(text, text)',
    'public.ivx_project_save(text, text)',
    'public.ivx_project_submit(text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _fn);
  END LOOP;

  -- Grading. Both name a student in their arguments, so neither may be
  -- reachable from a browser: a client that could call `ivx_project_grade`
  -- could award itself a hundred.
  FOREACH _fn IN ARRAY ARRAY[
    'public.ivx_project_for_grading(uuid, text, text)',
    'public.ivx_project_grade(uuid, text, numeric, jsonb)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _fn);
  END LOOP;
END $$;
