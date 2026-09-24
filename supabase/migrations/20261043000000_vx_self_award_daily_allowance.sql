-- Security fix: bound what a signed-in user can award themselves in VX.
--
-- ── The defect ──────────────────────────────────────────────────────────────
--
-- `user_points` is the only VX balance (1,000 VX = US$1), and VX buys Service
-- Center packages, library books, TV and radio plans and kids products. Five
-- SECURITY DEFINER functions credit it and are EXECUTE-able by `authenticated`,
-- because the browser calls them when a lesson, quiz, simulation or story is
-- finished:
--
--   award_academy_xp   no amount ceiling at all — one call could mint any sum
--   award_points       up to 1,200 per call (vehicle-diagnostics:repair:%)
--   award_library_xp   up to 300 per call   (Challenge completed:%)
--   award_kids_xp      up to 150 per call
--   award_kids_coins   up to 75 per call
--
-- None limits how often it may be called, and the reason suffix is free text,
-- so a loop of calls from the browser console minted without bound. Verified on
-- production 2026-09-25: an anonymous call to each reaches its body and stops
-- only at the sign-in check.
--
-- ── The fix ─────────────────────────────────────────────────────────────────
--
-- 1. One per-user, per-UTC-day allowance shared by all five, held in a
--    service-only table and drawn atomically. Over the ceiling an award is
--    trimmed — to zero if need be — never raised: ivx_submit_answer calls
--    award_academy_xp inside the answer's own transaction, and an exception
--    there would stop a student practising rather than just stop the reward.
-- 2. award_academy_xp gets what the others already had: a reason whitelist and
--    a per-reason ceiling, taken from ACADEMY_XP_RATES in
--    src/services/academy/academyService.ts plus IVX practice.
--
-- The per-call ceilings and reason lists of the other four are unchanged.
-- Debits (award_points with Redeemed / Pay with points / VX Purchase) never
-- touch the allowance. Nothing here touches existing balances.

-- ── 1. The allowance ledger ────────────────────────────────────────────────
--
-- RLS on and no policy, deliberately: this is service-only bookkeeping. Do not
-- add a policy "to make it work" — the award functions reach it as definer.
CREATE TABLE IF NOT EXISTS public.vx_self_award_daily (
  user_id  uuid    NOT NULL,
  day      date    NOT NULL,
  awarded  integer NOT NULL DEFAULT 0 CHECK (awarded >= 0),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.vx_self_award_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vx_self_award_daily FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.vx_self_award_daily TO service_role;

COMMENT ON TABLE public.vx_self_award_daily IS
  'VX a user has awarded themselves through the browser-callable award_* RPCs, per UTC day. Service-only; RLS on with no policy by design.';

-- ── 2. Drawing from it ──────────────────────────────────────────────────────
--
-- Returns how much of _amount may be credited now: all of it, part of it, or
-- zero. The row lock serialises concurrent awards for one user, so parallel
-- calls cannot each see the same remaining allowance.
CREATE OR REPLACE FUNCTION public.vx_self_award_take(_user_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- 2,000 VX (US$2) a day covers a heavy genuine day: a finished simulation
  -- pays at most 1,200, a finished course 150, a certificate 200.
  _cap   constant integer := 2000;
  _day   date := (now() AT TIME ZONE 'utc')::date;
  _used  integer;
  _grant integer;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.vx_self_award_daily (user_id, day, awarded)
  VALUES (_user_id, _day, 0)
  ON CONFLICT (user_id, day) DO NOTHING;

  SELECT d.awarded INTO _used
    FROM public.vx_self_award_daily d
   WHERE d.user_id = _user_id AND d.day = _day
     FOR UPDATE;

  _grant := LEAST(_amount, GREATEST(0, _cap - _used));

  IF _grant > 0 THEN
    UPDATE public.vx_self_award_daily
       SET awarded = awarded + _grant
     WHERE user_id = _user_id AND day = _day;
  END IF;

  RETURN _grant;
END;
$$;

-- Only the award functions (SECURITY DEFINER, so they run as owner) call this.
-- Named per role: Supabase grants EXECUTE to anon and authenticated directly,
-- and REVOKE … FROM PUBLIC alone would leave both able to call it.
REVOKE ALL ON FUNCTION public.vx_self_award_take(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_self_award_take(uuid, integer) TO service_role;

-- ── 3. award_academy_xp: reason whitelist, per-reason ceiling, allowance ──
CREATE OR REPLACE FUNCTION public.award_academy_xp(
  _amount INTEGER,
  _reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- ACADEMY_XP_RATES (academyService.ts), exactly; plus IVX practice, whose
  -- per-answer XP is 5 + difficulty * 2 (ivx_grade).
  _max_amount := CASE _reason
    WHEN 'academy_message_sent'           THEN 5
    WHEN 'academy_aptitude_completed'     THEN 50
    WHEN 'academy_streak'                 THEN 20
    WHEN 'academy_scan_used'              THEN 10
    WHEN 'academy_study_room'             THEN 15
    WHEN 'academy_daily_login'            THEN 10
    WHEN 'academy_lesson_completed'       THEN 10
    WHEN 'academy_module_completed'       THEN 40
    WHEN 'academy_course_completed'       THEN 150
    WHEN 'academy_quiz_passed'            THEN 25
    WHEN 'academy_perfect_quiz'           THEN 50
    WHEN 'academy_final_exam_passed'      THEN 100
    WHEN 'academy_certificate_earned'     THEN 200
    WHEN 'academy_project_completed'      THEN 80
    WHEN 'academy_weekly_goal'            THEN 60
    WHEN 'academy_monthly_goal'           THEN 250
    WHEN 'academy_streak_milestone'       THEN 30
    WHEN 'academy_community_contribution' THEN 15
    WHEN 'academy_instructor_recognition' THEN 100
    WHEN 'ivx_practice'                   THEN 25
    ELSE NULL
  END;

  IF _max_amount IS NULL THEN
    RAISE EXCEPTION 'Invalid reason: %', _reason;
  END IF;
  IF _amount > _max_amount THEN
    RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason;
  END IF;

  -- Draw from the per-user daily allowance. Trimmed, never raised (see header).
  _amount := public.vx_self_award_take(_user_id, _amount);
  IF _amount <= 0 THEN RETURN; END IF;

  -- The same three writes as before, so an answer and a lesson still feed one
  -- ledger, one total and one leaderboard.
  INSERT INTO public.academy_xp_events(user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);

  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);

  UPDATE public.academy_profiles
  SET xp_total = xp_total + _amount,
      last_active = now()
  WHERE user_id = _user_id;
END;
$$;


-- ── 4. The other self-award functions: unchanged bodies plus the allowance ──
-- Each body below is the current production definition verbatim; the only
-- change is the allowance draw placed before the first INSERT.

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
    WHEN _reason LIKE 'Book completed:%'        THEN _max_amount := 100;
    WHEN _reason LIKE 'Review written:%'        THEN _max_amount := 25;
    WHEN _reason LIKE 'Reading streak:%'        THEN _max_amount := 50;
    WHEN _reason LIKE 'Challenge completed:%'   THEN _max_amount := 300;
    WHEN _reason LIKE 'Daily reading goal:%'    THEN _max_amount := 20;
    WHEN _reason LIKE 'Club created:%'          THEN _max_amount := 20;
    WHEN _reason LIKE 'Event attended:%'        THEN _max_amount := 30;
    WHEN _reason LIKE 'Course completed:%'      THEN _max_amount := 150;
    WHEN _reason LIKE 'Quiz passed:%'           THEN _max_amount := 40;
    WHEN _reason LIKE 'Flashcard review:%'      THEN _max_amount := 10;
    WHEN _reason LIKE 'Certificate earned:%'    THEN _max_amount := 50;
    WHEN _reason LIKE 'Learning path completed:%' THEN _max_amount := 200;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN
    RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason;
  END IF;

  -- Draw from the per-user daily allowance (20261043000000). Trimmed, never
  -- raised: a caller that is over the ceiling simply earns nothing more today.
  _amount := public.vx_self_award_take(_user_id, _amount);
  IF _amount <= 0 THEN RETURN; END IF;


  INSERT INTO public.library_xp_events(user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);

  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_kids_xp(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  CASE
    WHEN _reason LIKE 'Story completed:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'Quiz completed:%'        THEN _max_amount := 30;
    WHEN _reason LIKE 'Reading streak:%'        THEN _max_amount := 50;
    WHEN _reason LIKE 'AI story created:%'      THEN _max_amount := 20;
    WHEN _reason LIKE 'Game completed:%'        THEN _max_amount := 40;
    WHEN _reason LIKE 'Perfect score:%'         THEN _max_amount := 25;
    WHEN _reason LIKE 'Daily challenge:%'       THEN _max_amount := 30;
    WHEN _reason LIKE 'Weekly challenge:%'      THEN _max_amount := 100;
    WHEN _reason LIKE 'Achievement unlocked:%'  THEN _max_amount := 30;
    WHEN _reason LIKE 'Daily login:%'           THEN _max_amount := 15;
    WHEN _reason LIKE 'Lesson completed:%'      THEN _max_amount := 25;
    WHEN _reason LIKE 'Course completed:%'      THEN _max_amount := 150;
    WHEN _reason LIKE 'Homework submitted:%'    THEN _max_amount := 20;
    WHEN _reason LIKE 'Project submitted:%'     THEN _max_amount := 50;
    WHEN _reason LIKE 'Exam passed:%'           THEN _max_amount := 80;
    WHEN _reason LIKE 'Creative project saved:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'Creative challenge submitted:%' THEN _max_amount := 40;
    WHEN _reason LIKE 'World explored:%'        THEN _max_amount := 20;
    WHEN _reason LIKE 'Location quiz completed:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'Simulator milestone:%'   THEN _max_amount := 30;
    WHEN _reason LIKE 'Explorer certificate:%'  THEN _max_amount := 100;
    WHEN _reason LIKE 'Friend added:%'          THEN _max_amount := 10;
    WHEN _reason LIKE 'Club joined:%'           THEN _max_amount := 15;
    WHEN _reason LIKE 'Group quiz completed:%'  THEN _max_amount := 25;
    WHEN _reason LIKE 'Group assignment submitted:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'Social challenge won:%'  THEN _max_amount := 80;
    WHEN _reason LIKE 'Social challenge joined:%' THEN _max_amount := 10;
    WHEN _reason LIKE 'Event registered:%'      THEN _max_amount := 10;
    WHEN _reason LIKE 'Event attended:%'        THEN _max_amount := 40;
    WHEN _reason LIKE 'Workshop completed:%'    THEN _max_amount := 35;
    WHEN _reason LIKE 'Competition entered:%'   THEN _max_amount := 30;
    WHEN _reason LIKE 'Competition won:%'       THEN _max_amount := 100;
    WHEN _reason LIKE 'City visited:%'          THEN _max_amount := 15;
    WHEN _reason LIKE 'Event certificate:%'     THEN _max_amount := 60;
    WHEN _reason LIKE 'Talent assessment:%'     THEN _max_amount := 30;
    WHEN _reason LIKE 'Skill mastered:%'        THEN _max_amount := 60;
    WHEN _reason LIKE 'Module completed:%'      THEN _max_amount := 60;
    WHEN _reason LIKE 'Track completed:%'       THEN _max_amount := 150;
    WHEN _reason LIKE 'Innovation challenge:%'  THEN _max_amount := 60;
    WHEN _reason LIKE 'Talent certificate:%'    THEN _max_amount := 100;
    -- Phase 10 — Health & Wellness
    WHEN _reason LIKE 'Habit completed:%'       THEN _max_amount := 20;
    WHEN _reason LIKE 'Routine completed:%'     THEN _max_amount := 20;
    WHEN _reason LIKE 'Mood logged:%'           THEN _max_amount := 15;
    WHEN _reason LIKE 'Sleep logged:%'          THEN _max_amount := 15;
    WHEN _reason LIKE 'Mindfulness session:%'   THEN _max_amount := 20;
    WHEN _reason LIKE 'Exercise session:%'      THEN _max_amount := 20;
    WHEN _reason LIKE 'Healthy challenge:%'     THEN _max_amount := 40;
    WHEN _reason LIKE 'Healthy streak:%'        THEN _max_amount := 60;
    -- Phase 11 — STEM & Innovation Center
    WHEN _reason LIKE 'Experiment completed:%'  THEN _max_amount := 60;
    WHEN _reason LIKE 'Experiment quiz:%'       THEN _max_amount := 30;
    WHEN _reason LIKE 'Invention saved:%'       THEN _max_amount := 20;
    WHEN _reason LIKE 'Robot programmed:%'      THEN _max_amount := 30;
    WHEN _reason LIKE 'Design created:%'        THEN _max_amount := 20;
    WHEN _reason LIKE 'Innovation submitted:%'  THEN _max_amount := 60;
    WHEN _reason LIKE 'Research read:%'         THEN _max_amount := 15;
    WHEN _reason LIKE 'STEM streak:%'           THEN _max_amount := 60;
    -- Phase 12 — VisionKids World
    WHEN _reason LIKE 'World quest:%'           THEN _max_amount := 60;
    WHEN _reason LIKE 'Region visited:%'        THEN _max_amount := 15;
    WHEN _reason LIKE 'Transport unlocked:%'    THEN _max_amount := 20;
    WHEN _reason LIKE 'Home decorated:%'        THEN _max_amount := 15;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  -- Draw from the per-user daily allowance (20261043000000). Trimmed, never
  -- raised: a caller that is over the ceiling simply earns nothing more today.
  _amount := public.vx_self_award_take(_user_id, _amount);
  IF _amount <= 0 THEN RETURN; END IF;


  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
  INSERT INTO public.kids_xp_events(user_id, amount, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_kids_coins(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  CASE
    WHEN _reason LIKE 'Game completed:%'      THEN _max_amount := 20;
    WHEN _reason LIKE 'Daily challenge:%'     THEN _max_amount := 15;
    WHEN _reason LIKE 'Weekly challenge:%'    THEN _max_amount := 50;
    WHEN _reason LIKE 'Daily login:%'         THEN _max_amount := 10;
    WHEN _reason LIKE 'Lesson completed:%'    THEN _max_amount := 15;
    WHEN _reason LIKE 'Course completed:%'    THEN _max_amount := 75;
    WHEN _reason LIKE 'Homework submitted:%'  THEN _max_amount := 10;
    WHEN _reason LIKE 'Project submitted:%'   THEN _max_amount := 25;
    WHEN _reason LIKE 'Exam passed:%'         THEN _max_amount := 40;
    WHEN _reason LIKE 'Creative project saved:%' THEN _max_amount := 10;
    WHEN _reason LIKE 'Creative challenge submitted:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'World explored:%'       THEN _max_amount := 10;
    WHEN _reason LIKE 'Location quiz completed:%' THEN _max_amount := 10;
    WHEN _reason LIKE 'Simulator milestone:%'  THEN _max_amount := 15;
    WHEN _reason LIKE 'Explorer certificate:%' THEN _max_amount := 60;
    WHEN _reason LIKE 'Friend added:%'         THEN _max_amount := 5;
    WHEN _reason LIKE 'Club joined:%'          THEN _max_amount := 10;
    WHEN _reason LIKE 'Group quiz completed:%' THEN _max_amount := 15;
    WHEN _reason LIKE 'Group assignment submitted:%' THEN _max_amount := 10;
    WHEN _reason LIKE 'Social challenge won:%' THEN _max_amount := 40;
    WHEN _reason LIKE 'Social challenge joined:%' THEN _max_amount := 5;
    WHEN _reason LIKE 'Event registered:%'     THEN _max_amount := 5;
    WHEN _reason LIKE 'Event attended:%'       THEN _max_amount := 20;
    WHEN _reason LIKE 'Workshop completed:%'   THEN _max_amount := 18;
    WHEN _reason LIKE 'Competition entered:%'  THEN _max_amount := 15;
    WHEN _reason LIKE 'Competition won:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'City visited:%'         THEN _max_amount := 8;
    WHEN _reason LIKE 'Event certificate:%'    THEN _max_amount := 30;
    WHEN _reason LIKE 'Talent assessment:%'    THEN _max_amount := 15;
    WHEN _reason LIKE 'Skill mastered:%'       THEN _max_amount := 30;
    WHEN _reason LIKE 'Module completed:%'     THEN _max_amount := 30;
    WHEN _reason LIKE 'Track completed:%'      THEN _max_amount := 75;
    WHEN _reason LIKE 'Innovation challenge:%' THEN _max_amount := 30;
    WHEN _reason LIKE 'Talent certificate:%'   THEN _max_amount := 60;
    -- Phase 10 — Health & Wellness
    WHEN _reason LIKE 'Habit completed:%'      THEN _max_amount := 10;
    WHEN _reason LIKE 'Routine completed:%'    THEN _max_amount := 10;
    WHEN _reason LIKE 'Mood logged:%'          THEN _max_amount := 8;
    WHEN _reason LIKE 'Sleep logged:%'         THEN _max_amount := 8;
    WHEN _reason LIKE 'Mindfulness session:%'  THEN _max_amount := 10;
    WHEN _reason LIKE 'Exercise session:%'     THEN _max_amount := 10;
    WHEN _reason LIKE 'Healthy challenge:%'    THEN _max_amount := 20;
    WHEN _reason LIKE 'Healthy streak:%'       THEN _max_amount := 30;
    -- Phase 11 — STEM & Innovation Center
    WHEN _reason LIKE 'Experiment completed:%' THEN _max_amount := 30;
    WHEN _reason LIKE 'Experiment quiz:%'      THEN _max_amount := 15;
    WHEN _reason LIKE 'Invention saved:%'      THEN _max_amount := 10;
    WHEN _reason LIKE 'Robot programmed:%'     THEN _max_amount := 15;
    WHEN _reason LIKE 'Design created:%'       THEN _max_amount := 10;
    WHEN _reason LIKE 'Innovation submitted:%' THEN _max_amount := 30;
    WHEN _reason LIKE 'Research read:%'        THEN _max_amount := 8;
    WHEN _reason LIKE 'STEM streak:%'          THEN _max_amount := 30;
    -- Phase 12 — VisionKids World
    WHEN _reason LIKE 'World quest:%'          THEN _max_amount := 40;
    WHEN _reason LIKE 'Region visited:%'       THEN _max_amount := 10;
    WHEN _reason LIKE 'Home decorated:%'       THEN _max_amount := 8;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  -- Draw from the per-user daily allowance (20261043000000). Trimmed, never
  -- raised: a caller that is over the ceiling simply earns nothing more today.
  _amount := public.vx_self_award_take(_user_id, _amount);
  IF _amount <= 0 THEN RETURN; END IF;


  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

create or replace function public.award_points(_points integer,_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare max_points integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  case
    when _reason='Daily login bonus' then max_points:=10;
    when _reason='Watched an ad' then max_points:=5;
    when _reason like 'Completed simulation%' then max_points:=500;
    when _reason like 'Incubator Simulation%' then max_points:=500;
    when _reason like 'Network NOC%' then max_points:=500;
    when _reason like 'Maritime decision:%' then max_points:=500;
    when _reason='Maritime simulator completion bonus' then max_points:=1000;
    when _reason like 'vehicle-diagnostics:repair:%' then max_points:=1200;
    when _reason like 'voice_room_participation%' then max_points:=20;
    when _reason like 'Engaged:%' then max_points:=50;
    when _reason='Signup bonus' then max_points:=50;
    when _reason like 'Purchase:%' then max_points:=1000;
    when _reason like 'Redeemed%' or _reason like 'Pay with points%' or _reason like 'VX Purchase:%' then max_points:=0;
    else raise exception 'Invalid reason';
  end case;
  if _points<0 and not (_reason like 'Redeemed%' or _reason like 'Pay with points%' or _reason like 'VX Purchase:%') then raise exception 'Negative points not allowed'; end if;
  if _points>max_points then raise exception 'Points exceed maximum'; end if;
  if _reason='Daily login bonus' and exists(select 1 from public.user_points where user_id=auth.uid() and reason=_reason and created_at>=current_date::timestamptz and created_at<(current_date+1)::timestamptz) then raise exception 'Already claimed'; end if;
  -- Credits draw from the per-user daily allowance (20261043000000); debits
  -- (the Redeemed/Pay with points/VX Purchase reasons) never touch it.
  if _points > 0 then
    _points := public.vx_self_award_take(auth.uid(), _points);
    if _points <= 0 then return; end if;
  end if;
  insert into public.user_points(user_id,points,reason) values(auth.uid(),_points,_reason);
end $$;
-- CREATE OR REPLACE keeps each function's existing grants; nothing is widened.
-- Anonymous callers still reach the bodies and are refused at the sign-in check.
