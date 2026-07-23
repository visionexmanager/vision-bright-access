-- ============================================================
-- Migration: Library core catalog (Phase 2 backend)
-- Purpose:   Real Supabase tables for the Library section's book catalog —
--            categories, publishers, authors, books, files, audiobooks,
--            chapters, tags, quotes. Phase 1 (frontend) shipped this
--            section against mock data in src/services/library/*.ts —
--            this migration is the real backend those services will be
--            rewired to call in Phase 3. Not to be confused with
--            academy_lms's own "academy_library" (course study resources,
--            see 20260706000000_academy_lms_core.sql) — entirely separate
--            entity, separate table prefix, no relationship.
--
-- Tables added: library_categories, library_publishers, library_authors,
--   library_books, library_book_files, library_audiobooks,
--   library_chapters, library_tags, library_book_tags, library_quotes.
--
-- Reused, not redefined: public.touch_updated_at() (updated_at trigger),
--   public.has_role(auth.uid(), 'admin') (admin check).
--
-- Full-text search: uses the 'simple' text search config (not 'english')
-- because platform content is multilingual (Arabic/English/etc.) and
-- 'english' stemming/stopwords would mishandle non-English titles.
--
-- Purchase-gated content access: public.can_access_library_book_content()
-- is defined here WITHOUT a purchases check (library_purchases doesn't
-- exist yet — created in 20260720000002_library_core_commerce_
-- gamification.sql). It is CREATE OR REPLACE'd in that later migration to
-- add the purchase check. RLS policies call the function by name at
-- evaluation time, so this upgrade applies transparently to every policy
-- defined against it here — no need to touch those policies again.
-- ============================================================

-- ============================================================
-- library_categories (hierarchical via self-referencing parent_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID REFERENCES public.library_categories(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  icon            TEXT,
  image_url       TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  book_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_categories: public reads active"
  ON public.library_categories FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_categories: admins manage"
  ON public.library_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_categories_updated_at
  BEFORE UPDATE ON public.library_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_categories_parent ON public.library_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_library_categories_display_order ON public.library_categories(display_order);

COMMENT ON TABLE public.library_categories IS 'Hierarchical book categories (parent_id self-reference). book_count is denormalized, maintained by trigger in library_core_engagement.sql.';

-- ============================================================
-- library_publishers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_publishers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  logo_url      TEXT,
  website_url   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_publishers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_publishers: public read"
  ON public.library_publishers FOR SELECT
  USING (true);

CREATE POLICY "library_publishers: admins manage"
  ON public.library_publishers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_publishers_updated_at
  BEFORE UPDATE ON public.library_publishers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- library_authors
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_authors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- nullable: set when an author account claims/is linked to this profile
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  bio             TEXT,
  photo_url       TEXT,
  nationality     TEXT,
  birth_year      INTEGER,
  website_url     TEXT,
  social_links    JSONB NOT NULL DEFAULT '{}'::jsonb,
  books_count     INTEGER NOT NULL DEFAULT 0,
  follower_count  INTEGER NOT NULL DEFAULT 0,
  rating_avg      NUMERIC,
  rating_count    INTEGER NOT NULL DEFAULT 0,
  search_vector   TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(bio, '')), 'B')
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.library_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_authors: public read"
  ON public.library_authors FOR SELECT
  USING (true);

CREATE POLICY "library_authors: owner updates own"
  ON public.library_authors FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_authors: admins manage all"
  ON public.library_authors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_authors_updated_at
  BEFORE UPDATE ON public.library_authors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_authors_user ON public.library_authors(user_id);
CREATE INDEX IF NOT EXISTS idx_library_authors_search ON public.library_authors USING GIN(search_vector);

COMMENT ON TABLE public.library_authors IS 'Author profiles. user_id is set only when a real account has claimed/been linked to this author (enables "author edits own books" RLS via is_library_book_owner()).';

-- ============================================================
-- library_books
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_books (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    TEXT NOT NULL UNIQUE,
  title                   TEXT NOT NULL,
  subtitle                TEXT,
  description             TEXT NOT NULL DEFAULT '',
  description_long        TEXT,
  author_id               UUID NOT NULL REFERENCES public.library_authors(id) ON DELETE RESTRICT,
  publisher_id            UUID REFERENCES public.library_publishers(id) ON DELETE SET NULL,
  category_id             UUID REFERENCES public.library_categories(id) ON DELETE SET NULL,
  language                TEXT NOT NULL DEFAULT 'en',
  page_count              INTEGER,
  reading_time_minutes    INTEGER,
  published_date          DATE,
  isbn                    TEXT UNIQUE,
  keywords                TEXT[] NOT NULL DEFAULT '{}',
  book_type               TEXT NOT NULL DEFAULT 'ebook' CHECK (book_type IN ('ebook','audiobook','physical','hybrid')),
  is_free                 BOOLEAN NOT NULL DEFAULT false,
  price_vx                INTEGER CHECK (price_vx IS NULL OR price_vx >= 0),
  price_usd               NUMERIC(10,2) CHECK (price_usd IS NULL OR price_usd >= 0),
  cover_image_url         TEXT,
  publish_status          TEXT NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft','published','archived')),
  lending_copies_total    INTEGER CHECK (lending_copies_total IS NULL OR lending_copies_total >= 0),
  views_count             INTEGER NOT NULL DEFAULT 0,
  downloads_count         INTEGER NOT NULL DEFAULT 0,
  likes_count             INTEGER NOT NULL DEFAULT 0,
  reviews_count           INTEGER NOT NULL DEFAULT 0,
  rating_avg              NUMERIC,
  rating_count            INTEGER NOT NULL DEFAULT 0,
  search_vector           TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(keywords, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) STORED,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT library_books_paid_has_price CHECK (is_free = true OR price_vx IS NOT NULL OR price_usd IS NOT NULL)
);

-- ── Helper functions (SECURITY DEFINER — avoid RLS recursion, same pattern
--    as public.has_role / public.is_academy_course_owner). ─────────────────

CREATE OR REPLACE FUNCTION public.is_library_book_owner(_book_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_books b
    JOIN public.library_authors a ON a.id = b.author_id
    WHERE b.id = _book_id AND a.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_library_book_published(_book_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_books WHERE id = _book_id AND publish_status = 'published'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_library_book_free(_book_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_books
    WHERE id = _book_id AND is_free = true AND publish_status = 'published'
  )
$$;

-- Upgraded in 20260720000002_library_core_commerce_gamification.sql to also
-- check library_purchases once that table exists. See migration header note.
CREATE OR REPLACE FUNCTION public.can_access_library_book_content(_book_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_library_book_free(_book_id)
    OR public.is_library_book_owner(_book_id)
    OR public.has_role(auth.uid(), 'admin')
$$;

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_books: public reads published"
  ON public.library_books FOR SELECT
  USING (
    publish_status = 'published'
    OR public.is_library_book_owner(id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "library_books: author/admin manage"
  ON public.library_books FOR ALL
  USING (public.is_library_book_owner(id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_library_book_owner(id) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_books_updated_at
  BEFORE UPDATE ON public.library_books
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_books_author ON public.library_books(author_id);
CREATE INDEX IF NOT EXISTS idx_library_books_publisher ON public.library_books(publisher_id);
CREATE INDEX IF NOT EXISTS idx_library_books_category ON public.library_books(category_id);
CREATE INDEX IF NOT EXISTS idx_library_books_status ON public.library_books(publish_status);
CREATE INDEX IF NOT EXISTS idx_library_books_type ON public.library_books(book_type);
CREATE INDEX IF NOT EXISTS idx_library_books_free ON public.library_books(is_free);
CREATE INDEX IF NOT EXISTS idx_library_books_rating ON public.library_books(rating_avg DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_library_books_published_date ON public.library_books(published_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_library_books_search ON public.library_books USING GIN(search_vector);

COMMENT ON TABLE public.library_books IS 'The book catalog. publish_status=published is the only publicly browsable state; content access (files/chapters) is separately gated by can_access_library_book_content().';

-- ============================================================
-- library_book_files (per-format files: pdf/epub/txt/docx/brf/audio)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_book_files (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id           UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  file_type         TEXT NOT NULL CHECK (file_type IN ('pdf','epub','txt','docx','brf','audio')),
  storage_path      TEXT NOT NULL,
  file_url          TEXT,
  file_size_bytes   BIGINT,
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_book_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_book_files: read if accessible"
  ON public.library_book_files FOR SELECT
  USING (public.can_access_library_book_content(book_id));

CREATE POLICY "library_book_files: author/admin manage"
  ON public.library_book_files FOR ALL
  USING (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_book_files_book ON public.library_book_files(book_id);

-- ============================================================
-- library_audiobooks (audio-edition metadata; the underlying file lives in
-- library_book_files — audiobooks carry narrator/duration a plain file
-- row doesn't need)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_audiobooks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id           UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  audio_file_id     UUID REFERENCES public.library_book_files(id) ON DELETE SET NULL,
  narrator_name     TEXT,
  duration_seconds  INTEGER NOT NULL DEFAULT 0,
  sample_url        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id)
);

ALTER TABLE public.library_audiobooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_audiobooks: public reads if book visible"
  ON public.library_audiobooks FOR SELECT
  USING (
    public.is_library_book_published(book_id)
    OR public.is_library_book_owner(book_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "library_audiobooks: author/admin manage"
  ON public.library_audiobooks FOR ALL
  USING (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_audiobooks_updated_at
  BEFORE UPDATE ON public.library_audiobooks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_audiobooks_book ON public.library_audiobooks(book_id);

COMMENT ON TABLE public.library_audiobooks IS 'Audio-edition metadata (row is publicly visible like the book itself — sample_url is meant to be freely listenable); the gated full audio file is looked up via audio_file_id -> library_book_files, which is separately access-controlled.';

-- ============================================================
-- library_chapters (books split into chapters)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_chapters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id           UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  chapter_number    INTEGER NOT NULL,
  title             TEXT,
  content_text      TEXT,
  content_url       TEXT,
  page_start        INTEGER,
  page_end          INTEGER,
  duration_seconds  INTEGER,
  is_free_preview   BOOLEAN NOT NULL DEFAULT false,
  order_index       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, chapter_number)
);

ALTER TABLE public.library_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_chapters: read if free preview or accessible"
  ON public.library_chapters FOR SELECT
  USING (
    is_free_preview = true
    OR public.can_access_library_book_content(book_id)
  );

CREATE POLICY "library_chapters: author/admin manage"
  ON public.library_chapters FOR ALL
  USING (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_chapters_book ON public.library_chapters(book_id, order_index);

-- ============================================================
-- library_tags + library_book_tags (junction)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  slug          TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_tags: public read"
  ON public.library_tags FOR SELECT
  USING (true);

CREATE POLICY "library_tags: admins manage"
  ON public.library_tags FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.library_book_tags (
  book_id     UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES public.library_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);

ALTER TABLE public.library_book_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_book_tags: public read"
  ON public.library_book_tags FOR SELECT
  USING (true);

CREATE POLICY "library_book_tags: author/admin manage"
  ON public.library_book_tags FOR ALL
  USING (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_book_tags_tag ON public.library_book_tags(tag_id);

-- ============================================================
-- library_quotes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id         UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  page_number     INTEGER,
  likes_count     INTEGER NOT NULL DEFAULT 0,
  submitted_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_approved     BOOLEAN NOT NULL DEFAULT true,
  search_vector   TSVECTOR GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(text, '')), 'A')) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_quotes: public reads approved"
  ON public.library_quotes FOR SELECT
  USING (
    is_approved = true
    OR auth.uid() = submitted_by
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "library_quotes: authenticated submits own"
  ON public.library_quotes FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "library_quotes: owner/admin updates"
  ON public.library_quotes FOR UPDATE
  USING (auth.uid() = submitted_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = submitted_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_quotes: owner/admin deletes"
  ON public.library_quotes FOR DELETE
  USING (auth.uid() = submitted_by OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_quotes_book ON public.library_quotes(book_id);
CREATE INDEX IF NOT EXISTS idx_library_quotes_search ON public.library_quotes USING GIN(search_vector);

-- ============================================================
-- Combined ranked search across books + authors (full-text, weighted).
-- The frontend's LibrarySearch page (Phase 3) will call this instead of
-- client-side filtering.
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_library_books(_query text, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
RETURNS SETOF public.library_books
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.*
  FROM public.library_books b
  LEFT JOIN public.library_authors a ON a.id = b.author_id
  WHERE b.publish_status = 'published'
    AND (
      b.search_vector @@ websearch_to_tsquery('simple', _query)
      OR a.search_vector @@ websearch_to_tsquery('simple', _query)
    )
  ORDER BY
    ts_rank(b.search_vector, websearch_to_tsquery('simple', _query)) +
    coalesce(ts_rank(a.search_vector, websearch_to_tsquery('simple', _query)), 0) DESC,
    b.rating_avg DESC NULLS LAST
  LIMIT _limit OFFSET _offset
$$;

COMMENT ON FUNCTION public.search_library_books IS 'Ranked full-text search across published books, matching on the book''s own title/subtitle/keywords/description OR its author''s name/bio.';
