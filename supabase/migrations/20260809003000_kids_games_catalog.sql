-- ============================================================
-- Migration: VisionKids — Educational Games Platform, catalog (Phase 3)
-- Purpose:   kids_game_categories (15, seeded) and kids_games (the central
--            catalog table), seeded with metadata for all 20 requested
--            launch games. Only a subset ship with a real playable
--            implementation at launch (engine_key set); the rest have
--            engine_key = NULL and the frontend registry renders a
--            "coming soon" placeholder for them — same pattern as
--            VisionKidsSection did for the 16 home sections in Phase 1.
--            Adding the 21st..500th game later is a DB row + a new
--            self-contained folder under src/features/visionkids/games/,
--            never a restructure.
--
-- Reused, not redefined: public.touch_updated_at(), public.has_role(),
--   public.library_immutable_array_to_string() — array_to_string() is only
--   STABLE and cannot appear in a GENERATED ALWAYS AS ... STORED expression
--   (42P17), so the tags fold below goes through the immutable wrapper.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kids_game_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  color           TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  game_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_game_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_game_categories: public reads active"
  ON public.kids_game_categories FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_game_categories: admins manage"
  ON public.kids_game_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kids_game_categories_updated_at
  BEFORE UPDATE ON public.kids_game_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_kids_game_categories_order ON public.kids_game_categories(display_order);

INSERT INTO public.kids_game_categories (slug, name, icon, color, display_order) VALUES
  ('memory',            'Memory Games',           'Brain',        'primary',   1),
  ('math',              'Math Games',              'Calculator',   'secondary', 2),
  ('alphabet',          'Alphabet Games',          'Type',         'accent',    3),
  ('reading',           'Reading Games',           'BookOpen',     'pink',      4),
  ('geography',         'Geography Games',         'Globe2',       'green',     5),
  ('science',           'Science Games',           'FlaskConical', 'purple',    6),
  ('space',             'Space Games',             'Rocket',       'primary',   7),
  ('animals',           'Animal Games',            'Dog',          'secondary', 8),
  ('music',             'Music Games',              'Music',       'accent',    9),
  ('creativity',        'Creativity Games',        'Palette',      'pink',      10),
  ('logic',             'Logic Games',             'PuzzleIcon',   'green',     11),
  ('reflex',            'Reflex Games',            'Zap',          'purple',    12),
  ('coding',            'Coding Games',            'Code2',        'primary',   13),
  ('ai',                'AI Games',                'Bot',          'secondary', 14),
  ('accessible-audio',  'Accessible Audio Games',  'Ear',          'accent',    15)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_games — the central catalog table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_games (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    TEXT NOT NULL UNIQUE,
  title                   TEXT NOT NULL,
  description             TEXT,
  age_range               TEXT NOT NULL DEFAULT '6-8' CHECK (age_range IN ('3-5', '6-8', '9-12')),
  difficulty              TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  estimated_minutes       INTEGER NOT NULL DEFAULT 5,
  thumbnail_url           TEXT,
  gallery                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview_video_url       TEXT,
  accessibility_features  JSONB NOT NULL DEFAULT '[]'::jsonb,
  category_id             UUID REFERENCES public.kids_game_categories(id) ON DELETE SET NULL,
  xp_reward               INTEGER NOT NULL DEFAULT 20,
  coins_reward            INTEGER NOT NULL DEFAULT 10,
  tags                    TEXT[] NOT NULL DEFAULT '{}',
  language_support        TEXT[] NOT NULL DEFAULT ARRAY['en', 'ar'],
  rating_avg              NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count            INTEGER NOT NULL DEFAULT 0,
  downloads_count         INTEGER NOT NULL DEFAULT 0,
  players_count           INTEGER NOT NULL DEFAULT 0,
  is_multiplayer          BOOLEAN NOT NULL DEFAULT false,
  is_accessible_audio     BOOLEAN NOT NULL DEFAULT false,
  published_at            TIMESTAMPTZ,
  -- Maps to a key in the frontend game registry (src/features/visionkids/games/registry.ts).
  -- NULL = not implemented yet -> registry renders the "coming soon" placeholder.
  engine_key              TEXT,
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  search_vector           TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(public.library_immutable_array_to_string(tags, ' '), '')), 'B')
  ) STORED,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_games: public reads published"
  ON public.kids_games FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_games: admins manage"
  ON public.kids_games FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kids_games_updated_at
  BEFORE UPDATE ON public.kids_games
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_kids_games_category ON public.kids_games(category_id);
CREATE INDEX IF NOT EXISTS idx_kids_games_status ON public.kids_games(status);
CREATE INDEX IF NOT EXISTS idx_kids_games_tags ON public.kids_games USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_kids_games_search ON public.kids_games USING GIN(search_vector);

COMMENT ON TABLE public.kids_games IS 'VisionKids games catalog. rating_avg/rating_count/downloads_count/players_count are denormalized, maintained by triggers in the engagement migration.';

CREATE OR REPLACE FUNCTION public.bump_kids_game_category_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.category_id IS NOT NULL AND NEW.status = 'published' THEN
      UPDATE public.kids_game_categories SET game_count = game_count + 1 WHERE id = NEW.category_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.category_id IS NOT NULL AND OLD.status = 'published' THEN
      UPDATE public.kids_game_categories SET game_count = GREATEST(game_count - 1, 0) WHERE id = OLD.category_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.category_id IS NOT DISTINCT FROM NEW.category_id AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
      RETURN NEW;
    END IF;
    IF OLD.category_id IS NOT NULL AND OLD.status = 'published' THEN
      UPDATE public.kids_game_categories SET game_count = GREATEST(game_count - 1, 0) WHERE id = OLD.category_id;
    END IF;
    IF NEW.category_id IS NOT NULL AND NEW.status = 'published' THEN
      UPDATE public.kids_game_categories SET game_count = game_count + 1 WHERE id = NEW.category_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER kids_games_category_count
  AFTER INSERT OR UPDATE OR DELETE ON public.kids_games
  FOR EACH ROW EXECUTE FUNCTION public.bump_kids_game_category_count();

-- ============================================================
-- Seed: all 20 launch games. engine_key set only for the 6 shipping with a
-- real playable implementation at launch; the rest are NULL (placeholder).
-- ============================================================
WITH seed(slug, title, description, age_range, difficulty, estimated_minutes, category_slug, xp_reward, coins_reward, tags, engine_key, is_accessible_audio) AS (
  VALUES
    ('memory-cards',        'Memory Cards',        'Flip cards and find every matching pair.',                      '3-5',  'easy',   5,  'memory',           15, 8,  ARRAY['memory','cards'],            'memory-cards',   false),
    ('word-search',         'Word Search',         'Find hidden words in a letter grid.',                           '6-8',  'medium', 8,  'reading',          20, 10, ARRAY['words','reading'],           NULL,             false),
    ('puzzle',              'Puzzle',              'Piece together a picture puzzle.',                              '3-5',  'easy',   6,  'logic',            15, 8,  ARRAY['puzzle','logic'],            NULL,             false),
    ('sudoku-kids',         'Sudoku Kids',         'A gentle, picture-based sudoku for young thinkers.',            '9-12', 'medium', 10, 'logic',            25, 12, ARRAY['sudoku','logic'],            NULL,             false),
    ('math-challenge',      'Math Challenge',      'Solve fun math problems against the clock.',                    '6-8',  'medium', 6,  'math',             20, 10, ARRAY['math','numbers'],            'math-challenge', false),
    ('guess-animal',        'Guess the Animal',    'Guess the animal from clues and pictures.',                     '3-5',  'easy',   5,  'animals',          15, 8,  ARRAY['animals','guessing'],        'guess-animal',   false),
    ('guess-sound',         'Guess the Sound',     'Listen carefully and guess what made the sound.',               '3-5',  'easy',   5,  'accessible-audio', 15, 8,  ARRAY['sound','audio','listening'], NULL,             true),
    ('shape-matching',      'Shape Matching',      'Match each shape to its matching outline.',                     '3-5',  'easy',   4,  'logic',            10, 6,  ARRAY['shapes','matching'],         NULL,             false),
    ('color-match',         'Color Match',         'Quick reflexes: tap the matching color before time runs out.', '3-5',  'easy',   4,  'reflex',           10, 6,  ARRAY['colors','reflex'],           'color-match',    false),
    ('typing-kids',         'Typing Kids',         'Learn the keyboard by typing falling letters.',                 '6-8',  'medium', 8,  'alphabet',         20, 10, ARRAY['typing','keyboard'],         NULL,             false),
    ('coding-puzzle',       'Coding Puzzle',       'Arrange blocks to guide a robot to its goal.',                  '9-12', 'medium', 10, 'coding',           25, 12, ARRAY['coding','logic'],            NULL,             false),
    ('planet-explorer',     'Planet Explorer',     'Explore the planets of our solar system.',                      '6-8',  'easy',   6,  'space',            15, 8,  ARRAY['space','planets'],           NULL,             false),
    ('solar-system-quiz',   'Solar System Quiz',   'Test your knowledge of the solar system.',                      '9-12', 'medium', 6,  'space',            20, 10, ARRAY['space','quiz'],              NULL,             false),
    ('geography-quiz',      'Geography Quiz',      'Test your knowledge of countries and capitals.',                '9-12', 'medium', 6,  'geography',        20, 10, ARRAY['geography','quiz'],          NULL,             false),
    ('flag-quiz',           'Flag Quiz',           'Guess the country from its flag.',                              '6-8',  'medium', 5,  'geography',        15, 8,  ARRAY['flags','geography','quiz'],  'flag-quiz',      false),
    ('multiplication-hero', 'Multiplication Hero', 'Become a hero by mastering multiplication tables.',             '9-12', 'medium', 8,  'math',             25, 12, ARRAY['math','multiplication'],     NULL,             false),
    ('alphabet-adventure',  'Alphabet Adventure',  'An adventure through the alphabet, letter by letter.',          '3-5',  'easy',   6,  'alphabet',         15, 8,  ARRAY['alphabet','letters'],        NULL,             false),
    ('number-adventure',    'Number Adventure',    'An adventure through numbers and counting.',                    '3-5',  'easy',   6,  'math',             15, 8,  ARRAY['numbers','counting'],        NULL,             false),
    ('maze',                'Maze',                'Guide your character through a maze to the exit.',              '6-8',  'medium', 6,  'logic',            15, 8,  ARRAY['maze','logic'],              'maze',           false),
    ('drawing-challenge',   'Drawing Challenge',   'Follow the prompt and draw your best picture.',                 '6-8',  'easy',   8,  'creativity',       15, 8,  ARRAY['drawing','creativity'],      NULL,             false)
)
INSERT INTO public.kids_games (
  slug, title, description, age_range, difficulty, estimated_minutes, category_id,
  xp_reward, coins_reward, tags, engine_key, is_accessible_audio, status, published_at
)
SELECT
  seed.slug, seed.title, seed.description, seed.age_range, seed.difficulty, seed.estimated_minutes,
  cat.id, seed.xp_reward, seed.coins_reward, seed.tags, seed.engine_key, seed.is_accessible_audio,
  'published', now()
FROM seed
JOIN public.kids_game_categories cat ON cat.slug = seed.category_slug
ON CONFLICT (slug) DO NOTHING;
