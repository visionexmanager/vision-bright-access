-- ============================================================
-- Migration: VisionKids — Smart Stories Library, catalog (Phase 2 backend)
-- Purpose:   Real Supabase tables for the /kids/stories section — categories,
--            authors, narrators, stories, pages, chapters, interactive
--            branching nodes/choices, and quizzes. Frontend lives under
--            src/features/visionkids/{pages,components,hooks,services}/stories.
--
-- Reused, not redefined: public.touch_updated_at() (updated_at trigger),
--   public.has_role(auth.uid(), 'admin') (admin check) — both defined by
--   earlier migrations (library_core_catalog.sql and the base schema).
--
-- Full-text search: 'simple' config, same reasoning as library_core_catalog —
-- platform content is multilingual and 'english' stemming/stopwords would
-- mishandle non-English titles.
--
-- Table prefix kids_story_* / kids_stories deliberately separate from
-- library_* — a VisionKids "story" and a Library "book" are different
-- entities with different audiences and lifecycle, not a shared table.
-- ============================================================

-- ============================================================
-- kids_story_categories — the 18 fixed VisionKids story categories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_story_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  color           TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  story_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_story_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_story_categories: public reads active"
  ON public.kids_story_categories FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_story_categories: admins manage"
  ON public.kids_story_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kids_story_categories_updated_at
  BEFORE UPDATE ON public.kids_story_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_kids_story_categories_order ON public.kids_story_categories(display_order);

COMMENT ON TABLE public.kids_story_categories IS 'The 18 fixed VisionKids story categories. story_count is denormalized, maintained by trigger below.';

-- ============================================================
-- kids_story_authors / kids_story_narrators
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_story_authors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  bio         TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_story_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_story_authors: public read"
  ON public.kids_story_authors FOR SELECT USING (true);

CREATE POLICY "kids_story_authors: admins manage"
  ON public.kids_story_authors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kids_story_authors_updated_at
  BEFORE UPDATE ON public.kids_story_authors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.kids_story_narrators (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  bio               TEXT,
  avatar_url        TEXT,
  voice_sample_url  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_story_narrators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_story_narrators: public read"
  ON public.kids_story_narrators FOR SELECT USING (true);

CREATE POLICY "kids_story_narrators: admins manage"
  ON public.kids_story_narrators FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kids_story_narrators_updated_at
  BEFORE UPDATE ON public.kids_story_narrators
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- kids_stories — the central table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_stories (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    TEXT NOT NULL UNIQUE,
  title                   TEXT NOT NULL,
  subtitle                TEXT,
  description             TEXT,
  author_id               UUID REFERENCES public.kids_story_authors(id) ON DELETE SET NULL,
  narrator_id             UUID REFERENCES public.kids_story_narrators(id) ON DELETE SET NULL,
  translator              TEXT,
  age_group               TEXT NOT NULL DEFAULT '6-8' CHECK (age_group IN ('3-5', '6-8', '9-12')),
  difficulty              TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  language                TEXT NOT NULL DEFAULT 'en',
  duration_minutes        INTEGER,
  reading_time_minutes    INTEGER,
  page_count              INTEGER NOT NULL DEFAULT 0,
  cover_image_url         TEXT,
  gallery                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  audio_url               TEXT,
  video_url               TEXT,
  pdf_url                 TEXT,
  epub_url                TEXT,
  brf_url                 TEXT,
  tags                    TEXT[] NOT NULL DEFAULT '{}',
  category_id             UUID REFERENCES public.kids_story_categories(id) ON DELETE SET NULL,
  rating_avg              NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count            INTEGER NOT NULL DEFAULT 0,
  likes_count             INTEGER NOT NULL DEFAULT 0,
  bookmarks_count         INTEGER NOT NULL DEFAULT 0,
  downloads_count         INTEGER NOT NULL DEFAULT 0,
  views_count             INTEGER NOT NULL DEFAULT 0,
  published_at            TIMESTAMPTZ,
  accessibility_features  JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_interactive          BOOLEAN NOT NULL DEFAULT false,
  is_ai_generated         BOOLEAN NOT NULL DEFAULT false,
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  search_vector           TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(tags, ' ')), 'B')
  ) STORED,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_stories: public reads published"
  ON public.kids_stories FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_stories: admins manage"
  ON public.kids_stories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kids_stories_updated_at
  BEFORE UPDATE ON public.kids_stories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_kids_stories_category ON public.kids_stories(category_id);
CREATE INDEX IF NOT EXISTS idx_kids_stories_status ON public.kids_stories(status);
CREATE INDEX IF NOT EXISTS idx_kids_stories_age_group ON public.kids_stories(age_group);
CREATE INDEX IF NOT EXISTS idx_kids_stories_language ON public.kids_stories(language);
CREATE INDEX IF NOT EXISTS idx_kids_stories_tags ON public.kids_stories USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_kids_stories_search ON public.kids_stories USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_kids_stories_published_at ON public.kids_stories(published_at DESC);

COMMENT ON TABLE public.kids_stories IS 'Central VisionKids story catalog. rating_avg/rating_count/likes_count/bookmarks_count/downloads_count/views_count are denormalized, maintained by triggers/RPCs in the engagement migration.';

-- Keep kids_story_categories.story_count in sync
CREATE OR REPLACE FUNCTION public.bump_kids_story_category_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.category_id IS NOT NULL AND NEW.status = 'published' THEN
      UPDATE public.kids_story_categories SET story_count = story_count + 1 WHERE id = NEW.category_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.category_id IS NOT NULL AND OLD.status = 'published' THEN
      UPDATE public.kids_story_categories SET story_count = GREATEST(story_count - 1, 0) WHERE id = OLD.category_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.category_id IS NOT DISTINCT FROM NEW.category_id AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
      RETURN NEW;
    END IF;
    IF OLD.category_id IS NOT NULL AND OLD.status = 'published' THEN
      UPDATE public.kids_story_categories SET story_count = GREATEST(story_count - 1, 0) WHERE id = OLD.category_id;
    END IF;
    IF NEW.category_id IS NOT NULL AND NEW.status = 'published' THEN
      UPDATE public.kids_story_categories SET story_count = story_count + 1 WHERE id = NEW.category_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER kids_stories_category_count
  AFTER INSERT OR UPDATE OR DELETE ON public.kids_stories
  FOR EACH ROW EXECUTE FUNCTION public.bump_kids_story_category_count();

-- ============================================================
-- kids_story_chapters (audio player chapters + reader TOC anchors)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_story_chapters (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id              UUID NOT NULL REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  chapter_number        INTEGER NOT NULL,
  title                 TEXT NOT NULL,
  start_page            INTEGER NOT NULL DEFAULT 1,
  audio_start_seconds   INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, chapter_number)
);

ALTER TABLE public.kids_story_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_story_chapters: readable if story readable"
  ON public.kids_story_chapters FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_stories s
    WHERE s.id = story_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_story_chapters: admins manage"
  ON public.kids_story_chapters FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_story_chapters_story ON public.kids_story_chapters(story_id, chapter_number);

-- ============================================================
-- kids_story_pages (linear reader content — one row per page)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_story_pages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id              UUID NOT NULL REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  chapter_id            UUID REFERENCES public.kids_story_chapters(id) ON DELETE SET NULL,
  page_number           INTEGER NOT NULL,
  text_content          TEXT NOT NULL DEFAULT '',
  image_url             TEXT,
  audio_start_seconds   INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, page_number)
);

ALTER TABLE public.kids_story_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_story_pages: readable if story readable"
  ON public.kids_story_pages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_stories s
    WHERE s.id = story_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_story_pages: admins manage"
  ON public.kids_story_pages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_story_pages_story ON public.kids_story_pages(story_id, page_number);

-- ============================================================
-- kids_story_nodes / kids_story_choices (interactive branching stories)
-- A node with no choices AND is_ending=true is a terminal ending.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_story_nodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id      UUID NOT NULL REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  node_key      TEXT NOT NULL,
  text_content  TEXT NOT NULL DEFAULT '',
  image_url     TEXT,
  audio_url     TEXT,
  is_start      BOOLEAN NOT NULL DEFAULT false,
  is_ending     BOOLEAN NOT NULL DEFAULT false,
  ending_type   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, node_key)
);

ALTER TABLE public.kids_story_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_story_nodes: readable if story readable"
  ON public.kids_story_nodes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_stories s
    WHERE s.id = story_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_story_nodes: admins manage"
  ON public.kids_story_nodes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_story_nodes_story ON public.kids_story_nodes(story_id);

CREATE TABLE IF NOT EXISTS public.kids_story_choices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id       UUID NOT NULL REFERENCES public.kids_story_nodes(id) ON DELETE CASCADE,
  choice_text   TEXT NOT NULL,
  next_node_id  UUID REFERENCES public.kids_story_nodes(id) ON DELETE SET NULL,
  order_index   INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.kids_story_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_story_choices: readable if node readable"
  ON public.kids_story_choices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_story_nodes n
    JOIN public.kids_stories s ON s.id = n.story_id
    WHERE n.id = node_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_story_choices: admins manage"
  ON public.kids_story_choices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_story_choices_node ON public.kids_story_choices(node_id, order_index);

-- ============================================================
-- kids_quizzes / kids_quiz_questions (one quiz per story, optional)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_quizzes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id    UUID NOT NULL UNIQUE REFERENCES public.kids_stories(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Story Quiz',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_quizzes: readable if story readable"
  ON public.kids_quizzes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_stories s
    WHERE s.id = story_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_quizzes: admins manage"
  ON public.kids_quizzes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.kids_quiz_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         UUID NOT NULL REFERENCES public.kids_quizzes(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('multiple_choice', 'true_false', 'vocabulary', 'memory')),
  question        TEXT NOT NULL,
  options         JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer  TEXT NOT NULL,
  explanation     TEXT,
  order_index     INTEGER NOT NULL DEFAULT 0,
  points          INTEGER NOT NULL DEFAULT 10
);

ALTER TABLE public.kids_quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_quiz_questions: readable if quiz readable"
  ON public.kids_quiz_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_quizzes q
    JOIN public.kids_stories s ON s.id = q.story_id
    WHERE q.id = quiz_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_quiz_questions: admins manage"
  ON public.kids_quiz_questions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_quiz_questions_quiz ON public.kids_quiz_questions(quiz_id, order_index);

-- ============================================================
-- Seed: the 18 fixed VisionKids categories
-- ============================================================
INSERT INTO public.kids_story_categories (slug, name, icon, color, display_order) VALUES
  ('adventure',     'Adventure',     'Compass',        'primary',   1),
  ('animals',       'Animals',       'Dog',             'green',     2),
  ('science',       'Science',       'FlaskConical',    'secondary', 3),
  ('space',         'Space',         'Rocket',          'accent',    4),
  ('fantasy',       'Fantasy',       'Wand2',           'purple',    5),
  ('friendship',    'Friendship',    'Users',           'pink',      6),
  ('school',        'School',        'GraduationCap',   'primary',   7),
  ('family',        'Family',        'Home',            'secondary', 8),
  ('nature',        'Nature',        'Trees',           'green',     9),
  ('history',       'History',       'Landmark',        'accent',    10),
  ('religion',      'Religion',      'BookHeart',       'purple',    11),
  ('bedtime',       'Bedtime',       'Moon',            'pink',      12),
  ('educational',   'Educational',   'GraduationCap',   'primary',   13),
  ('languages',     'Languages',     'Languages',       'secondary', 14),
  ('interactive',   'Interactive',   'GitBranch',       'accent',    15),
  ('comics',        'Comics',        'BookOpenText',    'purple',    16),
  ('mystery',       'Mystery',       'Search',          'pink',      17),
  ('inspirational', 'Inspirational', 'Sparkles',        'green',     18)
ON CONFLICT (slug) DO NOTHING;
