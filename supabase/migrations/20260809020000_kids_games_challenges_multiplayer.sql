-- ============================================================
-- Migration: VisionKids Games — daily/weekly challenges, season events,
-- multiplayer rooms, storage, and seed content (achievements + this
-- week's challenges + season events).
--
-- Anti-cheat note: challenge/session progress is written by the client
-- (same trust model as kids_reading_progress in Stories) — there is no
-- server-side gameplay replay validation in this pass. That's a real gap
-- for a public leaderboard and is called out explicitly in the delivery
-- notes, not hidden.
-- ============================================================

-- ============================================================
-- kids_daily_challenges / kids_user_daily_challenge_progress
-- 3 new challenges per day (challenge_date), any signed-in user can attempt them.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_daily_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date  DATE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  game_id         UUID REFERENCES public.kids_games(id) ON DELETE SET NULL,
  target_type     TEXT NOT NULL CHECK (target_type IN ('play_game', 'score_at_least', 'win_count', 'complete_any_game')),
  target_value    INTEGER NOT NULL DEFAULT 1,
  reward_xp       INTEGER NOT NULL DEFAULT 15,
  reward_coins    INTEGER NOT NULL DEFAULT 10,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_daily_challenges: public read"
  ON public.kids_daily_challenges FOR SELECT USING (true);

CREATE POLICY "kids_daily_challenges: admins manage"
  ON public.kids_daily_challenges FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_daily_challenges_date ON public.kids_daily_challenges(challenge_date);

CREATE TABLE IF NOT EXISTS public.kids_user_daily_challenge_progress (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id  UUID NOT NULL REFERENCES public.kids_daily_challenges(id) ON DELETE CASCADE,
  current_value INTEGER NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, challenge_id)
);

ALTER TABLE public.kids_user_daily_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_user_daily_challenge_progress: user manages own"
  ON public.kids_user_daily_challenge_progress FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- kids_weekly_challenges / kids_user_weekly_challenge_progress
-- 7 challenges per week (week_start = the Monday of that week).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_weekly_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start      DATE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  game_id         UUID REFERENCES public.kids_games(id) ON DELETE SET NULL,
  target_type     TEXT NOT NULL CHECK (target_type IN ('play_game', 'score_at_least', 'win_count', 'complete_any_game')),
  target_value    INTEGER NOT NULL DEFAULT 1,
  reward_xp       INTEGER NOT NULL DEFAULT 60,
  reward_coins    INTEGER NOT NULL DEFAULT 30,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_weekly_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_weekly_challenges: public read"
  ON public.kids_weekly_challenges FOR SELECT USING (true);

CREATE POLICY "kids_weekly_challenges: admins manage"
  ON public.kids_weekly_challenges FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_weekly_challenges_week ON public.kids_weekly_challenges(week_start);

CREATE TABLE IF NOT EXISTS public.kids_user_weekly_challenge_progress (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id  UUID NOT NULL REFERENCES public.kids_weekly_challenges(id) ON DELETE CASCADE,
  current_value INTEGER NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, challenge_id)
);

ALTER TABLE public.kids_user_weekly_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_user_weekly_challenge_progress: user manages own"
  ON public.kids_user_weekly_challenge_progress FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- kids_season_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_season_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  theme_color   TEXT,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  region_gated  BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_season_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_season_events: public read active"
  ON public.kids_season_events FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_season_events: admins manage"
  ON public.kids_season_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- kids_multiplayer_rooms / kids_multiplayer_room_players
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_multiplayer_rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  host_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id       UUID REFERENCES public.kids_games(id) ON DELETE SET NULL,
  room_name     TEXT NOT NULL DEFAULT 'Quiz Battle',
  is_public     BOOLEAN NOT NULL DEFAULT true,
  max_players   INTEGER NOT NULL DEFAULT 4 CHECK (max_players BETWEEN 2 AND 8),
  status        TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'finished')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_multiplayer_rooms ENABLE ROW LEVEL SECURITY;

-- The SELECT policy for kids_multiplayer_rooms reads kids_multiplayer_room_players,
-- so it is declared after that table exists — see below.

CREATE POLICY "kids_multiplayer_rooms: authenticated creates own"
  ON public.kids_multiplayer_rooms FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "kids_multiplayer_rooms: host updates own"
  ON public.kids_multiplayer_rooms FOR UPDATE
  USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

CREATE POLICY "kids_multiplayer_rooms: host deletes own"
  ON public.kids_multiplayer_rooms FOR DELETE
  USING (auth.uid() = host_id);

CREATE INDEX IF NOT EXISTS idx_kids_multiplayer_rooms_public ON public.kids_multiplayer_rooms(is_public, status) WHERE status = 'waiting';

CREATE TABLE IF NOT EXISTS public.kids_multiplayer_room_players (
  room_id     UUID NOT NULL REFERENCES public.kids_multiplayer_rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_ready    BOOLEAN NOT NULL DEFAULT false,
  score       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE public.kids_multiplayer_room_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_multiplayer_room_players: read fellow room members"
  ON public.kids_multiplayer_room_players FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kids_multiplayer_room_players me
      WHERE me.room_id = kids_multiplayer_room_players.room_id AND me.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.kids_multiplayer_rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
  );

CREATE POLICY "kids_multiplayer_room_players: user joins as self"
  ON public.kids_multiplayer_room_players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_multiplayer_room_players: user updates own"
  ON public.kids_multiplayer_room_players FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_multiplayer_room_players: user leaves own"
  ON public.kids_multiplayer_room_players FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_multiplayer_room_players_room ON public.kids_multiplayer_room_players(room_id);

-- Deferred from the kids_multiplayer_rooms block above: this policy reads
-- kids_multiplayer_room_players, which only exists as of the statement above.
CREATE POLICY "kids_multiplayer_rooms: read public or own membership"
  ON public.kids_multiplayer_rooms FOR SELECT
  USING (
    is_public = true
    OR host_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kids_multiplayer_room_players p
      WHERE p.room_id = kids_multiplayer_rooms.id AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- Storage: kids-games-media (thumbnails/gallery/preview videos)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kids-games-media', 'kids-games-media', true,
  52428800,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','video/mp4']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "kids_games_media_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'kids-games-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_games_media_admin_write"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'kids-games-media' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_games_media_admin_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'kids-games-media' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Seed: game achievements (added to Stories' shared kids_achievements table)
-- ============================================================
INSERT INTO public.kids_achievements (key, title, description, icon, reward_vx) VALUES
  ('first_game',       'First Play!',        'Complete your very first game.',            'Gamepad2', 10),
  ('five_games',       'Getting Good',        'Complete 5 games.',                          'Medal',    20),
  ('ten_games',        'Game Master',         'Complete 10 games.',                         'Trophy',   40),
  ('perfect_score',    'Perfect Score',       'Get a perfect score in any game.',           'Star',     20),
  ('quiz_battle_win',  'Battle Champion',     'Win a multiplayer Quiz Battle.',              'Swords',   25)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Seed: today's 3 daily challenges + this week's 7 weekly challenges.
-- Uses CURRENT_DATE / the current week's Monday so the seed is always
-- "today" relative to whenever this migration actually runs.
-- ============================================================
INSERT INTO public.kids_daily_challenges (challenge_date, title, description, target_type, target_value, reward_xp, reward_coins) VALUES
  (CURRENT_DATE, 'Play 3 Games',        'Complete any 3 games today.',           'complete_any_game', 3,  15, 10),
  (CURRENT_DATE, 'Score 50+',           'Score at least 50 points in one game.', 'score_at_least',     50, 20, 12),
  (CURRENT_DATE, 'Win a Game',          'Win any game today.',                   'win_count',          1,  25, 15)
ON CONFLICT DO NOTHING;

INSERT INTO public.kids_weekly_challenges (week_start, title, description, target_type, target_value, reward_xp, reward_coins) VALUES
  (date_trunc('week', CURRENT_DATE)::date, 'Complete 10 Games',   'Complete 10 games this week.',       'complete_any_game', 10, 60,  30),
  (date_trunc('week', CURRENT_DATE)::date, 'Win 5 Games',         'Win 5 games this week.',              'win_count',          5,  70,  35),
  (date_trunc('week', CURRENT_DATE)::date, 'Score 200+',          'Score at least 200 in one game.',     'score_at_least',     200,80,  40),
  (date_trunc('week', CURRENT_DATE)::date, 'Try 5 Different Games','Play 5 different games this week.',  'complete_any_game', 5,  50,  25),
  (date_trunc('week', CURRENT_DATE)::date, 'Memory Master',       'Complete Memory Cards 3 times.',      'complete_any_game', 3,  40,  20),
  (date_trunc('week', CURRENT_DATE)::date, 'Math Whiz',           'Complete Math Challenge 3 times.',    'complete_any_game', 3,  40,  20),
  (date_trunc('week', CURRENT_DATE)::date, 'Weekend Warrior',     'Complete 5 games this weekend.',      'complete_any_game', 5,  60,  30)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed: season events (Halloween marked region_gated — the frontend
-- decides whether to show it based on the platform's existing
-- region/locale settings, not something this migration can determine).
-- ============================================================
INSERT INTO public.kids_season_events (key, title, description, icon, theme_color, starts_at, ends_at, region_gated) VALUES
  ('ramadan',          'Ramadan Kareem',       'Special Ramadan-themed challenges and rewards.', 'Moon',    'purple',   '2027-02-08', '2027-03-09', false),
  ('eid',               'Eid Celebration',      'Celebrate Eid with festive challenges.',         'Sparkles','accent',   '2027-03-09', '2027-03-13', false),
  ('new-year',          'New Year Celebration', 'Ring in the new year with special rewards.',     'PartyPopper','primary','2026-12-28','2027-01-03', false),
  ('summer',            'Summer Fun',            'Summer-themed games and bonus rewards.',        'Sun',     'secondary','2027-06-01', '2027-08-31', false),
  ('back-to-school',    'Back to School',        'Get ready for school with learning challenges.', 'GraduationCap','green','2026-08-15','2026-09-15', false),
  ('halloween',         'Spooky Season',         'Halloween-themed games (optional per region).', 'Ghost',   'purple',   '2026-10-20', '2026-11-01', true)
ON CONFLICT (key) DO NOTHING;
