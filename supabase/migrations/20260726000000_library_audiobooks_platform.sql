-- ============================================================
-- Migration: Library Audiobooks Platform (Phase 7)
--
-- Purpose: turn the Phase-2 audiobook stub (one row per book, single audio
-- file, free-text narrator, no chapters, no listening analytics) into a
-- real platform: a normalized narrator entity, per-audiobook chapters
-- (mirroring library_chapters), daily listening-time/streak aggregation,
-- a new challenge goal type for listening minutes, and four narrow
-- SECURITY DEFINER RPCs. No new storage bucket (library-audiobooks already
-- exists), no new generic RLS helper — every policy below reuses
-- can_access_library_book_content / is_library_book_owner / has_role
-- exactly as they already exist.
--
-- Tables added: library_narrators, library_audiobook_chapters,
--   library_listening_daily_stats.
-- Tables altered: library_audiobooks (+narrator_id, +chapter_count),
--   library_challenges (goal_type CHECK gains 'listening_minutes').
-- Functions added: get_library_narrator_stats, get_library_listening_stats,
--   record_library_listening_heartbeat, get_library_most_listened_books,
--   library_audiobook_chapters_set_book_id() (trigger fn),
--   recompute_library_audiobook_duration() (trigger fn).
-- Functions extended (CREATE OR REPLACE, same signature): award_library_xp,
--   check_ai_rate_limit.
-- ============================================================

-- ============================================================
-- library_narrators — normalized narrator profiles. Mirrors
-- library_authors' "claimed profile" pattern: user_id is nullable, set
-- only once a real account links to this row.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_narrators (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  bio           TEXT,
  photo_url     TEXT,
  languages     TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.library_narrators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_narrators: public read"
  ON public.library_narrators FOR SELECT
  USING (true);

CREATE POLICY "library_narrators: owner updates own"
  ON public.library_narrators FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_narrators: admins insert/delete"
  ON public.library_narrators FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_narrators: admins delete"
  ON public.library_narrators FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_narrators_updated_at
  BEFORE UPDATE ON public.library_narrators
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_narrators_user ON public.library_narrators(user_id);

COMMENT ON TABLE public.library_narrators IS 'Narrator profiles (photo/bio/languages). Admin-created, optionally self-claimed via user_id. book_count/rating are computed on demand via get_library_narrator_stats(), not denormalized.';

-- ============================================================
-- library_audiobooks — add narrator_id (kept alongside the existing
-- free-text narrator_name for backward compat / unclaimed narrators) and
-- a trigger-maintained chapter_count.
-- ============================================================
ALTER TABLE public.library_audiobooks
  ADD COLUMN IF NOT EXISTS narrator_id UUID REFERENCES public.library_narrators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chapter_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_library_audiobooks_narrator ON public.library_audiobooks(narrator_id);

-- ============================================================
-- library_audiobook_chapters — mirrors library_chapters' shape exactly.
-- book_id is denormalized for RLS/index performance and is ALWAYS
-- server-set from the parent audiobook via trigger below, never trusted
-- from client input.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_audiobook_chapters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audiobook_id      UUID NOT NULL REFERENCES public.library_audiobooks(id) ON DELETE CASCADE,
  book_id           UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  chapter_number    INTEGER NOT NULL,
  title             TEXT,
  audio_file_id     UUID REFERENCES public.library_book_files(id) ON DELETE SET NULL,
  duration_seconds  INTEGER NOT NULL DEFAULT 0,
  order_index       INTEGER NOT NULL DEFAULT 0,
  is_free_preview   BOOLEAN NOT NULL DEFAULT false,
  is_ai_generated   BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audiobook_id, chapter_number)
);

ALTER TABLE public.library_audiobook_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_audiobook_chapters: read if free preview or accessible"
  ON public.library_audiobook_chapters FOR SELECT
  USING (
    is_free_preview = true
    OR public.can_access_library_book_content(book_id)
  );

CREATE POLICY "library_audiobook_chapters: author/admin manage"
  ON public.library_audiobook_chapters FOR ALL
  USING (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_audiobook_chapters_audiobook ON public.library_audiobook_chapters(audiobook_id, order_index);
CREATE INDEX IF NOT EXISTS idx_library_audiobook_chapters_book ON public.library_audiobook_chapters(book_id);

COMMENT ON TABLE public.library_audiobook_chapters IS 'Per-chapter audio files for an audiobook. book_id is denormalized (server-set by trigger) purely for fast RLS/index lookups — always derived from audiobook_id, never client-supplied.';

-- Always overwrite book_id from the parent, ignoring any client value.
CREATE OR REPLACE FUNCTION public.library_audiobook_chapters_set_book_id()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SELECT book_id INTO NEW.book_id FROM public.library_audiobooks WHERE id = NEW.audiobook_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER library_audiobook_chapters_set_book_id
  BEFORE INSERT OR UPDATE ON public.library_audiobook_chapters
  FOR EACH ROW EXECUTE FUNCTION public.library_audiobook_chapters_set_book_id();

-- Keeps the parent audiobook's duration_seconds/chapter_count in sync with
-- its chapters, but ONLY once at least one chapter row exists — a
-- single-file legacy audiobook (zero chapter rows) keeps its own
-- manually-set duration_seconds untouched, preserving today's model.
CREATE OR REPLACE FUNCTION public.recompute_library_audiobook_duration()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _audiobook_id UUID := COALESCE(NEW.audiobook_id, OLD.audiobook_id);
  _count INTEGER;
  _total INTEGER;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(duration_seconds), 0)
    INTO _count, _total
    FROM public.library_audiobook_chapters
    WHERE audiobook_id = _audiobook_id;

  IF _count > 0 THEN
    UPDATE public.library_audiobooks
    SET chapter_count = _count, duration_seconds = _total
    WHERE id = _audiobook_id;
  ELSE
    UPDATE public.library_audiobooks SET chapter_count = 0 WHERE id = _audiobook_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER recompute_library_audiobook_duration
  AFTER INSERT OR UPDATE OR DELETE ON public.library_audiobook_chapters
  FOR EACH ROW EXECUTE FUNCTION public.recompute_library_audiobook_duration();

-- ============================================================
-- library_listening_daily_stats — user+day granularity only (no book_id):
-- exists purely to answer "hours / avg speed / streak," not "which book."
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_listening_daily_stats (
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stat_date           DATE NOT NULL DEFAULT current_date,
  seconds_listened    INTEGER NOT NULL DEFAULT 0,
  avg_playback_rate   NUMERIC(3,2),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stat_date)
);

ALTER TABLE public.library_listening_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_listening_daily_stats: user manages own"
  ON public.library_listening_daily_stats FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_listening_daily_stats: admin reads"
  ON public.library_listening_daily_stats FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_listening_daily_stats_user_date ON public.library_listening_daily_stats(user_id, stat_date DESC);

COMMENT ON TABLE public.library_listening_daily_stats IS 'One row per user per calendar day of listening activity — powers total hours / avg speed / streak. Deliberately book-agnostic; "most-listened books" is answered separately via get_library_most_listened_books() over analytics events.';

-- ============================================================
-- library_challenges.goal_type — add 'listening_minutes', kept distinct
-- from 'minutes_read' so a listening challenge can't be satisfied by
-- text-reading minutes or vice versa.
-- ============================================================
ALTER TABLE public.library_challenges DROP CONSTRAINT IF EXISTS library_challenges_goal_type_check;
ALTER TABLE public.library_challenges
  ADD CONSTRAINT library_challenges_goal_type_check
  CHECK (goal_type IN ('books_count', 'pages_count', 'minutes_read', 'listening_minutes'));

-- ============================================================
-- award_library_xp — extended reason whitelist. Every existing WHEN branch
-- preserved verbatim (this function has real callers today —
-- useQuizAttempts.ts, useFlashcardDeck.ts — so correctness here is not
-- optional). One new branch for listening streaks; finishing an audiobook
-- reuses the existing 'Book completed:%' branch as-is since
-- library_reading_progress.completed_at is already format-agnostic.
-- ============================================================
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
    WHEN _reason LIKE 'Book completed:%'      THEN _max_amount := 100;
    WHEN _reason LIKE 'Review written:%'      THEN _max_amount := 25;
    WHEN _reason LIKE 'Reading streak:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'Challenge completed:%' THEN _max_amount := 300;
    WHEN _reason LIKE 'Daily reading goal:%'  THEN _max_amount := 20;
    WHEN _reason LIKE 'Summary completed:%'   THEN _max_amount := 10;
    WHEN _reason LIKE 'Quiz completed:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'Flashcards created:%'  THEN _max_amount := 15;
    WHEN _reason LIKE 'Weekly reading goal:%' THEN _max_amount := 40;
    WHEN _reason LIKE 'Listening streak:%'    THEN _max_amount := 50;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN
    RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason;
  END IF;

  INSERT INTO public.library_xp_events(user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);

  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_library_xp(INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.award_library_xp IS 'Self-only, amount-capped VX award for Library actions. Phase 7 added the Listening-streak reason; audiobook completion reuses the existing Book-completed reason (format-agnostic by design).';

-- ============================================================
-- check_ai_rate_limit — extended with a daily cap for the new narration
-- edge function. Every existing WHEN branch preserved verbatim.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _user_id      UUID,
  _function_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _daily_count  BIGINT;
  _daily_limit  INTEGER;
BEGIN
  _daily_limit := CASE _function_name
    WHEN 'ai-chat'              THEN 60
    WHEN 'academy-chat'         THEN 60
    WHEN 'ocr-scan'             THEN 20
    WHEN 'radar-ai'             THEN 20
    WHEN 'analyze-meal'         THEN 20
    WHEN 'generate-diet-plan'   THEN 10
    WHEN 'realtime-session'     THEN 10
    WHEN 'enrich-product'       THEN 50
    WHEN 'library-ai-assistant' THEN 40
    WHEN 'library-ai-chat'      THEN 60
    WHEN 'library-generate-narration' THEN 20
    ELSE 30
  END;

  SELECT COUNT(*) INTO _daily_count
  FROM public.ai_usage_log
  WHERE user_id       = _user_id
    AND function_name = _function_name
    AND created_at   >= current_date::timestamptz
    AND created_at   <  (current_date + interval '1 day')::timestamptz;

  IF _daily_count >= _daily_limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_usage_log (user_id, function_name)
  VALUES (_user_id, _function_name);

  DELETE FROM public.ai_usage_log
  WHERE user_id = _user_id
    AND created_at < now() - interval '48 hours';

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO service_role;

-- ============================================================
-- get_library_narrator_stats — public aggregate, no auth.uid() dependency.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_library_narrator_stats(_narrator_id uuid)
RETURNS TABLE (
  book_count    INTEGER,
  rating_avg    NUMERIC,
  rating_count  INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COUNT(*)::INTEGER,
    AVG(b.rating_avg),
    COALESCE(SUM(b.rating_count), 0)::INTEGER
  FROM public.library_audiobooks a
  JOIN public.library_books b ON b.id = a.book_id
  WHERE a.narrator_id = _narrator_id AND b.publish_status = 'published'
$$;

COMMENT ON FUNCTION public.get_library_narrator_stats IS 'Public, on-demand narrator stats (book count, average/aggregate rating across their published audiobooks) — not denormalized onto library_narrators.';

GRANT EXECUTE ON FUNCTION public.get_library_narrator_stats(uuid) TO anon, authenticated;

-- ============================================================
-- get_library_listening_stats — self-scoped listening summary.
-- Streak is computed via a bounded backward day-walk (capped at 3650
-- iterations) rather than a window-function trick, for readability.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_library_listening_stats()
RETURNS TABLE (
  total_seconds_listened  BIGINT,
  total_books_completed   INTEGER,
  avg_playback_rate       NUMERIC,
  current_streak_days     INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _total_seconds BIGINT;
  _avg_rate NUMERIC;
  _books_completed INTEGER;
  _streak INTEGER := 0;
  _cursor DATE;
  _iterations INTEGER := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT COALESCE(SUM(seconds_listened), 0), AVG(avg_playback_rate)
    INTO _total_seconds, _avg_rate
    FROM public.library_listening_daily_stats
    WHERE user_id = _user_id;

  SELECT COUNT(*)
    INTO _books_completed
    FROM public.library_reading_progress rp
    JOIN public.library_books b ON b.id = rp.book_id
    WHERE rp.user_id = _user_id
      AND rp.completed_at IS NOT NULL
      AND b.book_type IN ('audiobook', 'hybrid');

  SELECT MAX(stat_date) INTO _cursor
    FROM public.library_listening_daily_stats
    WHERE user_id = _user_id AND seconds_listened > 0;

  WHILE _cursor IS NOT NULL AND _iterations < 3650 LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.library_listening_daily_stats
      WHERE user_id = _user_id AND stat_date = _cursor AND seconds_listened > 0
    );
    _streak := _streak + 1;
    _cursor := _cursor - INTERVAL '1 day';
    _iterations := _iterations + 1;
  END LOOP;

  RETURN QUERY SELECT _total_seconds, _books_completed, _avg_rate, _streak;
END;
$$;

COMMENT ON FUNCTION public.get_library_listening_stats IS 'Self-scoped listening summary (hours, completed audiobooks, avg speed, consecutive-day streak). Streak = a bounded backward walk over library_listening_daily_stats, not a window function, for legibility.';

GRANT EXECUTE ON FUNCTION public.get_library_listening_stats() TO authenticated;

-- ============================================================
-- record_library_listening_heartbeat — self-scoped, throttled client-side
-- to roughly once per 20s of ACTIVE playback (never on seek/scrub).
-- Clamps the delta rather than rejecting it outright, to tolerate
-- legitimate tab-suspend/resume gaps without breaking UX.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_library_listening_heartbeat(
  _seconds_delta INTEGER,
  _rate NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _clamped INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF _seconds_delta <= 0 THEN
    RETURN;
  END IF;

  _clamped := LEAST(_seconds_delta, 120);

  INSERT INTO public.library_listening_daily_stats (user_id, stat_date, seconds_listened, avg_playback_rate)
  VALUES (_user_id, current_date, _clamped, _rate)
  ON CONFLICT (user_id, stat_date) DO UPDATE
    SET seconds_listened = public.library_listening_daily_stats.seconds_listened + EXCLUDED.seconds_listened,
        avg_playback_rate = COALESCE(EXCLUDED.avg_playback_rate, public.library_listening_daily_stats.avg_playback_rate),
        updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.record_library_listening_heartbeat IS 'Self-scoped incremental listening-time write, called throttled (~1/20s of active playback) by the player engine. Kept separate from library_reading_progress position tracking — seeking must never count as new listening time.';

GRANT EXECUTE ON FUNCTION public.record_library_listening_heartbeat(INTEGER, NUMERIC) TO authenticated;

-- ============================================================
-- get_library_most_listened_books — public, read-only aggregate over
-- library_analytics_events (whose own RLS is self/admin-only SELECT, so a
-- SECURITY DEFINER wrapper is required for this to be publicly queryable).
-- Activates the previously-dormant 'listening_started' event type; the
-- player engine must actually log that event on play-start.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_library_most_listened_books(_limit integer DEFAULT 12)
RETURNS TABLE (
  book_id       UUID,
  listen_count  BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT entity_id, COUNT(*)
  FROM public.library_analytics_events
  WHERE event_type = 'listening_started'
    AND entity_id IS NOT NULL
    AND created_at >= now() - INTERVAL '30 days'
  GROUP BY entity_id
  ORDER BY COUNT(*) DESC
  LIMIT GREATEST(_limit, 1)
$$;

COMMENT ON FUNCTION public.get_library_most_listened_books IS '30-day rolling "most listened" ranking from the listening_started analytics event — not a lifetime denormalized counter.';

GRANT EXECUTE ON FUNCTION public.get_library_most_listened_books(integer) TO anon, authenticated;
