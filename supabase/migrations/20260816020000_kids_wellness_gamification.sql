-- ============================================================
-- Migration: VisionKids Wellness (Phase 10) — gamification, streaks, badges.
--
-- Reused, not redefined: award_kids_xp / award_kids_coins (CREATE OR
-- REPLACEd with every prior branch preserved verbatim + wellness reasons),
-- kids_achievements / award_kids_achievement (Stories). All reward writes go
-- through the SECURITY DEFINER RPCs below so caps/streaks/once-only grants
-- can't be forged. Amounts are always computed server-side from catalog
-- columns (bounded by their CHECK constraints) or fixed constants.
-- ============================================================

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
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

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
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

-- ============================================================
-- kids_habit_streak — current run of consecutive days (ending today, or
-- yesterday if today isn't logged yet) with at least one habit/routine log.
-- ============================================================
CREATE OR REPLACE FUNCTION public.kids_habit_streak(_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _streak INTEGER := 0;
  _day DATE := CURRENT_DATE;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;
  -- Don't break the streak just because today isn't logged yet.
  IF NOT EXISTS (SELECT 1 FROM public.kids_habit_logs WHERE user_id = _user_id AND log_date = _day) THEN
    _day := _day - 1;
  END IF;
  WHILE EXISTS (SELECT 1 FROM public.kids_habit_logs WHERE user_id = _user_id AND log_date = _day) LOOP
    _streak := _streak + 1;
    _day := _day - 1;
  END LOOP;
  RETURN _streak;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kids_habit_streak(UUID) TO authenticated;

-- ============================================================
-- log_kids_habit — tick a habit/routine step for a day. Idempotent per
-- (habit, day). On a fresh tick it awards the catalog reward and, when the
-- streak crosses 3 / 7, the matching achievement + a streak bonus.
-- Returns { newly_logged, streak }.
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_kids_habit(_habit_slug TEXT, _date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _habit public.kids_wellness_habits%ROWTYPE;
  _newly BOOLEAN := FALSE;
  _streak INTEGER := 0;
  _first_ever BOOLEAN := FALSE;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _date > CURRENT_DATE OR _date < CURRENT_DATE - 7 THEN RAISE EXCEPTION 'Invalid date'; END IF;

  SELECT * INTO _habit FROM public.kids_wellness_habits WHERE slug = _habit_slug AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Habit not found'; END IF;

  SELECT NOT EXISTS (SELECT 1 FROM public.kids_habit_logs WHERE user_id = _user_id) INTO _first_ever;

  INSERT INTO public.kids_habit_logs (user_id, habit_slug, log_date)
  VALUES (_user_id, _habit_slug, _date)
  ON CONFLICT (user_id, habit_slug, log_date) DO NOTHING;
  _newly := FOUND;

  IF _newly THEN
    IF _habit.kind = 'routine' THEN
      PERFORM public.award_kids_xp(_habit.reward_xp, 'Routine completed: ' || _habit_slug);
      PERFORM public.award_kids_coins(_habit.reward_coins, 'Routine completed: ' || _habit_slug);
    ELSE
      PERFORM public.award_kids_xp(_habit.reward_xp, 'Habit completed: ' || _habit_slug);
      PERFORM public.award_kids_coins(_habit.reward_coins, 'Habit completed: ' || _habit_slug);
    END IF;

    IF _first_ever THEN
      PERFORM public.award_kids_achievement('healthy_start');
    END IF;
  END IF;

  _streak := public.kids_habit_streak(_user_id);

  IF _newly AND _streak = 3 THEN
    PERFORM public.award_kids_xp(30, 'Healthy streak: 3 days');
    PERFORM public.award_kids_coins(15, 'Healthy streak: 3 days');
    PERFORM public.award_kids_achievement('healthy_roll');
  ELSIF _newly AND _streak = 7 THEN
    PERFORM public.award_kids_xp(60, 'Healthy streak: 7 days');
    PERFORM public.award_kids_coins(30, 'Healthy streak: 7 days');
    PERFORM public.award_kids_achievement('healthy_week');
  END IF;

  RETURN jsonb_build_object('newly_logged', _newly, 'streak', _streak);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_kids_habit(TEXT, DATE) TO authenticated;

-- ============================================================
-- log_kids_mood — save today's mood (upsert). Rewards once per day (the
-- first time a mood is set for that date). Returns TRUE if this was today's
-- first entry.
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_kids_mood(_mood TEXT, _color TEXT DEFAULT NULL, _note TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _first_today BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT NOT EXISTS (SELECT 1 FROM public.kids_mood_logs WHERE user_id = _user_id AND log_date = CURRENT_DATE)
    INTO _first_today;

  INSERT INTO public.kids_mood_logs (user_id, log_date, mood, color, note)
  VALUES (_user_id, CURRENT_DATE, _mood, _color, NULLIF(btrim(_note), ''))
  ON CONFLICT (user_id, log_date) DO UPDATE
    SET mood = EXCLUDED.mood, color = EXCLUDED.color, note = EXCLUDED.note, updated_at = now();

  IF _first_today THEN
    PERFORM public.award_kids_xp(10, 'Mood logged: ' || CURRENT_DATE::text);
    PERFORM public.award_kids_coins(5, 'Mood logged: ' || CURRENT_DATE::text);
    PERFORM public.award_kids_achievement('mood_check_in');
  END IF;

  RETURN _first_today;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_kids_mood(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- log_kids_sleep — save last night's sleep (upsert). Rewards once per day.
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_kids_sleep(_bedtime TEXT, _wake_time TEXT, _duration_minutes INTEGER, _quality TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _first_today BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT NOT EXISTS (SELECT 1 FROM public.kids_sleep_logs WHERE user_id = _user_id AND log_date = CURRENT_DATE)
    INTO _first_today;

  INSERT INTO public.kids_sleep_logs (user_id, log_date, bedtime, wake_time, duration_minutes, quality)
  VALUES (_user_id, CURRENT_DATE, _bedtime, _wake_time, _duration_minutes, _quality)
  ON CONFLICT (user_id, log_date) DO UPDATE
    SET bedtime = EXCLUDED.bedtime, wake_time = EXCLUDED.wake_time,
        duration_minutes = EXCLUDED.duration_minutes, quality = EXCLUDED.quality, updated_at = now();

  IF _first_today THEN
    PERFORM public.award_kids_xp(10, 'Sleep logged: ' || CURRENT_DATE::text);
    PERFORM public.award_kids_coins(5, 'Sleep logged: ' || CURRENT_DATE::text);
  END IF;

  RETURN _first_today;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_kids_sleep(TEXT, TEXT, INTEGER, TEXT) TO authenticated;

-- ============================================================
-- log_kids_wellness_session — record a finished exercise/mindfulness session.
-- Rewards once per (kind, lesson) per day to keep it encouraging, not
-- farmable. Awards the matching achievement the first time.
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_kids_wellness_session(_kind TEXT, _ref_slug TEXT, _minutes INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _already_today BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _kind NOT IN ('exercise', 'mindfulness') THEN RAISE EXCEPTION 'Invalid session kind'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.kids_wellness_sessions
    WHERE user_id = _user_id AND kind = _kind AND ref_slug = _ref_slug AND logged_at::date = CURRENT_DATE
  ) INTO _already_today;

  INSERT INTO public.kids_wellness_sessions (user_id, kind, ref_slug, minutes)
  VALUES (_user_id, _kind, _ref_slug, GREATEST(0, LEAST(240, COALESCE(_minutes, 1))));

  IF NOT _already_today THEN
    IF _kind = 'mindfulness' THEN
      PERFORM public.award_kids_xp(15, 'Mindfulness session: ' || _ref_slug);
      PERFORM public.award_kids_coins(8, 'Mindfulness session: ' || _ref_slug);
      PERFORM public.award_kids_achievement('mindful_kid');
    ELSE
      PERFORM public.award_kids_xp(15, 'Exercise session: ' || _ref_slug);
      PERFORM public.award_kids_coins(8, 'Exercise session: ' || _ref_slug);
      PERFORM public.award_kids_achievement('active_kid');
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_kids_wellness_session(TEXT, TEXT, INTEGER) TO authenticated;

-- ============================================================
-- complete_kids_healthy_challenge — mark a challenge complete for its current
-- period window. Idempotent; rewards once per window. Returns TRUE on a fresh
-- completion.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_kids_healthy_challenge(_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _challenge public.kids_healthy_challenges%ROWTYPE;
  _period_start DATE;
  _was_completed BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT * INTO _challenge FROM public.kids_healthy_challenges WHERE id = _challenge_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;

  _period_start := CASE WHEN _challenge.period = 'weekly' THEN date_trunc('week', CURRENT_DATE)::date ELSE CURRENT_DATE END;

  SELECT completed INTO _was_completed
  FROM public.kids_healthy_challenge_progress
  WHERE user_id = _user_id AND challenge_id = _challenge_id AND period_start = _period_start;

  INSERT INTO public.kids_healthy_challenge_progress (user_id, challenge_id, period_start, progress, completed)
  VALUES (_user_id, _challenge_id, _period_start, _challenge.target_value, TRUE)
  ON CONFLICT (user_id, challenge_id, period_start) DO UPDATE
    SET progress = _challenge.target_value, completed = TRUE, updated_at = now();

  IF COALESCE(_was_completed, FALSE) THEN RETURN FALSE; END IF;

  PERFORM public.award_kids_xp(_challenge.reward_xp, 'Healthy challenge: ' || _challenge.slug);
  PERFORM public.award_kids_coins(_challenge.reward_coins, 'Healthy challenge: ' || _challenge.slug);
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_kids_healthy_challenge(UUID) TO authenticated;

-- ============================================================
-- get_kids_wellness_stats — one round-trip for the Health Home dashboard:
-- the caller's habit streak + today's counts + a derived wellness rank slug.
-- Reads only the caller's own rows.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kids_wellness_stats()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _streak INTEGER := 0;
  _habits_today INTEGER := 0;
  _mood_today BOOLEAN := FALSE;
  _sleep_today BOOLEAN := FALSE;
  _sessions INTEGER := 0;
  _challenges INTEGER := 0;
  _score INTEGER;
  _rank TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('streak',0,'habits_today',0,'mood_today',false,'sleep_today',false,
      'sessions',0,'challenges_completed',0,'wellness_rank','sprout');
  END IF;

  _streak := public.kids_habit_streak(_user_id);
  SELECT count(*) INTO _habits_today FROM public.kids_habit_logs WHERE user_id = _user_id AND log_date = CURRENT_DATE;
  SELECT EXISTS(SELECT 1 FROM public.kids_mood_logs WHERE user_id = _user_id AND log_date = CURRENT_DATE) INTO _mood_today;
  SELECT EXISTS(SELECT 1 FROM public.kids_sleep_logs WHERE user_id = _user_id AND log_date = CURRENT_DATE) INTO _sleep_today;
  SELECT count(*) INTO _sessions FROM public.kids_wellness_sessions WHERE user_id = _user_id;
  SELECT count(*) INTO _challenges FROM public.kids_healthy_challenge_progress WHERE user_id = _user_id AND completed;

  _score := _streak * 2 + _sessions + _challenges * 2;
  _rank := CASE
    WHEN _score >= 40 THEN 'champion'
    WHEN _score >= 20 THEN 'strong'
    WHEN _score >= 10 THEN 'growing'
    WHEN _score >= 3  THEN 'budding'
    ELSE 'sprout' END;

  RETURN jsonb_build_object(
    'streak', _streak,
    'habits_today', _habits_today,
    'mood_today', _mood_today,
    'sleep_today', _sleep_today,
    'sessions', _sessions,
    'challenges_completed', _challenges,
    'wellness_rank', _rank
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kids_wellness_stats() TO authenticated, anon;

-- ============================================================
-- Seed: Health & Wellness achievements (shared kids_achievements table).
-- ============================================================
INSERT INTO public.kids_achievements (key, title, description, icon, reward_vx) VALUES
  ('healthy_start', 'Healthy Start',   'Complete your first healthy habit.',            'Heart',       15),
  ('healthy_roll',  'On a Roll',       'Keep a 3-day healthy habit streak.',            'Flame',       20),
  ('healthy_week',  'Healthy Week',    'Keep a 7-day healthy habit streak.',            'CalendarHeart', 40),
  ('mood_check_in', 'Feelings Friend', 'Log your mood for the first time.',             'Smile',       15),
  ('mindful_kid',   'Mindful Kid',     'Finish your first mindfulness session.',        'Sparkles',    20),
  ('active_kid',    'Active Kid',      'Finish your first exercise session.',           'Activity',    20),
  ('safety_smart',  'Safety Smart',    'Learn your first safety lesson.',               'ShieldCheck', 20)
ON CONFLICT (key) DO NOTHING;
