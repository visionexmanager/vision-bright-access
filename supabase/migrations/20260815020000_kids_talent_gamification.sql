-- ============================================================
-- Migration: VisionKids Talent Hub (Phase 9) — gamification, ranks,
-- achievements, and the talent certificate.
--
-- Reused, not redefined: award_kids_xp / award_kids_coins (CREATE OR
-- REPLACEd with every prior branch preserved verbatim + new talent reasons),
-- kids_achievements / award_kids_achievement (Stories), kids_certificates +
-- kids-issue-certificate edge function (Academy/Explorer/Events, extended
-- here with a 'talent' certificate). All reward writes go through the
-- SECURITY DEFINER RPCs below so the per-reason caps can't be bypassed and
-- rewards fire exactly once per skill/module/track.
-- ============================================================

-- ============================================================
-- Extend award_kids_xp / award_kids_coins with Phase 9 reasons. Amounts are
-- always computed server-side from table columns (bounded by their own CHECK
-- constraints), so these caps only need to cover those bounds.
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
    -- Phase 9 — Talent Hub
    WHEN _reason LIKE 'Talent assessment:%'     THEN _max_amount := 30;
    WHEN _reason LIKE 'Skill mastered:%'        THEN _max_amount := 60;
    WHEN _reason LIKE 'Module completed:%'      THEN _max_amount := 60;
    WHEN _reason LIKE 'Track completed:%'       THEN _max_amount := 150;
    WHEN _reason LIKE 'Innovation challenge:%'  THEN _max_amount := 60;
    WHEN _reason LIKE 'Talent certificate:%'    THEN _max_amount := 100;
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
    -- Phase 9 — Talent Hub
    WHEN _reason LIKE 'Talent assessment:%'    THEN _max_amount := 15;
    WHEN _reason LIKE 'Skill mastered:%'       THEN _max_amount := 30;
    WHEN _reason LIKE 'Module completed:%'     THEN _max_amount := 30;
    WHEN _reason LIKE 'Track completed:%'      THEN _max_amount := 75;
    WHEN _reason LIKE 'Innovation challenge:%' THEN _max_amount := 30;
    WHEN _reason LIKE 'Talent certificate:%'   THEN _max_amount := 60;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

-- ============================================================
-- submit_kids_talent_assessment — save/replace the caller's profile. Rewards
-- fire only on the FIRST assessment ever (guarded by whether a row already
-- existed), so retaking to refine the profile is free but doesn't farm XP.
-- Returns TRUE if this was the first-ever assessment.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_kids_talent_assessment(_domain_scores JSONB, _top_domains TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _is_first BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT NOT EXISTS (SELECT 1 FROM public.kids_talent_results WHERE user_id = _user_id) INTO _is_first;

  INSERT INTO public.kids_talent_results (user_id, domain_scores, top_domains, taken_at)
  VALUES (_user_id, COALESCE(_domain_scores, '{}'::jsonb), COALESCE(_top_domains, '{}'), now())
  ON CONFLICT (user_id) DO UPDATE
    SET domain_scores = EXCLUDED.domain_scores, top_domains = EXCLUDED.top_domains, taken_at = now();

  IF _is_first THEN
    PERFORM public.award_kids_xp(25, 'Talent assessment: complete');
    PERFORM public.award_kids_coins(15, 'Talent assessment: complete');
    PERFORM public.award_kids_achievement('talent_discovered');
  END IF;

  RETURN _is_first;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_kids_talent_assessment(JSONB, TEXT[]) TO authenticated;

-- ============================================================
-- complete_kids_skill — mark a Skill Tree node mastered. Server-enforces
-- prerequisites (returns FALSE if any prereq isn't completed), and rewards
-- fire exactly once (guarded by the row's prior status). Awards the skill's
-- badge achievement when it has one. Returns TRUE only on a fresh mastery.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_kids_skill(_skill_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _skill public.kids_skills%ROWTYPE;
  _prereq TEXT;
  _already_completed BOOLEAN;
  _unmet INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT * INTO _skill FROM public.kids_skills WHERE slug = _skill_slug AND status = 'published';
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Every prerequisite must already be completed by this user.
  SELECT count(*) INTO _unmet
  FROM unnest(_skill.prerequisites) AS p(slug)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kids_skill_progress sp
    WHERE sp.user_id = _user_id AND sp.skill_slug = p.slug AND sp.status = 'completed'
  );
  IF _unmet > 0 THEN RETURN FALSE; END IF;

  SELECT (status = 'completed') INTO _already_completed
  FROM public.kids_skill_progress WHERE user_id = _user_id AND skill_slug = _skill_slug;

  INSERT INTO public.kids_skill_progress (user_id, skill_slug, completed_tasks, status, completed_at)
  VALUES (_user_id, _skill_slug, jsonb_array_length(_skill.tasks), 'completed', now())
  ON CONFLICT (user_id, skill_slug) DO UPDATE
    SET status = 'completed',
        completed_tasks = jsonb_array_length(_skill.tasks),
        completed_at = COALESCE(public.kids_skill_progress.completed_at, now());

  IF COALESCE(_already_completed, FALSE) THEN RETURN FALSE; END IF;

  PERFORM public.award_kids_xp(_skill.reward_xp, 'Skill mastered: ' || _skill_slug);
  PERFORM public.award_kids_coins(_skill.reward_coins, 'Skill mastered: ' || _skill_slug);
  IF _skill.badge_key IS NOT NULL THEN
    PERFORM public.award_kids_achievement(_skill.badge_key);
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_kids_skill(TEXT) TO authenticated;

-- ============================================================
-- complete_kids_track_module — mark a module done. Idempotent (a module can
-- only be completed once); on a fresh completion it awards the module reward
-- and, if that was the last module in the track, the track-completion bonus
-- and 'track_finisher' achievement. Returns the new track completion state:
--   { newly_completed_module, track_completed_now, done, total }
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_kids_track_module(_module_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _module public.kids_track_modules%ROWTYPE;
  _newly_module BOOLEAN := FALSE;
  _track_now BOOLEAN := FALSE;
  _done INTEGER;
  _total INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT * INTO _module FROM public.kids_track_modules WHERE id = _module_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Module not found'; END IF;

  INSERT INTO public.kids_track_module_progress (user_id, module_id, track_slug)
  VALUES (_user_id, _module_id, _module.track_slug)
  ON CONFLICT (user_id, module_id) DO NOTHING;
  _newly_module := FOUND;

  IF _newly_module THEN
    PERFORM public.award_kids_xp(_module.reward_xp, 'Module completed: ' || _module_id::text);
    PERFORM public.award_kids_coins(_module.reward_coins, 'Module completed: ' || _module_id::text);
    IF _module.kind = 'project' AND _module.track_slug = 'innovation-lab' THEN
      PERFORM public.award_kids_coins(20, 'Innovation challenge: ' || _module.track_slug);
    END IF;
  END IF;

  SELECT count(*) INTO _total FROM public.kids_track_modules WHERE track_slug = _module.track_slug AND status = 'published';
  SELECT count(*) INTO _done FROM public.kids_track_module_progress p
    JOIN public.kids_track_modules m ON m.id = p.module_id AND m.status = 'published'
    WHERE p.user_id = _user_id AND p.track_slug = _module.track_slug;

  IF _newly_module AND _total > 0 AND _done >= _total THEN
    PERFORM public.award_kids_xp(120, 'Track completed: ' || _module.track_slug);
    PERFORM public.award_kids_coins(60, 'Track completed: ' || _module.track_slug);
    PERFORM public.award_kids_achievement('track_finisher');
    _track_now := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'newly_completed_module', _newly_module,
    'track_completed_now', _track_now,
    'done', _done,
    'total', _total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_kids_track_module(UUID) TO authenticated;

-- ============================================================
-- get_kids_talent_stats — one round-trip for the Talent Hub dashboard: the
-- caller's completion counts plus derived Talent Rank and Innovation Rank
-- (slugs the client maps to localized labels). SECURITY DEFINER so it can be
-- a single call, but it only ever reads the caller's own rows.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kids_talent_stats()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _skills INTEGER := 0;
  _modules INTEGER := 0;
  _tracks INTEGER := 0;
  _projects INTEGER := 0;
  _has_assessment BOOLEAN := FALSE;
  _talent_score INTEGER;
  _innovation_score INTEGER;
  _talent_rank TEXT;
  _innovation_rank TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('skills_completed',0,'modules_completed',0,'tracks_completed',0,
      'portfolio_count',0,'has_assessment',false,'talent_rank','novice','innovation_rank','curious');
  END IF;

  SELECT count(*) INTO _skills FROM public.kids_skill_progress WHERE user_id = _user_id AND status = 'completed';
  SELECT count(*) INTO _modules FROM public.kids_track_module_progress WHERE user_id = _user_id;
  SELECT count(*) INTO _projects FROM public.kids_portfolio_items WHERE user_id = _user_id AND kind IN ('project','game','drawing','story');
  SELECT EXISTS (SELECT 1 FROM public.kids_talent_results WHERE user_id = _user_id) INTO _has_assessment;

  SELECT count(*) INTO _tracks FROM (
    SELECT p.track_slug
    FROM public.kids_track_module_progress p
    JOIN public.kids_track_modules m ON m.id = p.module_id AND m.status = 'published'
    WHERE p.user_id = _user_id
    GROUP BY p.track_slug
    HAVING count(*) >= (SELECT count(*) FROM public.kids_track_modules tm WHERE tm.track_slug = p.track_slug AND tm.status = 'published')
  ) t;

  _talent_score := _skills * 2 + _modules;
  _innovation_score := _tracks * 3 + _projects;

  _talent_rank := CASE
    WHEN _talent_score >= 50 THEN 'prodigy'
    WHEN _talent_score >= 30 THEN 'expert'
    WHEN _talent_score >= 15 THEN 'talented'
    WHEN _talent_score >= 5  THEN 'rising_star'
    ELSE 'novice' END;

  _innovation_rank := CASE
    WHEN _innovation_score >= 25 THEN 'visionary'
    WHEN _innovation_score >= 15 THEN 'innovator'
    WHEN _innovation_score >= 8  THEN 'builder'
    WHEN _innovation_score >= 3  THEN 'maker'
    ELSE 'curious' END;

  RETURN jsonb_build_object(
    'skills_completed', _skills,
    'modules_completed', _modules,
    'tracks_completed', _tracks,
    'portfolio_count', _projects,
    'has_assessment', _has_assessment,
    'talent_rank', _talent_rank,
    'innovation_rank', _innovation_rank
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kids_talent_stats() TO authenticated, anon;

-- ============================================================
-- Seed: Talent Hub achievements (shared kids_achievements table).
-- ============================================================
INSERT INTO public.kids_achievements (key, title, description, icon, reward_vx) VALUES
  ('talent_discovered', 'Talent Discovered', 'Complete the Talent Assessment for the first time.', 'Sparkles', 15),
  ('skill_starter',     'Skill Starter',     'Master your first skill in the Skill Tree.',          'Star',      15),
  ('skill_master',      'Skill Master',      'Master 10 skills in the Skill Tree.',                 'Award',     40),
  ('track_finisher',    'Track Finisher',    'Complete every module in a Talent Academy track.',    'GraduationCap', 40),
  ('future_ready',      'Future Ready',      'Explore all 10 Future Skills.',                       'Rocket',    30),
  ('portfolio_builder', 'Portfolio Builder', 'Add 5 items to your Portfolio.',                      'FolderHeart', 25),
  ('young_innovator',   'Young Innovator',   'Reach the Innovator rank.',                           'Lightbulb', 50)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Extend kids_certificates with a 'talent' certificate (issued by the
-- kids-issue-certificate edge function once a child finishes a full track or
-- masters enough skills). reference_id already nullable (relaxed in Phase 6).
-- ============================================================
ALTER TABLE public.kids_certificates DROP CONSTRAINT IF EXISTS kids_certificates_certificate_type_check;
ALTER TABLE public.kids_certificates ADD CONSTRAINT kids_certificates_certificate_type_check
  CHECK (certificate_type IN ('course', 'learning_path', 'explorer', 'event_participation', 'event_winner', 'talent'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_kids_certificates_talent_unique
  ON public.kids_certificates(user_id) WHERE certificate_type = 'talent';
