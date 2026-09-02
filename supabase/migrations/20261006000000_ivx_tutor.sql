-- IVX — the tutor.
--
-- A stored explanation answers the question the author imagined. It does not
-- answer "but why isn't it 12?", which is the question a student actually has,
-- and it cannot notice that this student has now made the same mistake three
-- times. This migration is the part of the tutor that has to be in the
-- database; the language model itself is reached through the existing
-- `ai-chat` function and the existing assistant registry.
--
-- ── What the database owes the tutor, and what it must never hand it ────────
--
-- The tutor needs the question, what the student said, and what they have
-- historically got wrong. Whether it may also see the *answer* depends on one
-- thing: has the student already answered?
--
--   * The question is still open  → SOCRATIC. The brief carries no answer and
--     no explanation, because a model that has been told the answer will leak
--     it, however politely it is asked not to. It cannot leak what it was
--     never sent.
--   * The student has answered    → EXPLAIN. The answer and the explanation
--     are already in the student's hands (`ivx_submit_answer` returned them),
--     so there is nothing left to protect and everything to explain.
--   * Neither                     → refused. Tutoring is not a side door onto
--     the question bank: without this, a client could walk a list of ids and
--     ask the tutor to discuss each one.
--
-- The mode is decided here, in SQL, from the session and attempt rows. It is
-- not a flag the caller passes, because a flag is a thing a caller can lie
-- about.

-- ── The conversation ────────────────────────────────────────────────────────
--
-- Stored because WhatsApp has no other memory between two messages, and
-- because a student who was helped through a hard idea on Tuesday should be
-- able to read it again on Friday.

CREATE TABLE IF NOT EXISTS public.ivx_tutor_turns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.ivx_questions(id) ON DELETE SET NULL,
  skill_slug  text REFERENCES public.ivx_skills(slug) ON DELETE SET NULL,
  role        text NOT NULL CHECK (role IN ('student','tutor')),
  body        text NOT NULL,
  channel     text NOT NULL DEFAULT 'web' CHECK (channel IN ('web','whatsapp','voice','api')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ivx_tutor_turns_thread_idx
  ON public.ivx_tutor_turns(user_id, question_id, created_at);

COMMENT ON TABLE public.ivx_tutor_turns IS
  'The tutoring dialogue. A student reads their own turns; only the definer functions write, so a client cannot forge a tutor turn and cannot put words in the tutor''s mouth for anybody else.';

ALTER TABLE public.ivx_tutor_turns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'ivx_tutor_turns' AND policyname = 'ivx_tutor_turns_own'
  ) THEN
    CREATE POLICY "ivx_tutor_turns_own" ON public.ivx_tutor_turns
      FOR SELECT USING ((select auth.uid()) = user_id);
  END IF;
END $$;

GRANT SELECT ON public.ivx_tutor_turns TO authenticated;
GRANT ALL    ON public.ivx_tutor_turns TO service_role;

-- ── How much this student has struggled here ────────────────────────────────
--
-- Two numbers the tutor cannot work out for itself and a student should not
-- have to explain: how often this skill has gone wrong lately, and what they
-- actually typed the last few times. It is the difference between "let me
-- explain fractions" and "you are adding the denominators again".

CREATE OR REPLACE FUNCTION public.ivx_tutor_struggle(_user_id uuid, _skill text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'recent_wrong', COUNT(*) FILTER (WHERE NOT is_correct),
    'recent_total', COUNT(*),
    'recent_wrong_answers', COALESCE(
      jsonb_agg(given ORDER BY created_at DESC) FILTER (WHERE NOT is_correct AND given IS NOT NULL),
      '[]'::jsonb
    )
  )
  FROM (
    SELECT is_correct, given, created_at
      FROM public.ivx_attempts
     WHERE user_id = _user_id AND skill_slug = _skill
     ORDER BY created_at DESC
     LIMIT 10
  ) recent;
$$;

-- ── The brief ───────────────────────────────────────────────────────────────
--
-- Assembled with the service role by `ai-chat`, never by a browser. The client
-- sends a question id and a message; everything the model is told about the
-- question comes from here.

CREATE OR REPLACE FUNCTION public.ivx_tutor_brief(
  _user_id     uuid,
  _question_id uuid,
  _language    text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _q        public.ivx_questions%ROWTYPE;
  _skill    public.ivx_skills%ROWTYPE;
  _is_open  boolean;
  _attempt  public.ivx_attempts%ROWTYPE;
  _mastery  public.ivx_mastery%ROWTYPE;
  _mode     text;
  _brief    jsonb;
BEGIN
  IF _user_id IS NULL OR _question_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _q FROM public.ivx_questions WHERE id = _question_id AND is_active;
  IF _q.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_question');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.ivx_sessions
     WHERE user_id = _user_id AND open_question = _question_id
  ) INTO _is_open;

  SELECT * INTO _attempt
    FROM public.ivx_attempts
   WHERE user_id = _user_id AND question_id = _question_id
   ORDER BY created_at DESC
   LIMIT 1;

  -- Open beats answered: a question dealt again after a first attempt is being
  -- worked on now, and the tutor must not hand over the answer mid-thought.
  IF _is_open THEN
    _mode := 'socratic';
  ELSIF _attempt.id IS NOT NULL THEN
    _mode := 'explain';
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'not_your_question');
  END IF;

  SELECT * INTO _skill  FROM public.ivx_skills  WHERE slug = _q.skill_slug;
  SELECT * INTO _mastery FROM public.ivx_mastery WHERE user_id = _user_id AND skill_slug = _q.skill_slug;

  _brief := jsonb_build_object(
    'ok', true,
    'mode', _mode,
    'language', COALESCE(_language, 'en'),
    'skill', _q.skill_slug,
    'skill_title', public.ivx_text(_skill.title, _language),
    'objective', public.ivx_text(_skill.objective, _language),
    'level', COALESCE(_skill.level, 1),
    'kind', _q.kind,
    'difficulty', _q.difficulty,
    'prompt', public.ivx_text(_q.prompt, _language),
    'accessible', public.ivx_text(_q.accessible, _language),
    'hint', public.ivx_text(_q.hint, _language),
    'options', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'id', opt ->> 'id',
                'label', public.ivx_text(opt -> 'label', _language)))
         FROM jsonb_array_elements(_q.options) opt),
      '[]'::jsonb
    ),
    'mastery', jsonb_build_object(
      'state', COALESCE(_mastery.state, 'not_started'),
      'score', COALESCE(_mastery.score, 0)
    ),
    'struggle', public.ivx_tutor_struggle(_user_id, _q.skill_slug)
  );

  -- The two fields that separate the modes. In socratic mode they are absent
  -- from the object entirely rather than null, so a prompt builder that
  -- forgets to check cannot interpolate the word "null" where an answer goes.
  IF _mode = 'explain' THEN
    _brief := _brief || jsonb_build_object(
      'expected', _q.answer ->> 'value',
      'explanation', public.ivx_text(_q.explanation, _language),
      'student_answer', _attempt.given,
      'was_correct', _attempt.is_correct
    );
  END IF;

  RETURN _brief;
END;
$$;

COMMENT ON FUNCTION public.ivx_tutor_brief(uuid, uuid, text) IS
  'Everything the tutor may know about one question for one student. Carries the answer only once that student has already answered — the mode is derived from session and attempt rows, never passed in.';

-- ── Recording turns ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ivx_tutor_log(
  _user_id     uuid,
  _question_id uuid,
  _role        text,
  _body        text,
  _channel     text DEFAULT 'web'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _skill text;
  _id    uuid;
BEGIN
  IF _user_id IS NULL OR _body IS NULL OR btrim(_body) = '' THEN
    RETURN NULL;
  END IF;

  SELECT skill_slug INTO _skill FROM public.ivx_questions WHERE id = _question_id;

  INSERT INTO public.ivx_tutor_turns (user_id, question_id, skill_slug, role, body, channel)
  VALUES (_user_id, _question_id, _skill, _role, left(_body, 4000), COALESCE(_channel, 'web'))
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

/**
 * The thread so far, for the student it belongs to.
 *
 * Both channels need it for the same reason: a tutor that cannot remember what
 * it just said starts every message from the beginning, and a student who has
 * to re-explain their confusion each turn stops asking.
 */
CREATE OR REPLACE FUNCTION public.ivx_tutor_history(
  _question_id uuid,
  _limit       integer DEFAULT 20
)
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
    'turns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('role', role, 'body', body, 'at', created_at)
                       ORDER BY created_at)
        FROM (
          SELECT role, body, created_at
            FROM public.ivx_tutor_turns
           WHERE user_id = _user_id AND question_id = _question_id
           ORDER BY created_at DESC
           LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100))
        ) recent
    ), '[]'::jsonb)
  );
END;
$$;

/**
 * Save the reply the student was just shown.
 *
 * The web tutor streams, so the reply exists in the browser before it exists
 * anywhere else, and the browser is the only thing that knows the stream
 * finished. This is therefore the one tutor write a client makes.
 *
 * What it can do is add a line to its own transcript. What it cannot do is
 * anything that matters: the transcript feeds no mastery, no XP and no
 * selection — `ivx_apply_attempt` never reads this table. Two guards keep it
 * shaped like a conversation rather than a scratch pad:
 *
 *   * the student must have a turn outstanding, so a reply always answers
 *     something they actually asked, and
 *   * the question must be one they were dealt, which is `ivx_tutor_brief`'s
 *     rule reused rather than restated.
 */
CREATE OR REPLACE FUNCTION public.ivx_tutor_save_reply(
  _question_id uuid,
  _body        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id   uuid := (select auth.uid());
  _last_role text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF NOT (public.ivx_tutor_brief(_user_id, _question_id, 'en') ->> 'ok')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_your_question');
  END IF;

  SELECT role INTO _last_role
    FROM public.ivx_tutor_turns
   WHERE user_id = _user_id AND question_id = _question_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF _last_role IS DISTINCT FROM 'student' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_turn_outstanding');
  END IF;

  PERFORM public.ivx_tutor_log(_user_id, _question_id, 'tutor', _body, 'web');
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── The WhatsApp door ───────────────────────────────────────────────────────
--
-- Same brief, resolved from the phone binding, and with the question chosen
-- rather than passed: on WhatsApp "why?" always means the question in front of
-- the student — the one still open, or failing that the one they just answered.

CREATE OR REPLACE FUNCTION public.ivx_wa_tutor_brief(
  _wa_phone text,
  _language text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := public.ivx_wa_user(_wa_phone);
  _qid     uuid;
  _brief   jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_linked');
  END IF;

  SELECT open_question INTO _qid
    FROM public.ivx_sessions
   WHERE user_id = _user_id AND channel = 'whatsapp';

  IF _qid IS NULL THEN
    SELECT question_id INTO _qid
      FROM public.ivx_attempts
     WHERE user_id = _user_id AND channel = 'whatsapp'
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;

  IF _qid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_open');
  END IF;

  _brief := public.ivx_tutor_brief(_user_id, _qid, _language);
  IF (_brief ->> 'ok')::boolean THEN
    _brief := _brief || jsonb_build_object('question_id', _qid);
  END IF;
  RETURN _brief;
END;
$$;

CREATE OR REPLACE FUNCTION public.ivx_wa_tutor_log(
  _wa_phone    text,
  _question_id uuid,
  _role        text,
  _body        text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := public.ivx_wa_user(_wa_phone);
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.ivx_tutor_log(_user_id, _question_id, _role, _body, 'whatsapp');
END;
$$;

/**
 * The thread so far, for WhatsApp.
 *
 * The webhook holds a phone number and nothing else, so it cannot call
 * `ivx_tutor_history` — that one derives the student from `auth.uid()`, which
 * is null here.
 */
CREATE OR REPLACE FUNCTION public.ivx_wa_tutor_history(
  _wa_phone    text,
  _question_id uuid,
  _limit       integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := public.ivx_wa_user(_wa_phone);
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_linked');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'turns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('role', role, 'body', body) ORDER BY created_at)
        FROM (
          SELECT role, body, created_at
            FROM public.ivx_tutor_turns
           WHERE user_id = _user_id AND question_id = _question_id
           ORDER BY created_at DESC
           LIMIT GREATEST(1, LEAST(COALESCE(_limit, 10), 50))
        ) recent
    ), '[]'::jsonb)
  );
END;
$$;

-- ── Permissions ─────────────────────────────────────────────────────────────
--
-- `ivx_tutor_history` is the only one a browser calls; it derives the student
-- from `auth.uid()` and returns nothing else. Everything that takes a user id
-- or a phone number as an argument is service-role only, because an argument
-- is a thing a caller chooses.
--
-- REVOKE ALL … FROM PUBLIC also revokes service_role, so every grant below is
-- written beside its revoke rather than assumed.

DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'public.ivx_tutor_brief(uuid, uuid, text)',
    'public.ivx_tutor_struggle(uuid, text)',
    'public.ivx_tutor_log(uuid, uuid, text, text, text)',
    'public.ivx_wa_tutor_brief(text, text)',
    'public.ivx_wa_tutor_log(text, uuid, text, text)',
    'public.ivx_wa_tutor_history(text, uuid, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _fn);
  END LOOP;

  FOREACH _fn IN ARRAY ARRAY[
    'public.ivx_tutor_history(uuid, integer)',
    'public.ivx_tutor_save_reply(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _fn);
  END LOOP;
END $$;
