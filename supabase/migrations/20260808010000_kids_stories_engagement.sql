-- ============================================================
-- Migration: VisionKids Stories — engagement + reading stats
-- Purpose:   Per-user private data (ratings, bookmarks, highlights, notes,
--            reading progress/history, downloads, favorites, search
--            history, recently viewed) plus the reading-stats/streak
--            system, and the counter triggers that keep kids_stories'
--            denormalized rating_avg/likes_count/bookmarks_count/
--            downloads_count in sync.
--
-- Reused, not redefined: public.touch_updated_at(), public.has_role().
-- ============================================================

-- ============================================================
-- kids_story_ratings (rating + optional review — one row per user/story)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_story_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id    UUID NOT NULL REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, story_id)
);

ALTER TABLE public.kids_story_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_story_ratings: public read"
  ON public.kids_story_ratings FOR SELECT USING (true);

CREATE POLICY "kids_story_ratings: authenticated creates own"
  ON public.kids_story_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_story_ratings: owner updates own"
  ON public.kids_story_ratings FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_story_ratings: owner/admin deletes"
  ON public.kids_story_ratings FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kids_story_ratings_updated_at
  BEFORE UPDATE ON public.kids_story_ratings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_kids_story_ratings_story ON public.kids_story_ratings(story_id);

-- ============================================================
-- kids_bookmarks, kids_highlights, kids_notes (always private)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_bookmarks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id      UUID NOT NULL REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  page_number   INTEGER,
  position      JSONB NOT NULL DEFAULT '{}'::jsonb,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_bookmarks: user manages own"
  ON public.kids_bookmarks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_bookmarks_user ON public.kids_bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_bookmarks_story ON public.kids_bookmarks(story_id);

CREATE TABLE IF NOT EXISTS public.kids_highlights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id      UUID NOT NULL REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  page_number   INTEGER,
  quoted_text   TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT 'yellow',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_highlights: user manages own"
  ON public.kids_highlights FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_highlights_user ON public.kids_highlights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_highlights_story ON public.kids_highlights(story_id);

CREATE TABLE IF NOT EXISTS public.kids_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id      UUID NOT NULL REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  page_number   INTEGER,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_notes: user manages own"
  ON public.kids_notes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER kids_notes_updated_at
  BEFORE UPDATE ON public.kids_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_kids_notes_user ON public.kids_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_notes_story ON public.kids_notes(story_id);

-- ============================================================
-- kids_favorites
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id    UUID NOT NULL REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, story_id)
);

ALTER TABLE public.kids_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_favorites: user manages own"
  ON public.kids_favorites FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_favorites_user ON public.kids_favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_favorites_story ON public.kids_favorites(story_id);

-- ============================================================
-- kids_downloads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_downloads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id        UUID NOT NULL REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  format          TEXT NOT NULL CHECK (format IN ('pdf', 'epub', 'audio', 'video', 'brf')),
  downloaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_downloads: user reads own"
  ON public.kids_downloads FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_downloads: user logs own"
  ON public.kids_downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_downloads_user ON public.kids_downloads(user_id, downloaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_downloads_story ON public.kids_downloads(story_id);

-- ============================================================
-- kids_search_history / kids_recently_viewed
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_search_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_search_history: user manages own"
  ON public.kids_search_history FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_search_history_user ON public.kids_search_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.kids_recently_viewed (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id    UUID NOT NULL REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, story_id)
);

ALTER TABLE public.kids_recently_viewed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_recently_viewed: user manages own"
  ON public.kids_recently_viewed FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_recently_viewed_user ON public.kids_recently_viewed(user_id, viewed_at DESC);

-- ============================================================
-- kids_reading_stats (one row per user — totals + streak)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_reading_stats (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_stories_read  INTEGER NOT NULL DEFAULT 0,
  total_words_read    INTEGER NOT NULL DEFAULT 0,
  total_minutes_read  INTEGER NOT NULL DEFAULT 0,
  current_streak      INTEGER NOT NULL DEFAULT 0,
  longest_streak      INTEGER NOT NULL DEFAULT 0,
  last_read_date      DATE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_reading_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_reading_stats: user reads own"
  ON public.kids_reading_stats FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- No direct INSERT/UPDATE policy for regular users — this table is written
-- exclusively by the SECURITY DEFINER trigger below (kids_handle_progress_change),
-- which bypasses RLS. Prevents a user from hand-editing their own streak.

-- ============================================================
-- kids_reading_progress ("Continue Reading" + "History" + "Progress" —
-- one table for all three, same reasoning as library_reading_progress)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_reading_progress (
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id              UUID NOT NULL REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  current_page          INTEGER NOT NULL DEFAULT 1,
  current_node_id       UUID REFERENCES public.kids_story_nodes(id) ON DELETE SET NULL,
  audio_position_seconds INTEGER NOT NULL DEFAULT 0,
  progress_percent      NUMERIC(5,2) NOT NULL DEFAULT 0,
  minutes_read          INTEGER NOT NULL DEFAULT 0,
  completed             BOOLEAN NOT NULL DEFAULT false,
  last_read_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);

ALTER TABLE public.kids_reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_reading_progress: user manages own"
  ON public.kids_reading_progress FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_reading_progress_user ON public.kids_reading_progress(user_id, last_read_at DESC);

CREATE OR REPLACE FUNCTION public.kids_handle_progress_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _was_completed BOOLEAN := (TG_OP = 'UPDATE' AND OLD.completed);
  _old_minutes   INTEGER := CASE WHEN TG_OP = 'UPDATE' THEN OLD.minutes_read ELSE 0 END;
  _minutes_delta INTEGER;
  _word_count    INTEGER := 0;
  _last_date     DATE;
  _current_streak INTEGER;
  _longest_streak INTEGER;
BEGIN
  _minutes_delta := GREATEST(NEW.minutes_read - _old_minutes, 0);

  INSERT INTO public.kids_reading_stats (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF _minutes_delta > 0 THEN
    UPDATE public.kids_reading_stats
    SET total_minutes_read = total_minutes_read + _minutes_delta,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  IF NEW.completed AND NOT _was_completed THEN
    SELECT COALESCE(SUM(
      CASE WHEN length(trim(p.text_content)) = 0 THEN 0
           ELSE array_length(regexp_split_to_array(trim(p.text_content), '\s+'), 1)
      END
    ), 0)
    INTO _word_count
    FROM public.kids_story_pages p
    WHERE p.story_id = NEW.story_id;

    SELECT last_read_date, current_streak, longest_streak
    INTO _last_date, _current_streak, _longest_streak
    FROM public.kids_reading_stats WHERE user_id = NEW.user_id;

    IF _last_date = CURRENT_DATE THEN
      _current_streak := COALESCE(_current_streak, 1);
    ELSIF _last_date = (CURRENT_DATE - INTERVAL '1 day')::date THEN
      _current_streak := COALESCE(_current_streak, 0) + 1;
    ELSE
      _current_streak := 1;
    END IF;
    _longest_streak := GREATEST(COALESCE(_longest_streak, 0), _current_streak);

    UPDATE public.kids_reading_stats
    SET total_stories_read = total_stories_read + 1,
        total_words_read = total_words_read + _word_count,
        current_streak = _current_streak,
        longest_streak = _longest_streak,
        last_read_date = CURRENT_DATE,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER kids_reading_progress_stats
  AFTER INSERT OR UPDATE ON public.kids_reading_progress
  FOR EACH ROW EXECUTE FUNCTION public.kids_handle_progress_change();

-- ============================================================
-- Denormalized counter triggers on kids_stories
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_kids_story_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _story_id UUID := COALESCE(NEW.story_id, OLD.story_id);
BEGIN
  UPDATE public.kids_stories s
  SET rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.kids_story_ratings WHERE story_id = _story_id), 0),
      rating_count = (SELECT COUNT(*) FROM public.kids_story_ratings WHERE story_id = _story_id)
  WHERE s.id = _story_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER kids_story_ratings_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.kids_story_ratings
  FOR EACH ROW EXECUTE FUNCTION public.recompute_kids_story_rating();

CREATE OR REPLACE FUNCTION public.recompute_kids_story_count(_column TEXT, _story_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _column = 'likes_count' THEN
    UPDATE public.kids_stories SET likes_count = (SELECT COUNT(*) FROM public.kids_favorites WHERE story_id = _story_id) WHERE id = _story_id;
  ELSIF _column = 'bookmarks_count' THEN
    UPDATE public.kids_stories SET bookmarks_count = (SELECT COUNT(*) FROM public.kids_bookmarks WHERE story_id = _story_id) WHERE id = _story_id;
  ELSIF _column = 'downloads_count' THEN
    UPDATE public.kids_stories SET downloads_count = (SELECT COUNT(*) FROM public.kids_downloads WHERE story_id = _story_id) WHERE id = _story_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.kids_favorites_recompute()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_kids_story_count('likes_count', COALESCE(NEW.story_id, OLD.story_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER kids_favorites_count AFTER INSERT OR DELETE ON public.kids_favorites
  FOR EACH ROW EXECUTE FUNCTION public.kids_favorites_recompute();

CREATE OR REPLACE FUNCTION public.kids_bookmarks_recompute()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_kids_story_count('bookmarks_count', COALESCE(NEW.story_id, OLD.story_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER kids_bookmarks_count AFTER INSERT OR DELETE ON public.kids_bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.kids_bookmarks_recompute();

CREATE OR REPLACE FUNCTION public.kids_downloads_recompute()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_kids_story_count('downloads_count', NEW.story_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER kids_downloads_count AFTER INSERT ON public.kids_downloads
  FOR EACH ROW EXECUTE FUNCTION public.kids_downloads_recompute();

-- ============================================================
-- RPC: increment_kids_story_views — callable by anyone (incl. anon
-- readers), SECURITY DEFINER so it can bump the counter without granting
-- broad UPDATE on kids_stories. Frontend calls this once per story open,
-- client-side throttled (see useStoryDetails).
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_kids_story_views(_story_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.kids_stories SET views_count = views_count + 1 WHERE id = _story_id AND status = 'published';
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_kids_story_views(UUID) TO anon, authenticated;
