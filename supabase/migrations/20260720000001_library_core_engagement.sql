-- ============================================================
-- Migration: Library core engagement (Phase 2 backend)
-- Purpose:   User interaction with the catalog created in
--            20260720000000_library_core_catalog.sql — reviews, favorites,
--            reading progress, reading lists, bookmarks, notes, highlights,
--            downloads. Also defines the triggers that keep library_books/
--            library_authors/library_categories denormalized counters
--            (rating_avg, rating_count, reviews_count, books_count,
--            book_count) in sync — the catalog migration intentionally
--            left these as plain columns with no maintenance trigger yet.
--
-- Tables added: library_reviews, library_favorites, library_reading_progress,
--   library_reading_lists, library_reading_list_items, library_bookmarks,
--   library_notes, library_highlights, library_downloads.
-- ============================================================

-- ============================================================
-- library_reviews (rating 1-5 required; comment optional — a "rating with
-- no review text" is just a row with comment IS NULL, same pattern as the
-- existing academy_course_reviews table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  likes_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)
);

ALTER TABLE public.library_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_reviews: public read"
  ON public.library_reviews FOR SELECT
  USING (true);

CREATE POLICY "library_reviews: authenticated creates own"
  ON public.library_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_library_book_published(book_id));

CREATE POLICY "library_reviews: owner updates own"
  ON public.library_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_reviews: owner/admin deletes"
  ON public.library_reviews FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_reviews_updated_at
  BEFORE UPDATE ON public.library_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_reviews_book ON public.library_reviews(book_id);
CREATE INDEX IF NOT EXISTS idx_library_reviews_user ON public.library_reviews(user_id);

-- ============================================================
-- library_shelf_items ("My Library" — books a user has explicitly added to
-- their personal shelf, e.g. a TBR list or "owned" marker; distinct from
-- library_favorites (hearted/liked books) and library_purchases (financial
-- record) — Phase 1's frontend already models these as three separate
-- concepts with separate pages/local-storage keys, see
-- src/lib/library/libraryLocalStore.ts's getShelfBookIds vs
-- getFavoriteBookIds).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_shelf_items (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

ALTER TABLE public.library_shelf_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_shelf_items: user manages own"
  ON public.library_shelf_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_shelf_items_book ON public.library_shelf_items(book_id);

-- ============================================================
-- library_favorites
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_favorites (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

ALTER TABLE public.library_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_favorites: user manages own"
  ON public.library_favorites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_favorites_book ON public.library_favorites(book_id);

-- ============================================================
-- library_reading_progress (consolidates "reading history" + "reading
-- progress" from the request into one row per user/book — see Phase 2
-- plan's "Scope decisions" for the reasoning)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_reading_progress (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id           UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  current_page      INTEGER,
  percent_complete  NUMERIC NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
  last_position     JSONB NOT NULL DEFAULT '{}'::jsonb, -- audio timestamp / epub CFI / etc.
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  PRIMARY KEY (user_id, book_id)
);

ALTER TABLE public.library_reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_reading_progress: user manages own"
  ON public.library_reading_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_reading_progress_book ON public.library_reading_progress(book_id);
CREATE INDEX IF NOT EXISTS idx_library_reading_progress_last_read ON public.library_reading_progress(user_id, last_read_at DESC);

-- ============================================================
-- library_reading_lists + library_reading_list_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_reading_lists (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  is_public         BOOLEAN NOT NULL DEFAULT false,
  cover_image_url   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_library_reading_list_visible(_list_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_reading_lists
    WHERE id = _list_id AND (is_public = true OR user_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.is_library_reading_list_owner(_list_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_reading_lists WHERE id = _list_id AND user_id = auth.uid()
  )
$$;

ALTER TABLE public.library_reading_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_reading_lists: read own or public"
  ON public.library_reading_lists FOR SELECT
  USING (auth.uid() = user_id OR is_public = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_reading_lists: owner manages own"
  ON public.library_reading_lists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER library_reading_lists_updated_at
  BEFORE UPDATE ON public.library_reading_lists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_reading_lists_user ON public.library_reading_lists(user_id);

CREATE TABLE IF NOT EXISTS public.library_reading_list_items (
  list_id       UUID NOT NULL REFERENCES public.library_reading_lists(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  order_index   INTEGER NOT NULL DEFAULT 0,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, book_id)
);

ALTER TABLE public.library_reading_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_reading_list_items: read if list visible"
  ON public.library_reading_list_items FOR SELECT
  USING (public.is_library_reading_list_visible(list_id));

CREATE POLICY "library_reading_list_items: owner manages own list"
  ON public.library_reading_list_items FOR ALL
  USING (public.is_library_reading_list_owner(list_id))
  WITH CHECK (public.is_library_reading_list_owner(list_id));

CREATE INDEX IF NOT EXISTS idx_library_reading_list_items_book ON public.library_reading_list_items(book_id);

-- ============================================================
-- library_bookmarks, library_notes, library_highlights
-- (all strictly private, same shape as academy_lesson_notes/bookmarks)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_bookmarks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  page_number   INTEGER,
  position      JSONB NOT NULL DEFAULT '{}'::jsonb,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_bookmarks: user manages own"
  ON public.library_bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_bookmarks_user ON public.library_bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_bookmarks_book ON public.library_bookmarks(book_id);

CREATE TABLE IF NOT EXISTS public.library_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  page_number   INTEGER,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_notes: user manages own"
  ON public.library_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER library_notes_updated_at
  BEFORE UPDATE ON public.library_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_notes_user ON public.library_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_notes_book ON public.library_notes(book_id);

CREATE TABLE IF NOT EXISTS public.library_highlights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  page_number   INTEGER,
  quoted_text   TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT 'yellow',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_highlights: user manages own"
  ON public.library_highlights FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_highlights_user ON public.library_highlights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_highlights_book ON public.library_highlights(book_id);

-- ============================================================
-- library_downloads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_downloads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id         UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  file_id         UUID REFERENCES public.library_book_files(id) ON DELETE SET NULL,
  downloaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_downloads: user reads own"
  ON public.library_downloads FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_downloads: user logs own accessible download"
  ON public.library_downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.can_access_library_book_content(book_id));

CREATE INDEX IF NOT EXISTS idx_library_downloads_user ON public.library_downloads(user_id, downloaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_downloads_book ON public.library_downloads(book_id);

-- ============================================================
-- Trigger: recompute library_books.rating_avg / rating_count / reviews_count
-- on every review write, and roll the change up into the book's author's
-- own rating_avg/rating_count (an average of that author's book ratings).
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_library_book_rating()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _book_id uuid := COALESCE(NEW.book_id, OLD.book_id);
  _author_id uuid;
BEGIN
  UPDATE public.library_books b
  SET rating_avg = agg.avg_rating,
      rating_count = agg.cnt,
      reviews_count = agg.cnt
  FROM (
    SELECT AVG(rating)::numeric AS avg_rating, COUNT(*) AS cnt
    FROM public.library_reviews WHERE book_id = _book_id
  ) agg
  WHERE b.id = _book_id
  RETURNING b.author_id INTO _author_id;

  IF _author_id IS NOT NULL THEN
    UPDATE public.library_authors a
    SET rating_avg = agg.avg_rating,
        rating_count = agg.cnt
    FROM (
      SELECT AVG(rating_avg)::numeric AS avg_rating, COALESCE(SUM(rating_count), 0) AS cnt
      FROM public.library_books WHERE author_id = _author_id AND rating_count > 0
    ) agg
    WHERE a.id = _author_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER library_reviews_recompute_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.library_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_library_book_rating();

-- ============================================================
-- Trigger: maintain library_authors.books_count and
-- library_categories.book_count as books are created/reassigned/deleted.
-- ============================================================
CREATE OR REPLACE FUNCTION public.maintain_library_book_counts()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.author_id IS NOT NULL THEN
      UPDATE public.library_authors SET books_count = books_count + 1 WHERE id = NEW.author_id;
    END IF;
    IF NEW.category_id IS NOT NULL THEN
      UPDATE public.library_categories SET book_count = book_count + 1 WHERE id = NEW.category_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.author_id IS NOT NULL THEN
      UPDATE public.library_authors SET books_count = GREATEST(books_count - 1, 0) WHERE id = OLD.author_id;
    END IF;
    IF OLD.category_id IS NOT NULL THEN
      UPDATE public.library_categories SET book_count = GREATEST(book_count - 1, 0) WHERE id = OLD.category_id;
    END IF;
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
      IF OLD.author_id IS NOT NULL THEN
        UPDATE public.library_authors SET books_count = GREATEST(books_count - 1, 0) WHERE id = OLD.author_id;
      END IF;
      IF NEW.author_id IS NOT NULL THEN
        UPDATE public.library_authors SET books_count = books_count + 1 WHERE id = NEW.author_id;
      END IF;
    END IF;
    IF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
      IF OLD.category_id IS NOT NULL THEN
        UPDATE public.library_categories SET book_count = GREATEST(book_count - 1, 0) WHERE id = OLD.category_id;
      END IF;
      IF NEW.category_id IS NOT NULL THEN
        UPDATE public.library_categories SET book_count = book_count + 1 WHERE id = NEW.category_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER library_books_maintain_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.library_books
  FOR EACH ROW EXECUTE FUNCTION public.maintain_library_book_counts();
