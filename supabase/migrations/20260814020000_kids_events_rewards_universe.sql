-- ============================================================
-- Migration: VisionKids Live Events & Kids Universe (Phase 8) — event
-- certificates, medals, competition submissions, limited rewards, and the
-- Kids Universe map (cities/characters/visits).
--
-- Reused, not redefined: public.kids_certificates + the kids-issue-
-- certificate edge function (Academy, extended again in Phase 6 for
-- 'explorer' — extended a 3rd time here), public.kids_achievements,
-- public.award_kids_xp / award_kids_coins.
-- ============================================================

-- ============================================================
-- Extend kids_certificates with event certificate types.
-- ============================================================
ALTER TABLE public.kids_certificates DROP CONSTRAINT IF EXISTS kids_certificates_certificate_type_check;
ALTER TABLE public.kids_certificates ADD CONSTRAINT kids_certificates_certificate_type_check
  CHECK (certificate_type IN ('course', 'learning_path', 'explorer', 'event_participation', 'event_winner'));

-- ============================================================
-- kids_event_medals — a public flex, same visibility model as
-- kids_user_achievements (Stories).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_event_medals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.kids_events(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medal_type   TEXT NOT NULL CHECK (medal_type IN ('gold', 'silver', 'bronze', 'participation')),
  awarded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  awarded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.kids_event_medals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_event_medals: public read"
  ON public.kids_event_medals FOR SELECT USING (true);

CREATE POLICY "kids_event_medals: host or admin award"
  ON public.kids_event_medals FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid()));

-- ============================================================
-- kids_event_submissions — competition entries. Judging (who wins) is
-- inherently a human call for creative categories like drawing/stories —
-- score/rank are set by the host/admin, not computed automatically.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_event_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.kids_events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT,
  file_url      TEXT,
  score         NUMERIC,
  rank          INTEGER,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.kids_event_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_event_submissions: public read"
  ON public.kids_event_submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND (e.status <> 'draft' OR public.has_role(auth.uid(), 'admin') OR e.host_id = auth.uid())));

CREATE POLICY "kids_event_submissions: self submits own"
  ON public.kids_event_submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "kids_event_submissions: self updates own entry"
  ON public.kids_event_submissions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND score IS NOT DISTINCT FROM NULL AND rank IS NOT DISTINCT FROM NULL);

CREATE POLICY "kids_event_submissions: host or admin judges"
  ON public.kids_event_submissions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid()));

-- ============================================================
-- kids_event_limited_rewards — scarcity-based rewards (event-scoped or
-- seasonal), claimed atomically so quantity_claimed can never exceed
-- quantity_total even under concurrent requests.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_event_limited_rewards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT,
  emoji             TEXT NOT NULL DEFAULT '🏅',
  event_id          UUID REFERENCES public.kids_events(id) ON DELETE CASCADE,
  seasonal_key      TEXT,
  quantity_total    INTEGER NOT NULL CHECK (quantity_total > 0),
  quantity_claimed  INTEGER NOT NULL DEFAULT 0 CHECK (quantity_claimed >= 0),
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_event_limited_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_event_limited_rewards: public read"
  ON public.kids_event_limited_rewards FOR SELECT USING (true);

CREATE POLICY "kids_event_limited_rewards: admins manage"
  ON public.kids_event_limited_rewards FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.kids_user_limited_rewards (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id   UUID NOT NULL REFERENCES public.kids_event_limited_rewards(id) ON DELETE CASCADE,
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, reward_id)
);

ALTER TABLE public.kids_user_limited_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_user_limited_rewards: self reads own"
  ON public.kids_user_limited_rewards FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.claim_kids_limited_reward(_reward_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _updated INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  IF EXISTS (SELECT 1 FROM public.kids_user_limited_rewards WHERE user_id = _user_id AND reward_id = _reward_id) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.kids_event_limited_rewards
  SET quantity_claimed = quantity_claimed + 1
  WHERE id = _reward_id
    AND quantity_claimed < quantity_total
    AND (expires_at IS NULL OR expires_at > now());
  GET DIAGNOSTICS _updated = ROW_COUNT;

  IF _updated = 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.kids_user_limited_rewards (user_id, reward_id) VALUES (_user_id, _reward_id);
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_kids_limited_reward(UUID) TO authenticated;

-- ============================================================
-- Kids Universe — cities, characters, and first-visit stamps. Same
-- "visit → stamp → XP/coins/achievement, only once" pattern as
-- award_kids_explorer_stamp() (Phase 6).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_universe_cities (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  theme        TEXT NOT NULL,
  emoji        TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  description  TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_universe_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_universe_cities: public read"
  ON public.kids_universe_cities FOR SELECT USING (true);

CREATE POLICY "kids_universe_cities: admins manage"
  ON public.kids_universe_cities FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.kids_universe_characters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug   TEXT NOT NULL REFERENCES public.kids_universe_cities(slug) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  bio         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_universe_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_universe_characters: public read"
  ON public.kids_universe_characters FOR SELECT USING (true);

CREATE POLICY "kids_universe_characters: admins manage"
  ON public.kids_universe_characters FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.kids_universe_city_visits (
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_slug        TEXT NOT NULL REFERENCES public.kids_universe_cities(slug) ON DELETE CASCADE,
  first_visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, city_slug)
);

ALTER TABLE public.kids_universe_city_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_universe_city_visits: public read"
  ON public.kids_universe_city_visits FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.award_kids_universe_visit(_city_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _visit_count INTEGER;
  _total_cities INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.kids_universe_cities WHERE slug = _city_slug) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.kids_universe_city_visits (user_id, city_slug)
  VALUES (_user_id, _city_slug)
  ON CONFLICT (user_id, city_slug) DO NOTHING;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  PERFORM public.award_kids_xp(15, 'City visited: ' || _city_slug);
  PERFORM public.award_kids_coins(8, 'City visited: ' || _city_slug);

  SELECT count(*) INTO _visit_count FROM public.kids_universe_city_visits WHERE user_id = _user_id;
  SELECT count(*) INTO _total_cities FROM public.kids_universe_cities;

  IF _visit_count >= _total_cities THEN
    PERFORM public.award_kids_achievement('city_wanderer');
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_kids_universe_visit(TEXT) TO authenticated;

-- ============================================================
-- Extend award_kids_xp / award_kids_coins with Phase 8 reasons.
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
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

-- ============================================================
-- Seed: 8 achievements, 8 Kids Universe cities + characters.
-- ============================================================
INSERT INTO public.kids_achievements (key, title, description, icon, reward_vx) VALUES
  ('event_explorer',    'Event Explorer',     'Attend your first live event.',                 'CalendarCheck', 20),
  ('workshop_graduate',  'Workshop Graduate',  'Complete 3 workshops.',                          'GraduationCap', 30),
  ('competition_star',   'Competition Star',   'Win a medal in a competition.',                  'Medal',         50),
  ('festival_fan',       'Festival Fan',       'Attend a seasonal event.',                       'PartyPopper',   20),
  ('city_wanderer',      'City Wanderer',      'Visit every city in the Kids Universe.',         'Map',           60),
  ('replay_watcher',     'Replay Watcher',     'Watch your first event replay.',                 'PlayCircle',    15),
  ('poll_participant',   'Poll Participant',   'Vote in a live event poll.',                     'BarChart3',     10),
  ('question_asker',     'Question Asker',     'Ask a question during a live event.',            'HelpCircle',    10)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.kids_universe_cities (slug, name, theme, emoji, color, description, order_index) VALUES
  ('science-city',  'Science City',   'science',   '🔬', 'secondary', 'A city full of experiments, discoveries, and curious minds.', 0),
  ('story-city',    'Story City',     'stories',   '📖', 'accent',    'Where every street has a tale to tell.',                      1),
  ('game-city',     'Game City',      'games',     '🎮', 'primary',   'Play, compete, and have fun with games of every kind.',       2),
  ('space-city',    'Space City',     'space',     '🚀', 'purple',    'Blast off to explore planets, stars, and beyond.',            3),
  ('music-city',    'Music City',     'music',     '🎵', 'green',     'A city that never stops singing and dancing.',                4),
  ('art-city',      'Art City',       'art',       '🎨', 'pink',      'Colorful streets full of paintings and creativity.',          5),
  ('code-city',     'Code City',      'coding',    '💻', 'primary',   'Where young coders build amazing things.',                    6),
  ('nature-city',   'Nature City',    'nature',    '🌳', 'green',     'A green city that celebrates plants, animals, and the Earth.', 7)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_universe_characters (city_slug, name, emoji, bio) VALUES
  ('science-city', 'Professor Fizz',   '🧑‍🔬', 'A cheerful scientist who loves bubbling experiments and big questions.'),
  ('science-city', 'Sparky',           '⚡',    'A tiny robot powered by curiosity and static electricity.'),
  ('story-city',   'Inkling',          '🖋️',   'A friendly ink drop who has read every book in Story City twice.'),
  ('game-city',    'Captain Combo',    '🕹️',   'The undefeated champion of Game City''s arcade.'),
  ('space-city',   'Luna',             '🌙',    'A brave young astronaut who has visited every planet in the solar system.'),
  ('music-city',   'Melody',           '🎶',    'A musical note come to life, always humming a new tune.'),
  ('art-city',     'Paintbrush Pip',   '🖌️',   'A walking paintbrush who sees color in everything.'),
  ('code-city',    'Byte',             '🤖',    'A friendly little robot who speaks in code and loves puzzles.'),
  ('nature-city',  'Sprout',           '🌱',    'A tiny plant sprite who cares for every tree and flower in town.')
ON CONFLICT DO NOTHING;
