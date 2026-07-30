-- ============================================================
-- Migration: VisionKids Explorer (Phase 6) — quiz reuse, daily/weekly
-- mission extension, simulator saves, explorer passport, achievements,
-- and certificate extension.
--
-- Reused, not redefined: kids_quizzes/kids_quiz_questions/kids_quiz_attempts
-- (Stories, extended again here), kids_daily_challenges/kids_weekly_challenges
-- (Games, extended again here — same pattern used for Academy's lesson_id
-- addition), kids_achievements/kids_user_achievements/award_kids_achievement
-- (Stories), award_kids_xp/award_kids_coins (Stories/Games, CREATE OR
-- REPLACEd again here), kids_certificates + kids-issue-certificate edge
-- function (Academy, extended again here for a "master explorer" certificate).
-- ============================================================

-- ============================================================
-- Extend kids_quizzes to also serve as a short quiz per explorer location
-- (a planet, an animal, a dinosaur, ...). Exactly one of
-- story_id / lesson_id / course_id / location_id must be set.
-- ============================================================
ALTER TABLE public.kids_quizzes ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.kids_explorer_locations(id) ON DELETE CASCADE;

ALTER TABLE public.kids_quizzes DROP CONSTRAINT IF EXISTS kids_quizzes_one_owner;
ALTER TABLE public.kids_quizzes ADD CONSTRAINT kids_quizzes_one_owner CHECK (
  (CASE WHEN story_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN lesson_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN course_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN location_id IS NOT NULL THEN 1 ELSE 0 END) = 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kids_quizzes_location_unique ON public.kids_quizzes(location_id) WHERE location_id IS NOT NULL;

DROP POLICY IF EXISTS "kids_quizzes: readable if owner readable" ON public.kids_quizzes;
CREATE POLICY "kids_quizzes: readable if owner readable"
  ON public.kids_quizzes FOR SELECT
  USING (
    (story_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_stories s WHERE s.id = story_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))))
    OR (lesson_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
      WHERE l.id = lesson_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    ))
    OR (course_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    ))
    OR (location_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_explorer_locations loc WHERE loc.id = location_id AND (loc.status = 'published' OR public.has_role(auth.uid(), 'admin'))
    ))
  );

DROP POLICY IF EXISTS "kids_quizzes: admins or course owner manage" ON public.kids_quizzes;
CREATE POLICY "kids_quizzes: admins or course owner manage"
  ON public.kids_quizzes FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = lesson_id AND c.teacher_id = auth.uid()))
    OR (course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND c.teacher_id = auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = lesson_id AND c.teacher_id = auth.uid()))
    OR (course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND c.teacher_id = auth.uid()))
  );

DROP POLICY IF EXISTS "kids_quiz_questions: readable if quiz readable" ON public.kids_quiz_questions;
CREATE POLICY "kids_quiz_questions: readable if quiz readable"
  ON public.kids_quiz_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_quizzes q WHERE q.id = quiz_id
    AND (
      (q.story_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_stories s WHERE s.id = q.story_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))))
      OR (q.lesson_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
        WHERE l.id = q.lesson_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
      ))
      OR (q.course_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kids_courses c WHERE c.id = q.course_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
      ))
      OR (q.location_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kids_explorer_locations loc WHERE loc.id = q.location_id AND (loc.status = 'published' OR public.has_role(auth.uid(), 'admin'))
      ))
    )
  ));

DROP POLICY IF EXISTS "kids_quiz_questions: admins or course owner manage" ON public.kids_quiz_questions;
CREATE POLICY "kids_quiz_questions: admins or course owner manage"
  ON public.kids_quiz_questions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.kids_quizzes q WHERE q.id = quiz_id AND (
      public.has_role(auth.uid(), 'admin')
      OR (q.lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = q.lesson_id AND c.teacher_id = auth.uid()))
      OR (q.course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = q.course_id AND c.teacher_id = auth.uid()))
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kids_quizzes q WHERE q.id = quiz_id AND (
      public.has_role(auth.uid(), 'admin')
      OR (q.lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = q.lesson_id AND c.teacher_id = auth.uid()))
      OR (q.course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = q.course_id AND c.teacher_id = auth.uid()))
    )
  ));

-- ============================================================
-- Extend kids_daily_challenges / kids_weekly_challenges (20260809020000) with
-- exploration-flavored targets — same pattern as Academy's lesson_id addition.
-- ============================================================
ALTER TABLE public.kids_daily_challenges ADD COLUMN IF NOT EXISTS world_slug TEXT REFERENCES public.kids_explorer_worlds(slug) ON DELETE SET NULL;
ALTER TABLE public.kids_daily_challenges DROP CONSTRAINT IF EXISTS kids_daily_challenges_target_type_check;
ALTER TABLE public.kids_daily_challenges ADD CONSTRAINT kids_daily_challenges_target_type_check
  CHECK (target_type IN ('play_game', 'score_at_least', 'win_count', 'complete_any_game', 'complete_lesson', 'visit_world', 'complete_quiz'));

ALTER TABLE public.kids_weekly_challenges ADD COLUMN IF NOT EXISTS world_slug TEXT REFERENCES public.kids_explorer_worlds(slug) ON DELETE SET NULL;
ALTER TABLE public.kids_weekly_challenges DROP CONSTRAINT IF EXISTS kids_weekly_challenges_target_type_check;
ALTER TABLE public.kids_weekly_challenges ADD CONSTRAINT kids_weekly_challenges_target_type_check
  CHECK (target_type IN ('play_game', 'score_at_least', 'win_count', 'complete_any_game', 'complete_lesson', 'visit_world', 'complete_quiz'));

-- ============================================================
-- kids_explorer_simulator_saves — one continuous save per simulator per
-- user (polymorphic: simulator_type + JSONB state), so "Continue" always
-- resumes exactly where a child left off. Adding a 5th, 6th, ... simulator
-- later is a CHECK-constraint value, not a new table.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_explorer_simulator_saves (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulator_type  TEXT NOT NULL CHECK (simulator_type IN ('space_mission', 'city_builder', 'farm_simulator', 'eco_world')),
  state           JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, simulator_type)
);

ALTER TABLE public.kids_explorer_simulator_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_explorer_simulator_saves: user manages own"
  ON public.kids_explorer_simulator_saves FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_kids_explorer_simulator_saves_touch
  BEFORE UPDATE ON public.kids_explorer_simulator_saves
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- kids_explorer_passport_stamps — one stamp per (user, world). Public read
-- (same "earned badges are a public flex" model as kids_user_achievements)
-- so a child's passport can be shown off; no direct INSERT policy — only
-- award_kids_explorer_stamp() (below) can write here.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_explorer_passport_stamps (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  world_slug  TEXT NOT NULL REFERENCES public.kids_explorer_worlds(slug) ON DELETE CASCADE,
  stamped_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, world_slug)
);

ALTER TABLE public.kids_explorer_passport_stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_explorer_passport_stamps: public read"
  ON public.kids_explorer_passport_stamps FOR SELECT USING (true);

-- ============================================================
-- Extend award_kids_xp / award_kids_coins (Stories/Games) with exploration
-- reasons. CREATE OR REPLACE preserves every prior branch verbatim.
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
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

-- ============================================================
-- award_kids_explorer_stamp — self-only, idempotent (a world can only be
-- stamped once). Awards the stamp, then XP/coins/achievements ONLY the
-- first time (checked via FOUND after an ON CONFLICT DO NOTHING insert),
-- so revisiting an already-stamped world is free to do but doesn't farm
-- rewards. Returns TRUE only when this was a brand-new stamp, so the
-- client knows whether to show a "stamped!" celebration and bump today's/
-- this week's exploration missions.
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_kids_explorer_stamp(_world_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _kind TEXT;
  _stamp_count INTEGER;
  _total_worlds INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT kind INTO _kind FROM public.kids_explorer_worlds WHERE slug = _world_slug AND status = 'published';
  IF _kind IS NULL OR _kind = 'hub' THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.kids_explorer_passport_stamps (user_id, world_slug)
  VALUES (_user_id, _world_slug)
  ON CONFLICT (user_id, world_slug) DO NOTHING;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  PERFORM public.award_kids_xp(20, 'World explored: ' || _world_slug);
  PERFORM public.award_kids_coins(10, 'World explored: ' || _world_slug);

  SELECT count(*) INTO _stamp_count FROM public.kids_explorer_passport_stamps WHERE user_id = _user_id;

  IF _stamp_count >= 5 THEN
    PERFORM public.award_kids_achievement('world_wanderer');
  END IF;

  SELECT count(*) INTO _total_worlds FROM public.kids_explorer_worlds WHERE kind != 'hub' AND status = 'published';
  IF _stamp_count >= _total_worlds THEN
    PERFORM public.award_kids_achievement('master_explorer');
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_kids_explorer_stamp(TEXT) TO authenticated;

-- ============================================================
-- Seed: Explorer achievements (shared kids_achievements table).
-- ============================================================
INSERT INTO public.kids_achievements (key, title, description, icon, reward_vx) VALUES
  ('world_wanderer',    'World Wanderer',    'Get your passport stamped in 5 different worlds.', 'Compass',   25),
  ('master_explorer',   'Master Explorer',   'Visit every world in VisionKids Explorer.',         'Award',     60),
  ('quiz_whiz',         'Quiz Whiz',         'Complete 10 location quizzes.',                     'Sparkles',  30),
  ('city_planner',      'City Planner',      'Build your first city in City Builder.',            'Building2', 20),
  ('green_thumb',       'Green Thumb',       'Harvest your first crop in Farm Simulator.',         'Sprout',    20),
  ('eco_hero',          'Eco Hero',          'Complete your first Eco World scenario.',            'Leaf',      20),
  ('space_cadet',       'Space Cadet',       'Complete your first Space Mission.',                 'Rocket',    20)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Extend kids_certificates (Academy) with an 'explorer' master certificate.
-- reference_id is no longer meaningful for this type (there's no single
-- "course" being certified — it's issued once all worlds are stamped), so
-- it's relaxed to nullable here.
-- ============================================================
ALTER TABLE public.kids_certificates ALTER COLUMN reference_id DROP NOT NULL;
ALTER TABLE public.kids_certificates DROP CONSTRAINT IF EXISTS kids_certificates_certificate_type_check;
ALTER TABLE public.kids_certificates ADD CONSTRAINT kids_certificates_certificate_type_check
  CHECK (certificate_type IN ('course', 'learning_path', 'explorer'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_kids_certificates_explorer_unique
  ON public.kids_certificates(user_id) WHERE certificate_type = 'explorer';

-- ============================================================
-- Seed: a few exploration-flavored daily/weekly missions. These need no
-- new UI at all — the existing /kids/games/daily-challenges and
-- /kids/games/weekly-challenges pages (and their ChallengeCard component)
-- already list every row in these two tables regardless of game_id, so
-- explorer missions (game_id NULL, world_slug set) simply show up there.
-- ============================================================
INSERT INTO public.kids_daily_challenges (challenge_date, world_slug, title, description, target_type, target_value, reward_xp, reward_coins) VALUES
  (CURRENT_DATE, NULL, 'World Wanderer',   'Visit any 2 explorer worlds today.',        'visit_world',   2, 15, 10),
  (CURRENT_DATE, NULL, 'Curious Mind',     'Complete 1 location quiz today.',           'complete_quiz', 1, 15, 10);

INSERT INTO public.kids_weekly_challenges (week_start, world_slug, title, description, target_type, target_value, reward_xp, reward_coins) VALUES
  (date_trunc('week', CURRENT_DATE)::date, NULL, 'Grand Tour',      'Visit 5 different explorer worlds this week.', 'visit_world',   5, 60, 30),
  (date_trunc('week', CURRENT_DATE)::date, NULL, 'Quiz Marathon',   'Complete 5 location quizzes this week.',       'complete_quiz', 5, 60, 30);
