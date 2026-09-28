-- Security fix: the two IVX rewards that credit VX outside the daily allowance.
--
-- ── The defect ──────────────────────────────────────────────────────────────
--
-- 20261043 put every self-award behind one per-user, per-UTC-day allowance of
-- 2,000 VX (vx_self_award_take). Two IVX paths were not among them, because
-- they do not call award_academy_xp — auth.uid() is null where they run, so
-- each writes the academy ledger inline:
--
--   ivx_wa_submit_answer  a question answered on WhatsApp: up to 25 VX per
--                         answer, as many answers a day as the sender types.
--   ivx_project_grade     a graded project: its xp_award, once per project.
--
-- The website path for the same answer (ivx_submit_answer → award_academy_xp)
-- has drawn from the allowance since 20261043. The WhatsApp path has not, so a
-- linked number could practise VX into an account without bound.
--
-- ── The fix ─────────────────────────────────────────────────────────────────
--
-- Both draw from vx_self_award_take before the three ledger writes, exactly as
-- award_academy_xp does: trimmed, never raised, and to zero if need be — the
-- answer is still graded and the student can keep practising; only the reward
-- stops. All three writes use the trimmed amount, so XP, the leaderboard and
-- the balance stay one figure, as they are on the website.
--
-- ivx_project_grade records what was actually credited in xp_awarded, so a
-- regrade on another day tops up to the project's award rather than treating
-- a trimmed award as paid in full.
--
-- Everything else in both bodies is the current production definition
-- verbatim (20261005020000, 20261006020000). Signatures are unchanged, so the
-- existing grants stand. No balance is touched.

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
  -- totals, and since 20261059 the same daily allowance: a question answered
  -- on WhatsApp and one answered on the site are the same XP in the same streak.
  IF (_result ->> 'ok')::boolean THEN
    _xp := public.vx_self_award_take(_user_id, (_result ->> 'xp')::integer);
    IF _xp > 0 THEN
      INSERT INTO public.academy_xp_events(user_id, amount, reason) VALUES (_user_id, _xp, 'ivx_practice');
      INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _xp, 'ivx_practice');
      UPDATE public.academy_profiles
         SET xp_total = xp_total + _xp, last_active = now()
       WHERE user_id = _user_id;
    END IF;
  END IF;

  RETURN _result;
END;
$$;

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

  -- Draw from the daily allowance (20261043), trimmed and never raised, before
  -- anything is recorded — so xp_awarded is what was actually credited.
  _award := public.vx_self_award_take(_user_id, _award);

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
