-- ============================================================
-- Migration: VisionKids Games — sessions/scores, favorites, player stats,
-- XP ledger + level curve, and game ratings.
--
-- Achievements are NOT re-tabled here — kids_achievements/
-- kids_user_achievements/award_kids_achievement() already exist from the
-- Stories migration (20260808020000) and were deliberately named
-- generically (not "kids_story_achievements"), so games reuse them as-is;
-- new game-related achievement rows are just seeded into the same table
-- (see the next migration). One achievements system for all of VisionKids.
--
-- "Coins" are NOT a new currency either — public.user_points (the real VX
-- wallet, same one Stories' award_kids_xp already writes to) is reused and
-- labeled "VisionKids Coins" in the kids UI. "Level"/"XP" ARE new here
-- (kids_xp_events + kids_level_for_xp) because they're VisionKids-specific
-- progression, not part of the platform-wide VX balance.
--
-- Reused, not redefined: public.touch_updated_at(), public.has_role().
-- ============================================================

-- ============================================================
-- kids_xp_events — audit log backing the VisionKids level system.
-- Insert-only via award_kids_xp() (SECURITY DEFINER, extended below).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_xp_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_xp_events: user reads own"
  ON public.kids_xp_events FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_xp_events_user ON public.kids_xp_events(user_id, created_at DESC);

-- Level 1-100 from total XP. A simple monotonic curve (each level needs a
-- bit more XP than the last) — not meant to be tuned precisely, just real
-- and capped.
CREATE OR REPLACE FUNCTION public.kids_level_for_xp(_xp INTEGER)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$
  SELECT LEAST(100, GREATEST(1, FLOOR(SQRT(GREATEST(_xp, 0) / 25.0))::INTEGER + 1));
$$;

-- Extends the Stories-phase award_kids_xp (20260808020000) with game/
-- challenge/achievement reasons, and — new in this migration — also
-- writes to kids_xp_events (Stories' version only wrote to user_points;
-- the level system didn't exist yet). CREATE OR REPLACE is safe: RLS/
-- grants and every existing call site keep working unchanged.
CREATE OR REPLACE FUNCTION public.award_kids_xp(_amount INTEGER, _reason TEXT)
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
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN
    RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason;
  END IF;

  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);

  INSERT INTO public.kids_xp_events(user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_kids_xp(INTEGER, TEXT) TO authenticated;

-- Coins-only credit — does NOT touch kids_xp_events, so it never inflates
-- the level curve. Games have two independent reward columns (xp_reward,
-- coins_reward): xp_reward goes through award_kids_xp (credits the wallet
-- AND raises level), coins_reward goes through this function (credits the
-- wallet only) — that's two genuinely different reward channels into the
-- same real wallet, not a double-credit of the same amount.
CREATE OR REPLACE FUNCTION public.award_kids_coins(_amount INTEGER, _reason TEXT)
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
    WHEN _reason LIKE 'Game completed:%'   THEN _max_amount := 20;
    WHEN _reason LIKE 'Daily challenge:%'  THEN _max_amount := 15;
    WHEN _reason LIKE 'Weekly challenge:%' THEN _max_amount := 50;
    WHEN _reason LIKE 'Daily login:%'      THEN _max_amount := 10;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN
    RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason;
  END IF;

  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_kids_coins(INTEGER, TEXT) TO authenticated;

-- ============================================================
-- kids_game_sessions — one row per play. A completed session IS the score
-- entry (no separate "scores" table — same non-duplication reasoning as
-- library_reading_progress covering both "progress" and "history").
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_game_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id           UUID NOT NULL REFERENCES public.kids_games(id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  score             INTEGER NOT NULL DEFAULT 0,
  lives_used        INTEGER NOT NULL DEFAULT 0,
  hints_used        INTEGER NOT NULL DEFAULT 0,
  duration_seconds  INTEGER NOT NULL DEFAULT 0,
  won               BOOLEAN NOT NULL DEFAULT false,
  completed         BOOLEAN NOT NULL DEFAULT false,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.kids_game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_game_sessions: user manages own"
  ON public.kids_game_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Leaderboards need to read everyone's completed sessions, not just the
-- caller's own — but only the fields a leaderboard needs, via a
-- security_invoker view (defined after kids_player_game_stats below) so
-- direct table access stays owner-only.
CREATE INDEX IF NOT EXISTS idx_kids_game_sessions_user ON public.kids_game_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_game_sessions_game_score ON public.kids_game_sessions(game_id, score DESC) WHERE completed = true;

-- ============================================================
-- kids_game_favorites
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_game_favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id     UUID NOT NULL REFERENCES public.kids_games(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);

ALTER TABLE public.kids_game_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_game_favorites: user manages own"
  ON public.kids_game_favorites FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_game_favorites_user ON public.kids_game_favorites(user_id, created_at DESC);

-- ============================================================
-- kids_player_game_stats — one row per user, the "Game Profile" numbers.
-- Best score per game is NOT duplicated here — it's a query over
-- kids_game_sessions (see useGameProfile / the leaderboard view).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_player_game_stats (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  games_played        INTEGER NOT NULL DEFAULT 0,
  wins                INTEGER NOT NULL DEFAULT 0,
  total_play_seconds  INTEGER NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_player_game_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_player_game_stats: public read"
  ON public.kids_player_game_stats FOR SELECT USING (true);
-- Public (not owner-only) so leaderboards/friends' profiles can show it —
-- same visibility model as kids_reading_stats' own equivalent... except
-- that one IS owner-only. This one is intentionally public: "games played"
-- and "wins" are exactly the kind of flex a kids leaderboard needs to show
-- for OTHER players, not just yourself.

-- No direct INSERT/UPDATE policy — written exclusively by the
-- SECURITY DEFINER trigger below, same reasoning as kids_reading_stats.

CREATE OR REPLACE FUNCTION public.kids_handle_game_session_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _was_completed BOOLEAN := (TG_OP = 'UPDATE' AND OLD.completed);
  _is_first_completion_for_game BOOLEAN;
BEGIN
  IF NOT (NEW.completed AND NOT _was_completed) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.kids_player_game_stats (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.kids_player_game_stats
  SET games_played = games_played + 1,
      wins = wins + CASE WHEN NEW.won THEN 1 ELSE 0 END,
      total_play_seconds = total_play_seconds + GREATEST(NEW.duration_seconds, 0),
      updated_at = now()
  WHERE user_id = NEW.user_id;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.kids_game_sessions
    WHERE user_id = NEW.user_id AND game_id = NEW.game_id AND completed = true AND id <> NEW.id
  ) INTO _is_first_completion_for_game;

  IF _is_first_completion_for_game THEN
    UPDATE public.kids_games SET players_count = players_count + 1 WHERE id = NEW.game_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER kids_game_sessions_stats
  AFTER INSERT OR UPDATE ON public.kids_game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.kids_handle_game_session_change();

-- Public leaderboard read of sessions — only the columns a leaderboard
-- needs, keyed by a joined display concept the frontend already has
-- (profiles). security_invoker so it still enforces the querying user's
-- own RLS on the underlying table rather than the view owner's.
CREATE OR REPLACE VIEW public.kids_game_leaderboard_entries
WITH (security_invoker = true) AS
SELECT user_id, game_id, MAX(score) AS best_score, MAX(started_at) AS last_played_at
FROM public.kids_game_sessions
WHERE completed = true
GROUP BY user_id, game_id;

-- ============================================================
-- kids_game_ratings (mirrors kids_story_ratings exactly)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_game_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id     UUID NOT NULL REFERENCES public.kids_games(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);

ALTER TABLE public.kids_game_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_game_ratings: public read"
  ON public.kids_game_ratings FOR SELECT USING (true);

CREATE POLICY "kids_game_ratings: authenticated creates own"
  ON public.kids_game_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_game_ratings: owner updates own"
  ON public.kids_game_ratings FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER kids_game_ratings_updated_at
  BEFORE UPDATE ON public.kids_game_ratings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.recompute_kids_game_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _game_id UUID := COALESCE(NEW.game_id, OLD.game_id);
BEGIN
  UPDATE public.kids_games g
  SET rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.kids_game_ratings WHERE game_id = _game_id), 0),
      rating_count = (SELECT COUNT(*) FROM public.kids_game_ratings WHERE game_id = _game_id)
  WHERE g.id = _game_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER kids_game_ratings_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.kids_game_ratings
  FOR EACH ROW EXECUTE FUNCTION public.recompute_kids_game_rating();

-- ============================================================
-- kids_game_favorites -> denormalized nothing needed on kids_games (no
-- "likes_count" field was requested for games, unlike stories).
-- ============================================================
