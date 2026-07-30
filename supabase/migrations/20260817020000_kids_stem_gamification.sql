-- ============================================================
-- Migration: VisionKids STEM & Innovation Center (Phase 11) — gamification.
--
-- Reused, not redefined: award_kids_xp / award_kids_coins are CREATE OR
-- REPLACEd with EVERY prior branch preserved verbatim and STEM reasons
-- appended; kids_achievements / award_kids_achievement (Stories) are reused.
-- Every reward write goes through SECURITY DEFINER RPCs so once-only grants
-- can't be forged and amounts are always computed server-side from catalog
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
    -- Phase 11 — STEM & Innovation Center
    WHEN _reason LIKE 'Experiment completed:%'  THEN _max_amount := 60;
    WHEN _reason LIKE 'Experiment quiz:%'       THEN _max_amount := 30;
    WHEN _reason LIKE 'Invention saved:%'       THEN _max_amount := 20;
    WHEN _reason LIKE 'Robot programmed:%'      THEN _max_amount := 30;
    WHEN _reason LIKE 'Design created:%'        THEN _max_amount := 20;
    WHEN _reason LIKE 'Innovation submitted:%'  THEN _max_amount := 60;
    WHEN _reason LIKE 'Research read:%'         THEN _max_amount := 15;
    WHEN _reason LIKE 'STEM streak:%'           THEN _max_amount := 60;
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
    -- Phase 11 — STEM & Innovation Center
    WHEN _reason LIKE 'Experiment completed:%' THEN _max_amount := 30;
    WHEN _reason LIKE 'Experiment quiz:%'      THEN _max_amount := 15;
    WHEN _reason LIKE 'Invention saved:%'      THEN _max_amount := 10;
    WHEN _reason LIKE 'Robot programmed:%'     THEN _max_amount := 15;
    WHEN _reason LIKE 'Design created:%'       THEN _max_amount := 10;
    WHEN _reason LIKE 'Innovation submitted:%' THEN _max_amount := 30;
    WHEN _reason LIKE 'Research read:%'        THEN _max_amount := 8;
    WHEN _reason LIKE 'STEM streak:%'          THEN _max_amount := 30;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

-- ============================================================
-- complete_kids_experiment — mark an experiment complete + record best quiz
-- score. Idempotent: the completion reward is granted once (first completion);
-- a perfect-quiz bonus is granted once. Returns { newly_completed, best_score }.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_kids_experiment(_experiment_id UUID, _quiz_score INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _exp public.kids_experiments%ROWTYPE;
  _was_completed BOOLEAN := FALSE;
  _prev_best INTEGER := 0;
  _new_best INTEGER;
  _first_ever BOOLEAN := FALSE;
  _score INTEGER := GREATEST(0, LEAST(100, COALESCE(_quiz_score, 0)));
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT * INTO _exp FROM public.kids_experiments WHERE id = _experiment_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Experiment not found'; END IF;

  SELECT completed, best_score INTO _was_completed, _prev_best
  FROM public.kids_experiment_progress WHERE user_id = _user_id AND experiment_id = _experiment_id;

  SELECT NOT EXISTS (SELECT 1 FROM public.kids_experiment_progress WHERE user_id = _user_id AND completed) INTO _first_ever;

  _new_best := GREATEST(COALESCE(_prev_best, 0), _score);

  INSERT INTO public.kids_experiment_progress (user_id, experiment_id, completed, best_score, completed_at)
  VALUES (_user_id, _experiment_id, TRUE, _new_best, now())
  ON CONFLICT (user_id, experiment_id) DO UPDATE
    SET completed = TRUE, best_score = _new_best,
        completed_at = COALESCE(public.kids_experiment_progress.completed_at, now()),
        updated_at = now();

  IF NOT COALESCE(_was_completed, FALSE) THEN
    PERFORM public.award_kids_xp(_exp.reward_xp, 'Experiment completed: ' || _exp.lab || '/' || _exp.slug);
    PERFORM public.award_kids_coins(_exp.reward_coins, 'Experiment completed: ' || _exp.lab || '/' || _exp.slug);
    IF _first_ever THEN
      PERFORM public.award_kids_achievement('first_experiment');
    END IF;
    IF _score >= 100 THEN
      PERFORM public.award_kids_xp(15, 'Experiment quiz: ' || _exp.slug);
      PERFORM public.award_kids_coins(8, 'Experiment quiz: ' || _exp.slug);
    END IF;
  END IF;

  RETURN jsonb_build_object('newly_completed', NOT COALESCE(_was_completed, FALSE), 'best_score', _new_best);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_kids_experiment(UUID, INTEGER) TO authenticated;

-- ============================================================
-- save_kids_project — create a portfolio project (robot / design / experiment
-- note). Owned by caller. The creation reward for a given kind is granted only
-- the FIRST time the child saves that kind (so it encourages creating without
-- being farmable). Returns the new project id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_kids_project(
  _kind TEXT, _title TEXT, _description TEXT, _lab TEXT, _emoji TEXT,
  _data JSONB, _is_public BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _id UUID;
  _first_of_kind BOOLEAN;
  _clean_title TEXT := btrim(COALESCE(_title, ''));
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _kind NOT IN ('robot', 'design', 'experiment') THEN RAISE EXCEPTION 'Invalid project kind'; END IF;
  IF length(_clean_title) = 0 OR length(_clean_title) > 80 THEN RAISE EXCEPTION 'Title must be 1-80 characters'; END IF;

  SELECT NOT EXISTS (SELECT 1 FROM public.kids_stem_projects WHERE user_id = _user_id AND kind = _kind) INTO _first_of_kind;

  INSERT INTO public.kids_stem_projects (user_id, kind, title, description, lab, emoji, data, is_public, status)
  VALUES (_user_id, _kind, _clean_title, NULLIF(btrim(COALESCE(_description, '')), ''), _lab,
          COALESCE(NULLIF(_emoji, ''), '🧪'), COALESCE(_data, '{}'::jsonb), COALESCE(_is_public, FALSE),
          CASE WHEN COALESCE(_is_public, FALSE) THEN 'published' ELSE 'draft' END)
  RETURNING id INTO _id;

  IF _first_of_kind THEN
    IF _kind = 'robot' THEN
      PERFORM public.award_kids_xp(30, 'Robot programmed: ' || _id::text);
      PERFORM public.award_kids_coins(15, 'Robot programmed: ' || _id::text);
      PERFORM public.award_kids_achievement('robot_coder');
    ELSIF _kind = 'design' THEN
      PERFORM public.award_kids_xp(20, 'Design created: ' || _id::text);
      PERFORM public.award_kids_coins(10, 'Design created: ' || _id::text);
      PERFORM public.award_kids_achievement('designer_3d');
    ELSE
      PERFORM public.award_kids_xp(20, 'Invention saved: ' || _id::text);
      PERFORM public.award_kids_coins(10, 'Invention saved: ' || _id::text);
    END IF;
  END IF;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_kids_project(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN) TO authenticated;

-- ============================================================
-- submit_kids_innovation — submit a solution to an Innovation Challenge. Creates
-- an 'invention' project linked to the challenge. Rewards once per challenge.
-- Returns the new project id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_kids_innovation(
  _challenge_id UUID, _title TEXT, _description TEXT, _data JSONB, _is_public BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _challenge public.kids_innovation_challenges%ROWTYPE;
  _id UUID;
  _already BOOLEAN;
  _clean_title TEXT := btrim(COALESCE(_title, ''));
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF length(_clean_title) = 0 OR length(_clean_title) > 80 THEN RAISE EXCEPTION 'Title must be 1-80 characters'; END IF;

  SELECT * INTO _challenge FROM public.kids_innovation_challenges WHERE id = _challenge_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.kids_stem_projects
    WHERE user_id = _user_id AND challenge_id = _challenge_id AND status IN ('submitted', 'published')
  ) INTO _already;

  INSERT INTO public.kids_stem_projects (user_id, kind, title, description, lab, emoji, data, challenge_id, is_public, status)
  VALUES (_user_id, 'invention', _clean_title, NULLIF(btrim(COALESCE(_description, '')), ''), 'innovation',
          COALESCE(_challenge.emoji, '💡'), COALESCE(_data, '{}'::jsonb), _challenge_id, COALESCE(_is_public, TRUE),
          CASE WHEN COALESCE(_is_public, TRUE) THEN 'published' ELSE 'submitted' END)
  RETURNING id INTO _id;

  IF NOT _already THEN
    PERFORM public.award_kids_xp(_challenge.reward_xp, 'Innovation submitted: ' || _challenge.slug);
    PERFORM public.award_kids_coins(_challenge.reward_coins, 'Innovation submitted: ' || _challenge.slug);
    PERFORM public.award_kids_achievement('young_inventor');
  END IF;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_kids_innovation(UUID, TEXT, TEXT, JSONB, BOOLEAN) TO authenticated;

-- ============================================================
-- toggle_kids_project_like — cheer / un-cheer a PUBLIC gallery project (not
-- your own). Keeps kids_stem_projects.likes in sync. Returns { liked, likes }.
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_kids_project_like(_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _proj public.kids_stem_projects%ROWTYPE;
  _liked BOOLEAN;
  _count INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT * INTO _proj FROM public.kids_stem_projects WHERE id = _project_id;
  IF NOT FOUND OR NOT (_proj.is_public AND _proj.status = 'published') THEN RAISE EXCEPTION 'Project not available'; END IF;
  IF _proj.user_id = _user_id THEN RAISE EXCEPTION 'Cannot like your own project'; END IF;

  IF EXISTS (SELECT 1 FROM public.kids_project_likes WHERE user_id = _user_id AND project_id = _project_id) THEN
    DELETE FROM public.kids_project_likes WHERE user_id = _user_id AND project_id = _project_id;
    _liked := FALSE;
  ELSE
    INSERT INTO public.kids_project_likes (user_id, project_id) VALUES (_user_id, _project_id);
    _liked := TRUE;
  END IF;

  SELECT count(*) INTO _count FROM public.kids_project_likes WHERE project_id = _project_id;
  UPDATE public.kids_stem_projects SET likes = _count WHERE id = _project_id;

  RETURN jsonb_build_object('liked', _liked, 'likes', _count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_kids_project_like(UUID) TO authenticated;

-- ============================================================
-- mark_kids_research_read — record an article read; reward once. Returns TRUE
-- on the first read of that article.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_kids_research_read(_article_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _newly BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kids_research_articles WHERE id = _article_id AND status = 'published') THEN
    RAISE EXCEPTION 'Article not found';
  END IF;

  INSERT INTO public.kids_research_reads (user_id, article_id)
  VALUES (_user_id, _article_id)
  ON CONFLICT (user_id, article_id) DO NOTHING;
  _newly := FOUND;

  IF _newly THEN
    PERFORM public.award_kids_xp(15, 'Research read: ' || _article_id::text);
    PERFORM public.award_kids_coins(8, 'Research read: ' || _article_id::text);
  END IF;

  RETURN _newly;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_kids_research_read(UUID) TO authenticated;

-- ============================================================
-- get_kids_stem_stats — one round-trip for the STEM Home dashboard + Rewards.
-- Reads only the caller's own rows and derives Science + Inventor rank slugs.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kids_stem_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _experiments INTEGER := 0;
  _projects INTEGER := 0;
  _inventions INTEGER := 0;
  _robots INTEGER := 0;
  _designs INTEGER := 0;
  _research INTEGER := 0;
  _science_score INTEGER;
  _inventor_score INTEGER;
  _science_rank TEXT;
  _inventor_rank TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('experiments',0,'projects',0,'inventions',0,'robots',0,'designs',0,
      'research_read',0,'science_rank','novice','inventor_rank','tinkerer');
  END IF;

  SELECT count(*) INTO _experiments FROM public.kids_experiment_progress WHERE user_id = _user_id AND completed;
  SELECT count(*) INTO _projects FROM public.kids_stem_projects WHERE user_id = _user_id;
  SELECT count(*) INTO _inventions FROM public.kids_stem_projects WHERE user_id = _user_id AND kind = 'invention';
  SELECT count(*) INTO _robots FROM public.kids_stem_projects WHERE user_id = _user_id AND kind = 'robot';
  SELECT count(*) INTO _designs FROM public.kids_stem_projects WHERE user_id = _user_id AND kind = 'design';
  SELECT count(*) INTO _research FROM public.kids_research_reads WHERE user_id = _user_id;

  _science_score := _experiments * 2 + _research;
  _science_rank := CASE
    WHEN _science_score >= 40 THEN 'professor'
    WHEN _science_score >= 24 THEN 'scientist'
    WHEN _science_score >= 12 THEN 'researcher'
    WHEN _science_score >= 4  THEN 'explorer'
    ELSE 'novice' END;

  _inventor_score := _inventions * 3 + _robots * 2 + _designs * 2 + _projects;
  _inventor_rank := CASE
    WHEN _inventor_score >= 40 THEN 'genius'
    WHEN _inventor_score >= 24 THEN 'innovator'
    WHEN _inventor_score >= 12 THEN 'maker'
    WHEN _inventor_score >= 4  THEN 'builder'
    ELSE 'tinkerer' END;

  RETURN jsonb_build_object(
    'experiments', _experiments,
    'projects', _projects,
    'inventions', _inventions,
    'robots', _robots,
    'designs', _designs,
    'research_read', _research,
    'science_rank', _science_rank,
    'inventor_rank', _inventor_rank
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kids_stem_stats() TO authenticated, anon;

-- ============================================================
-- Seed: STEM & Innovation achievements/badges (shared kids_achievements table).
-- ============================================================
INSERT INTO public.kids_achievements (key, title, description, icon, reward_vx) VALUES
  ('first_experiment', 'First Discovery', 'Complete your first experiment.',        'FlaskConical', 20),
  ('young_inventor',   'Young Inventor',  'Submit your first innovation challenge.', 'Lightbulb',    40),
  ('robot_coder',      'Robot Coder',     'Program your first robot.',               'Bot',          25),
  ('designer_3d',      '3D Designer',     'Create your first 3D design.',            'Box',          20),
  ('science_star',     'Science Star',    'Complete 10 experiments.',                'Star',         50)
ON CONFLICT (key) DO NOTHING;
