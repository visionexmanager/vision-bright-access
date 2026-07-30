-- ============================================================
-- Migration: VisionKids Creative Studio — weekly challenges, achievements,
-- XP/coins reasons, seed content.
--
-- Reused, not redefined: public.has_role(), public.award_kids_xp(),
-- public.award_kids_coins(), public.kids_achievements (shared across
-- Stories/Games/Academy/Studio — see that table's own comment history).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kids_creative_challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start    DATE NOT NULL,
  prompt_type   TEXT NOT NULL CHECK (prompt_type IN (
    'story', 'book', 'drawing', 'character', 'comic', 'sticker', 'music', 'voice', 'video', 'cartoon_scene'
  )),
  title         TEXT NOT NULL,
  description   TEXT,
  reward_xp     INTEGER NOT NULL DEFAULT 30,
  reward_coins  INTEGER NOT NULL DEFAULT 15,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_creative_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_creative_challenges: public read"
  ON public.kids_creative_challenges FOR SELECT USING (true);

CREATE POLICY "kids_creative_challenges: admins manage"
  ON public.kids_creative_challenges FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_creative_challenges_week ON public.kids_creative_challenges(week_start);

CREATE TABLE IF NOT EXISTS public.kids_creative_challenge_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES public.kids_creative_challenges(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES public.kids_creative_projects(id) ON DELETE CASCADE,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE public.kids_creative_challenge_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_creative_challenge_submissions: public read"
  ON public.kids_creative_challenge_submissions FOR SELECT USING (true);

CREATE POLICY "kids_creative_challenge_submissions: user manages own"
  ON public.kids_creative_challenge_submissions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_creative_challenge_submissions_challenge ON public.kids_creative_challenge_submissions(challenge_id);

-- ============================================================
-- Extend award_kids_xp / award_kids_coins with Studio reasons.
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
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

-- ============================================================
-- Seed: creative achievements (shared kids_achievements table)
-- ============================================================
INSERT INTO public.kids_achievements (key, title, description, icon, reward_vx) VALUES
  ('best_artist',      'Best Artist',      'Save 5 drawings or stickers.',              'Palette',      20),
  ('best_author',      'Best Author',      'Save 5 stories or books.',                  'BookOpen',     20),
  ('best_musician',    'Best Musician',    'Save 5 music creations.',                   'Music',        20),
  ('top_creator',      'Top Creator',      'Save 20 creative projects of any kind.',    'Sparkles',     40),
  ('creativity_badge', 'Creativity Badge', 'Complete your first Creative Challenge.',   'Award',        25)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Seed: this week's 5 creative challenges (matching the brief's own
-- examples). Uses date_trunc('week', CURRENT_DATE) same as Games' weekly
-- challenges seed, so it's always "this week" relative to when this
-- migration actually runs.
-- ============================================================
INSERT INTO public.kids_creative_challenges (week_start, prompt_type, title, description, reward_xp, reward_coins) VALUES
  (date_trunc('week', CURRENT_DATE)::date, 'drawing',   'Draw a New Planet',        'Design a planet nobody has ever seen before!',      30, 15),
  (date_trunc('week', CURRENT_DATE)::date, 'story',     'A Story About Friendship', 'Write a short story about two friends helping each other.', 30, 15),
  (date_trunc('week', CURRENT_DATE)::date, 'character', 'Create a Superhero',       'Build your very own superhero character.',           30, 15),
  (date_trunc('week', CURRENT_DATE)::date, 'music',     'Compose a Short Song',     'Make a short, happy tune using the Music Studio.',   30, 15),
  (date_trunc('week', CURRENT_DATE)::date, 'sticker',   'Design a Sticker',         'Create a fun sticker to share with friends.',        30, 15)
ON CONFLICT DO NOTHING;
