-- IVX — the engine. Selection, validation, mastery, XP.
--
-- Every function here is SECURITY DEFINER and derives the student from
-- `auth.uid()` or from a WhatsApp binding. None of them takes a user id from a
-- caller: a function that did could be asked to write somebody else's mastery.

-- ── Is this skill unlocked? ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ivx_skill_unlocked(_user_id uuid, _skill text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  -- Unlocked when every prerequisite has reached at least 'developing'. A
  -- prerequisite the student has never touched blocks, which is the point.
  SELECT NOT EXISTS (
    SELECT 1
      FROM public.ivx_skill_prerequisites p
      LEFT JOIN public.ivx_mastery m
        ON m.user_id = _user_id AND m.skill_slug = p.requires_slug
     WHERE p.skill_slug = _skill
       AND COALESCE(m.state, 'not_started') NOT IN ('developing','proficient','mastered')
  );
$$;

-- ── Mastery, after one attempt ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ivx_state_for(_score numeric, _distinct_correct integer, _best_difficulty integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  -- Mastery is not a percentage. Reaching the top needs three things at once:
  -- a high score, breadth (several different questions answered correctly),
  -- and evidence at a real difficulty. Answering one easy question twenty
  -- times moves the score and nothing else, which is the intent.
  SELECT CASE
    WHEN _score >= 90 AND _distinct_correct >= 5 AND _best_difficulty >= 3 THEN 'mastered'
    WHEN _score >= 75 AND _distinct_correct >= 3 THEN 'proficient'
    WHEN _score >= 55 THEN 'developing'
    WHEN _score >  0  THEN 'learning'
    ELSE 'introduced'
  END;
$$;

CREATE OR REPLACE FUNCTION public.ivx_apply_attempt(
  _user_id     uuid,
  _question_id uuid,
  _correct     boolean,
  _hints       integer,
  _difficulty  integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _skill    text;
  _row      public.ivx_mastery%ROWTYPE;
  _weight   numeric;
  _target   numeric;
  _score    numeric;
  _distinct integer;
  _state    text;
  _interval interval;
BEGIN
  SELECT skill_slug INTO _skill FROM public.ivx_questions WHERE id = _question_id;
  IF _skill IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_question');
  END IF;

  INSERT INTO public.ivx_mastery (user_id, skill_slug)
  VALUES (_user_id, _skill)
  ON CONFLICT (user_id, skill_slug) DO NOTHING;

  SELECT * INTO _row FROM public.ivx_mastery
   WHERE user_id = _user_id AND skill_slug = _skill FOR UPDATE;

  -- A harder question moves the score further, in both directions. A hint
  -- earns less than an unaided answer — it is help, not proof.
  _weight := 0.18 + (COALESCE(_difficulty, 3) - 1) * 0.05;
  _target := CASE
    WHEN _correct AND COALESCE(_hints, 0) = 0 THEN 100
    WHEN _correct THEN 70
    ELSE 0
  END;
  _score := ROUND(GREATEST(0, LEAST(100, _row.score + (_target - _row.score) * _weight)), 2);

  SELECT count(DISTINCT question_id) INTO _distinct
    FROM public.ivx_attempts
   WHERE user_id = _user_id AND skill_slug = _skill AND is_correct;

  _state := public.ivx_state_for(
    _score,
    _distinct,
    GREATEST(_row.best_difficulty, CASE WHEN _correct THEN COALESCE(_difficulty, 3) ELSE 0 END)
  );

  -- Spaced review. A mistake brings the skill straight back; mastery pushes it
  -- weeks out. The ladder is deliberately short — a learner who never sees a
  -- skill again has not retained it, they have simply stopped being asked.
  _interval := CASE
    WHEN NOT _correct THEN interval '10 minutes'
    WHEN _state = 'mastered'   THEN interval '21 days'
    WHEN _state = 'proficient' THEN interval '7 days'
    WHEN _state = 'developing' THEN interval '2 days'
    ELSE interval '6 hours'
  END;

  UPDATE public.ivx_mastery
     SET score            = _score,
         state            = _state,
         attempts         = _row.attempts + 1,
         correct          = _row.correct + CASE WHEN _correct THEN 1 ELSE 0 END,
         distinct_correct = _distinct,
         best_difficulty  = GREATEST(_row.best_difficulty,
                                     CASE WHEN _correct THEN COALESCE(_difficulty, 3) ELSE 0 END),
         streak           = CASE WHEN _correct THEN _row.streak + 1 ELSE 0 END,
         last_seen_at     = now(),
         due_at           = now() + _interval
   WHERE user_id = _user_id AND skill_slug = _skill;

  RETURN jsonb_build_object(
    'ok', true, 'skill', _skill, 'score', _score, 'state', _state,
    'streak', CASE WHEN _correct THEN _row.streak + 1 ELSE 0 END
  );
END;
$$;

-- ── What should this student do next? ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ivx_pick_skill(_user_id uuid, _subject text DEFAULT NULL)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- One ordering, three ideas in it:
  --   * anything due for review comes first, because retention beats novelty;
  --   * then the weakest unlocked skill, because that is where practice pays;
  --   * then the next unstarted skill in the syllabus.
  -- Skills whose prerequisites are unmet never appear at all.
  SELECT s.slug
    FROM public.ivx_skills s
    LEFT JOIN public.ivx_mastery m
      ON m.user_id = _user_id AND m.skill_slug = s.slug
   WHERE s.is_active
     AND (_subject IS NULL OR s.subject_slug = _subject)
     AND public.ivx_skill_unlocked(_user_id, s.slug)
     AND EXISTS (SELECT 1 FROM public.ivx_questions q WHERE q.skill_slug = s.slug AND q.is_active)
   ORDER BY
     CASE WHEN m.user_id IS NOT NULL AND m.due_at <= now() AND m.state <> 'mastered' THEN 0 ELSE 1 END,
     COALESCE(m.score, -1) ASC,
     s.level ASC,
     s.sort_order ASC,
     s.slug ASC
   LIMIT 1;
$$;

-- ── The next question ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ivx_deal_question(
  _user_id  uuid,
  _skill    text,
  _language text,
  _channel  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _asked   uuid[];
  _q       public.ivx_questions%ROWTYPE;
  _score   numeric;
  _options jsonb;
BEGIN
  SELECT COALESCE(asked, '{}') INTO _asked
    FROM public.ivx_sessions WHERE user_id = _user_id AND channel = _channel;
  _asked := COALESCE(_asked, '{}');

  SELECT COALESCE(score, 0) INTO _score
    FROM public.ivx_mastery WHERE user_id = _user_id AND skill_slug = _skill;
  _score := COALESCE(_score, 0);

  -- Difficulty follows the score: a beginner meets 1–2, somebody at 80 meets
  -- 3–5. Ordering prefers an unseen question, then the closest difficulty to
  -- where the student actually is, then randomness so two runs differ.
  SELECT * INTO _q
    FROM public.ivx_questions q
   WHERE q.skill_slug = _skill
     AND q.is_active
   ORDER BY
     (q.id = ANY(_asked)) ASC,
     abs(q.difficulty - GREATEST(1, LEAST(5, 1 + floor(_score / 22)::integer))) ASC,
     random()
   LIMIT 1;

  IF _q.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_questions');
  END IF;

  -- Options are localized here and stripped of anything that hints at the
  -- answer: the shape a client receives contains no correctness at all.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', opt ->> 'id',
           'label', public.ivx_text(opt -> 'label', _language)
         ) ORDER BY ord), '[]')
    INTO _options
    FROM jsonb_array_elements(_q.options) WITH ORDINALITY AS t(opt, ord);

  INSERT INTO public.ivx_sessions (user_id, channel, skill_slug, open_question, asked, asked_count)
  VALUES (_user_id, _channel, _skill, _q.id, ARRAY[_q.id], 1)
  ON CONFLICT (user_id, channel) DO UPDATE
    SET skill_slug    = EXCLUDED.skill_slug,
        open_question = EXCLUDED.open_question,
        asked         = CASE
                          WHEN public.ivx_sessions.skill_slug IS DISTINCT FROM EXCLUDED.skill_slug
                            THEN ARRAY[_q.id]
                          ELSE (public.ivx_sessions.asked || _q.id)
                        END,
        asked_count   = public.ivx_sessions.asked_count + 1,
        updated_at    = now();

  RETURN jsonb_build_object(
    'ok', true,
    'question_id', _q.id,
    'skill', _skill,
    'skill_title', (SELECT public.ivx_text(title, _language) FROM public.ivx_skills WHERE slug = _skill),
    'kind', _q.kind,
    'prompt', public.ivx_text(_q.prompt, _language),
    'options', _options,
    'accessible', public.ivx_text(_q.accessible, _language),
    'difficulty', _q.difficulty,
    'has_hint', public.ivx_text(_q.hint, _language) <> ''
  );
END;
$$;

-- ── Checking an answer ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ivx_answer_matches(_answer jsonb, _given text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _expected text := COALESCE(_answer ->> 'value', '');
  _tol      numeric := COALESCE((_answer ->> 'tolerance')::numeric, 0);
  _given_n  numeric;
  _exp_n    numeric;
BEGIN
  IF _given IS NULL THEN RETURN false; END IF;

  -- Numeric answers compare as numbers, with a tolerance, so "0.75", ".75" and
  -- "0.750" are one answer and not three. A fraction is accepted written as
  -- one: a learner typing 3/4 has answered the question.
  BEGIN
    _given_n := CASE
      WHEN btrim(_given) ~ '^-?\d+\s*/\s*\d+$'
        THEN split_part(replace(btrim(_given), ' ', ''), '/', 1)::numeric
             / NULLIF(split_part(replace(btrim(_given), ' ', ''), '/', 2)::numeric, 0)
      ELSE btrim(_given)::numeric
    END;
    _exp_n := CASE
      WHEN btrim(_expected) ~ '^-?\d+\s*/\s*\d+$'
        THEN split_part(replace(btrim(_expected), ' ', ''), '/', 1)::numeric
             / NULLIF(split_part(replace(btrim(_expected), ' ', ''), '/', 2)::numeric, 0)
      ELSE btrim(_expected)::numeric
    END;
    IF _given_n IS NOT NULL AND _exp_n IS NOT NULL THEN
      RETURN abs(_given_n - _exp_n) <= GREATEST(_tol, 0);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Not numeric on one side or the other; fall through to text.
    NULL;
  END;

  -- Text compares case-insensitively and ignores surrounding space and Arabic
  -- or Latin final punctuation, because none of those is what was being taught.
  RETURN lower(btrim(regexp_replace(_given, '[\s.،,!؟?]+$', ''))) =
         lower(btrim(regexp_replace(_expected, '[\s.،,!؟?]+$', '')));
END;
$$;

CREATE OR REPLACE FUNCTION public.ivx_grade(
  _user_id     uuid,
  _question_id uuid,
  _given       text,
  _hints       integer,
  _elapsed_ms  integer,
  _language    text,
  _channel     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _q       public.ivx_questions%ROWTYPE;
  _correct boolean;
  _mastery jsonb;
  _xp      integer;
BEGIN
  SELECT * INTO _q FROM public.ivx_questions WHERE id = _question_id AND is_active;
  IF _q.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_question');
  END IF;

  _correct := public.ivx_answer_matches(_q.answer, _given);

  INSERT INTO public.ivx_attempts
    (user_id, question_id, skill_slug, is_correct, given, hints_used, elapsed_ms, channel)
  VALUES
    (_user_id, _question_id, _q.skill_slug, _correct, left(COALESCE(_given, ''), 500),
     GREATEST(0, COALESCE(_hints, 0)), _elapsed_ms, COALESCE(_channel, 'web'));

  _mastery := public.ivx_apply_attempt(_user_id, _question_id, _correct, _hints, _q.difficulty);

  -- XP through the Academy's own ledger, so an IVX answer and a course lesson
  -- feed one streak, one total and one leaderboard. A hint halves it; being
  -- wrong still earns a little, because attempting is the behaviour to keep.
  _xp := CASE
    WHEN _correct AND COALESCE(_hints, 0) = 0 THEN 5 + _q.difficulty * 2
    WHEN _correct THEN GREATEST(2, (5 + _q.difficulty * 2) / 2)
    ELSE 1
  END;

  UPDATE public.ivx_sessions
     SET open_question = NULL,
         correct_count = correct_count + CASE WHEN _correct THEN 1 ELSE 0 END,
         hints_used    = hints_used + GREATEST(0, COALESCE(_hints, 0)),
         updated_at    = now()
   WHERE user_id = _user_id AND channel = COALESCE(_channel, 'web');

  RETURN jsonb_build_object(
    'ok', true,
    'correct', _correct,
    'expected', CASE WHEN _correct THEN NULL ELSE _q.answer ->> 'value' END,
    'explanation', public.ivx_text(_q.explanation, _language),
    'xp', _xp,
    'mastery', _mastery
  );
END;
$$;
