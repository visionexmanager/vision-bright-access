-- ============================================================
-- Migration: Library Book Details support (Phase 5 backend gap-fill)
-- Purpose:   Same additive pattern as Phases 3/4 — two nullable columns the
--            Book Details header needs but nothing in the schema has yet,
--            two small "own-state toggle" tables (mirroring
--            library_favorites exactly), and one aggregate RPC for
--            "readers who favorited this also favorited…" (needs to read
--            across ALL users' library_favorites, which is RLS'd to
--            own-rows-only — same reasoning as every prior aggregate RPC).
--
-- Added: library_books.age_category, library_books.difficulty_level,
--   library_review_likes, library_saved_quotes,
--   get_library_readers_also_read().
-- ============================================================

ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS age_category TEXT,
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced'));

COMMENT ON COLUMN public.library_books.age_category IS 'Free-text age category (e.g. "children", "young-adult", "adult") — no fixed catalog exists yet, admin-authored.';
COMMENT ON COLUMN public.library_books.difficulty_level IS 'Reading difficulty, shown on the Book Details header.';

-- ============================================================
-- library_review_likes — per-user "liked this review" toggle state.
-- library_reviews.likes_count already exists but nothing tracked *who*
-- liked what, so it could only ever increment. Mirrors library_favorites'
-- exact shape (composite PK, "user manages own" RLS).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_review_likes (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_id     UUID NOT NULL REFERENCES public.library_reviews(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, review_id)
);

ALTER TABLE public.library_review_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_review_likes: user manages own"
  ON public.library_review_likes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_review_likes_review ON public.library_review_likes(review_id);

CREATE OR REPLACE FUNCTION public.recompute_library_review_likes()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _review_id uuid := COALESCE(NEW.review_id, OLD.review_id);
BEGIN
  UPDATE public.library_reviews
  SET likes_count = (SELECT COUNT(*) FROM public.library_review_likes WHERE review_id = _review_id)
  WHERE id = _review_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER library_review_likes_recompute
  AFTER INSERT OR DELETE ON public.library_review_likes
  FOR EACH ROW EXECUTE FUNCTION public.recompute_library_review_likes();

-- ============================================================
-- library_saved_quotes — per-user "saved this quote" toggle state, same
-- shape/reasoning as library_review_likes above.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_saved_quotes (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id      UUID NOT NULL REFERENCES public.library_quotes(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quote_id)
);

ALTER TABLE public.library_saved_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_saved_quotes: user manages own"
  ON public.library_saved_quotes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_saved_quotes_quote ON public.library_saved_quotes(quote_id);

-- ============================================================
-- get_library_readers_also_read — "readers who favorited this book also
-- favorited…", ranked by co-favorite frequency. Aggregates across ALL
-- users' library_favorites (own-rows-only RLS), so this must be a
-- SECURITY DEFINER function, same as get_library_trending_books.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_library_readers_also_read(_book_id uuid, _limit integer DEFAULT 8)
RETURNS SETOF public.library_books
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.*
  FROM public.library_books b
  JOIN (
    SELECT f2.book_id, COUNT(*) AS co_favorite_count
    FROM public.library_favorites f1
    JOIN public.library_favorites f2 ON f2.user_id = f1.user_id AND f2.book_id != f1.book_id
    WHERE f1.book_id = _book_id
    GROUP BY f2.book_id
  ) co ON co.book_id = b.id
  WHERE b.publish_status = 'published'
  ORDER BY co.co_favorite_count DESC
  LIMIT _limit
$$;

COMMENT ON FUNCTION public.get_library_readers_also_read IS 'Books co-favorited by users who also favorited _book_id, ranked by frequency. Aggregates library_favorites (own-rows-only RLS) into a public-safe ranked list — no per-user favorite data is exposed.';

GRANT EXECUTE ON FUNCTION public.get_library_readers_also_read(uuid, integer) TO anon, authenticated;
