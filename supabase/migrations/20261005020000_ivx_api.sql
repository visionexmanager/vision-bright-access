-- IVX — the channel API.
--
-- Two front doors onto one engine. The web door derives the student from
-- `auth.uid()`; the WhatsApp door resolves them from a verified phone binding
-- and returns the lesson without ever returning who they are.
--
-- Neither door takes a user id from its caller. That is the whole security
-- model: a client can ask "what is next for me" and "here is my answer", and
-- there is no argument it can change to become somebody else.

-- ── Website ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ivx_next_question(
  _subject  text DEFAULT NULL,
  _skill    text DEFAULT NULL,
  _language text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _pick    text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- An explicitly chosen skill is honoured only if its prerequisites are met.
  -- Otherwise the engine chooses, which is what "adaptive" has to mean when a
  -- learner has not decided for themselves.
  IF _skill IS NOT NULL AND public.ivx_skill_unlocked(_user_id, _skill) THEN
    _pick := _skill;
  ELSE
    _pick := public.ivx_pick_skill(_user_id, _subject);
  END IF;

  IF _pick IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_available');
  END IF;

  RETURN public.ivx_deal_question(_user_id, _pick, _language, 'web');
END;
$$;

CREATE OR REPLACE FUNCTION public.ivx_submit_answer(
  _question_id uuid,
  _given       text,
  _hints       integer DEFAULT 0,
  _elapsed_ms  integer DEFAULT NULL,
  _language    text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _open    uuid;
  _result  jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Only the question this student actually has open can be answered. Without
  -- this, a client could submit answers to questions it was never dealt and
  -- farm mastery from a list of ids.
  SELECT open_question INTO _open
    FROM public.ivx_sessions WHERE user_id = _user_id AND channel = 'web';

  IF _open IS NULL OR _open <> _question_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_the_open_question');
  END IF;

  _result := public.ivx_grade(_user_id, _question_id, _given, _hints, _elapsed_ms, _language, 'web');

  IF (_result ->> 'ok')::boolean THEN
    PERFORM public.award_academy_xp((_result ->> 'xp')::integer, 'ivx_practice');
  END IF;

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ivx_hint(_question_id uuid, _language text DEFAULT 'en')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _hint    text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT public.ivx_text(hint, _language) INTO _hint
    FROM public.ivx_questions WHERE id = _question_id AND is_active;

  IF _hint IS NULL OR _hint = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_hint');
  END IF;
  RETURN jsonb_build_object('ok', true, 'hint', _hint);
END;
$$;

/**
 * The dashboard, in one call.
 *
 * A page that fetched subjects, then skills, then mastery, then recommendations
 * would be four round trips before a screen reader could say anything useful.
 */
CREATE OR REPLACE FUNCTION public.ivx_progress(_language text DEFAULT 'en')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _next    text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  _next := public.ivx_pick_skill(_user_id, NULL);

  RETURN jsonb_build_object(
    'ok', true,
    'xp', COALESCE((SELECT xp_total FROM public.academy_profiles WHERE user_id = _user_id), 0),
    'streak_days', COALESCE((SELECT streak_days FROM public.academy_profiles WHERE user_id = _user_id), 0),
    'recommended', CASE WHEN _next IS NULL THEN NULL ELSE jsonb_build_object(
      'skill', _next,
      'title', (SELECT public.ivx_text(title, _language) FROM public.ivx_skills WHERE slug = _next),
      'subject', (SELECT subject_slug FROM public.ivx_skills WHERE slug = _next)
    ) END,
    'subjects', COALESCE((
      SELECT jsonb_agg(x ORDER BY x ->> 'sort')
        FROM (
          SELECT jsonb_build_object(
                   'slug', s.slug,
                   'title', public.ivx_text(s.title, _language),
                   'icon', s.icon,
                   'sort', lpad(s.sort_order::text, 5, '0'),
                   'skills_total', (SELECT count(*) FROM public.ivx_skills k
                                     WHERE k.subject_slug = s.slug AND k.is_active),
                   'skills_started', (SELECT count(*) FROM public.ivx_mastery m
                                        JOIN public.ivx_skills k ON k.slug = m.skill_slug
                                       WHERE m.user_id = _user_id AND k.subject_slug = s.slug),
                   'skills_mastered', (SELECT count(*) FROM public.ivx_mastery m
                                         JOIN public.ivx_skills k ON k.slug = m.skill_slug
                                        WHERE m.user_id = _user_id AND k.subject_slug = s.slug
                                          AND m.state = 'mastered')
                 ) AS x
            FROM public.ivx_subjects s
           WHERE s.is_active
        ) t
    ), '[]'),
    'skills', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'slug', k.slug,
               'subject', k.subject_slug,
               'title', public.ivx_text(k.title, _language),
               'level', k.level,
               'state', COALESCE(m.state, 'not_started'),
               'score', COALESCE(m.score, 0),
               'unlocked', public.ivx_skill_unlocked(_user_id, k.slug),
               'due', m.due_at IS NOT NULL AND m.due_at <= now()
             ) ORDER BY k.subject_slug, k.sort_order)
        FROM public.ivx_skills k
        LEFT JOIN public.ivx_mastery m ON m.user_id = _user_id AND m.skill_slug = k.slug
       WHERE k.is_active
    ), '[]')
  );
END;
$$;

-- ── WhatsApp ────────────────────────────────────────────────────────────────
--
-- Same engine, resolved from the phone binding. The webhook learns a lesson and
-- a result; it never learns a user id, an email or a name.

CREATE OR REPLACE FUNCTION public.ivx_wa_user(_wa_phone text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.whatsapp_identities
   WHERE wa_phone = _wa_phone AND user_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.ivx_wa_next_question(
  _wa_phone text,
  _subject  text DEFAULT NULL,
  _skill    text DEFAULT NULL,
  _language text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := public.ivx_wa_user(_wa_phone);
  _pick    text;
BEGIN
  -- Not linked is a different answer from nothing available: one is fixed by
  -- linking an account, the other by choosing another subject.
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_linked');
  END IF;

  IF _skill IS NOT NULL AND public.ivx_skill_unlocked(_user_id, _skill) THEN
    _pick := _skill;
  ELSE
    _pick := public.ivx_pick_skill(_user_id, _subject);
  END IF;

  IF _pick IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_available');
  END IF;

  RETURN public.ivx_deal_question(_user_id, _pick, _language, 'whatsapp');
END;
$$;

CREATE OR REPLACE FUNCTION public.ivx_wa_submit_answer(
  _wa_phone text,
  _given    text,
  _hints    integer DEFAULT 0,
  _language text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := public.ivx_wa_user(_wa_phone);
  _open    uuid;
  _result  jsonb;
  _xp      integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_linked');
  END IF;

  -- The open question comes from the session rather than from the message:
  -- a sender types "3/4", not a question id, and there is nothing in a
  -- WhatsApp reply that could identify which question it answers.
  SELECT open_question INTO _open
    FROM public.ivx_sessions WHERE user_id = _user_id AND channel = 'whatsapp';

  IF _open IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_open_question');
  END IF;

  _result := public.ivx_grade(_user_id, _open, _given, _hints, NULL, _language, 'whatsapp');

  -- `award_academy_xp` reads auth.uid(), which is null on this path, so the
  -- ledger is written directly with the same three effects. Same tables, same
  -- totals: a question answered on WhatsApp and one answered on the site are
  -- the same XP in the same streak.
  IF (_result ->> 'ok')::boolean THEN
    _xp := (_result ->> 'xp')::integer;
    INSERT INTO public.academy_xp_events(user_id, amount, reason) VALUES (_user_id, _xp, 'ivx_practice');
    INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _xp, 'ivx_practice');
    UPDATE public.academy_profiles
       SET xp_total = xp_total + _xp, last_active = now()
     WHERE user_id = _user_id;
  END IF;

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ivx_wa_hint(_wa_phone text, _language text DEFAULT 'en')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := public.ivx_wa_user(_wa_phone);
  _open    uuid;
  _hint    text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_linked');
  END IF;

  SELECT open_question INTO _open
    FROM public.ivx_sessions WHERE user_id = _user_id AND channel = 'whatsapp';
  IF _open IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_open_question');
  END IF;

  SELECT public.ivx_text(hint, _language) INTO _hint
    FROM public.ivx_questions WHERE id = _open;

  IF _hint IS NULL OR _hint = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_hint');
  END IF;
  RETURN jsonb_build_object('ok', true, 'hint', _hint);
END;
$$;

/**
 * Is a question open on WhatsApp, and what were its options?
 *
 * The webhook needs both before it can read an incoming message: whether the
 * message is an answer at all, and — when the question had options — what "b"
 * refers to. Cheap enough to ask on every delivery, and it returns no prompt,
 * no answer and no identity.
 */
CREATE OR REPLACE FUNCTION public.ivx_wa_open(_wa_phone text, _language text DEFAULT 'en')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := public.ivx_wa_user(_wa_phone);
  _open    uuid;
  _options jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('open', false);
  END IF;

  SELECT open_question INTO _open
    FROM public.ivx_sessions WHERE user_id = _user_id AND channel = 'whatsapp';

  IF _open IS NULL THEN
    RETURN jsonb_build_object('open', false);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', opt ->> 'id') ORDER BY ord), '[]')
    INTO _options
    FROM public.ivx_questions q,
         LATERAL jsonb_array_elements(q.options) WITH ORDINALITY AS t(opt, ord)
   WHERE q.id = _open;

  RETURN jsonb_build_object('open', true, 'options', COALESCE(_options, '[]'));
END;
$$;

/** The one-line "where am I" a WhatsApp learner hears before they start. */
CREATE OR REPLACE FUNCTION public.ivx_wa_progress(_wa_phone text, _language text DEFAULT 'en')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := public.ivx_wa_user(_wa_phone);
  _next    text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_linked');
  END IF;

  _next := public.ivx_pick_skill(_user_id, NULL);

  RETURN jsonb_build_object(
    'ok', true,
    'xp', COALESCE((SELECT xp_total FROM public.academy_profiles WHERE user_id = _user_id), 0),
    'mastered', (SELECT count(*) FROM public.ivx_mastery WHERE user_id = _user_id AND state = 'mastered'),
    'in_progress', (SELECT count(*) FROM public.ivx_mastery
                     WHERE user_id = _user_id AND state NOT IN ('mastered','not_started')),
    'recommended', CASE WHEN _next IS NULL THEN NULL ELSE jsonb_build_object(
      'skill', _next,
      'title', (SELECT public.ivx_text(title, _language) FROM public.ivx_skills WHERE slug = _next)
    ) END
  );
END;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
--
-- The website's functions are for a signed-in person. The WhatsApp variants
-- take a phone number as an argument, so they are service-role only: exposing
-- them to `anon` would let anybody practise as anybody by typing a number.

DO $$
DECLARE
  _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'public.ivx_next_question(text, text, text)',
    'public.ivx_submit_answer(uuid, text, integer, integer, text)',
    'public.ivx_hint(uuid, text)',
    'public.ivx_progress(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _fn);
  END LOOP;

  FOREACH _fn IN ARRAY ARRAY[
    'public.ivx_wa_user(text)',
    'public.ivx_wa_next_question(text, text, text, text)',
    'public.ivx_wa_submit_answer(text, text, integer, text)',
    'public.ivx_wa_hint(text, text)',
    'public.ivx_wa_progress(text, text)',
    'public.ivx_wa_open(text, text)',
    'public.ivx_deal_question(uuid, text, text, text)',
    'public.ivx_grade(uuid, uuid, text, integer, integer, text, text)',
    'public.ivx_apply_attempt(uuid, uuid, boolean, integer, integer)',
    'public.ivx_pick_skill(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _fn);
  END LOOP;
END $$;
