-- ============================================================
-- Migration: VisionKids World (Phase 12) — core catalogs for an open virtual
-- world: regions, activities/quests, NPCs, marketplace, transportation.
--
-- Architecture (same polymorphic discipline as every prior VisionKids phase):
--   * kids_world_regions is ONE table describing every place on the map
--     (districts, islands, systems) with map_x/map_y coordinates so the
--     Interactive Map is data-driven. Adding a new region/world later is a
--     single row — no schema change, no new route needed for map placement.
--   * kids_world_activities is ONE polymorphic table for ALL in-world content
--     (activity | quest | story | game | mission), discriminated by region +
--     kind, with a JSONB `content` payload. Scales to thousands of items.
--   * kids_npcs, kids_marketplace_items, kids_transportation are small catalogs.
--
-- SAFETY: the Marketplace is VX-coin-only (public.user_points wallet). There is
-- NO real-money path anywhere in the kids world — purchases go through the
-- SECURITY DEFINER buy_kids_item RPC (Phase 12 gamification migration) which
-- calls the existing spend_vx and never trusts a client price.
-- ============================================================

-- ============================================================
-- kids_world_regions — every place in the world. `kind` groups them:
--   'district' (Science City, Reading Village, …) — generic RegionPage,
--   'island'   (Adventure Islands children),
--   'system'   (My Home, Marketplace, Transportation, Weather, Passport, Map)
--     which have bespoke pages but still appear on the map/home grid.
-- map_x / map_y are 0–100 percentages for Interactive Map placement.
-- `parent_slug` lets islands nest under 'adventure-islands', etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_world_regions (
  slug         TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  subtitle     TEXT,
  emoji        TEXT NOT NULL DEFAULT '🗺️',
  kind         TEXT NOT NULL DEFAULT 'district' CHECK (kind IN ('district', 'island', 'system')),
  parent_slug  TEXT,
  route        TEXT,
  color        TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  map_x        NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (map_x >= 0 AND map_x <= 100),
  map_y        NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (map_y >= 0 AND map_y <= 100),
  order_index  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_world_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_world_regions: public read published"
  ON public.kids_world_regions FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_world_regions: admins manage"
  ON public.kids_world_regions FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_world_regions_kind ON public.kids_world_regions(kind, order_index);
CREATE INDEX IF NOT EXISTS idx_kids_world_regions_parent ON public.kids_world_regions(parent_slug, order_index);

INSERT INTO public.kids_world_regions (slug, title, subtitle, emoji, kind, parent_slug, route, color, map_x, map_y, order_index) VALUES
  -- Districts (generic RegionPage at /kids/world/<slug>)
  ('dream-city',       'Dream City',        'A whole city you can build and explore.', '🏙️', 'district', NULL, '/kids/world/dream-city',       'primary',   30, 35, 0),
  ('science-city',     'Science City',      'Labs, experiments, and brain-teasers.',   '🔬', 'district', NULL, '/kids/world/science-city',     'secondary', 62, 28, 1),
  ('reading-village',  'Reading Village',   'Libraries, stories, and reading clubs.',  '📚', 'district', NULL, '/kids/world/reading-village',  'accent',    18, 60, 2),
  ('art-district',     'Art District',      'Draw, sculpt, design, and exhibit.',      '🎨', 'district', NULL, '/kids/world/art-district',     'pink',      45, 62, 3),
  ('music-town',       'Music Town',        'Concerts, instruments, and challenges.',  '🎵', 'district', NULL, '/kids/world/music-town',       'purple',    72, 58, 4),
  ('sports-arena',     'Sports Arena',      'Tournaments and fitness challenges.',     '⚽', 'district', NULL, '/kids/world/sports-arena',     'green',     84, 40, 5),
  ('space-port',       'Space Port',        'Launch rockets and explore planets.',     '🚀', 'district', NULL, '/kids/world/space-port',       'purple',    80, 14, 6),
  ('ocean-world',      'Ocean World',       'Dive, explore, and protect the sea.',     '🐠', 'district', NULL, '/kids/world/ocean-world',      'secondary', 22, 84, 7),
  ('nature-park',      'Nature Park',       'Animals, plants, trips, and photos.',     '🌳', 'district', NULL, '/kids/world/nature-park',      'green',     55, 82, 8),
  ('adventure-islands','Adventure Islands', 'Seven themed islands to discover.',       '🏝️', 'district', NULL, '/kids/world/adventure-islands','accent',    50, 48, 9),
  ('events-plaza',     'Events Plaza',      'Festivals and world-wide events.',        '🎪', 'district', NULL, '/kids/world/events-plaza',     'pink',      40, 20, 10),
  -- Adventure Islands (children — generic RegionPage at /kids/world/region/<slug>)
  ('island-science',   'Science Island',    'Discovery around every corner.',          '🧪', 'island', 'adventure-islands', '/kids/world/region/island-science',   'secondary', 0, 0, 0),
  ('island-dinosaur',  'Dinosaur Island',   'Meet the giants of long ago.',            '🦕', 'island', 'adventure-islands', '/kids/world/region/island-dinosaur',  'green',     0, 0, 1),
  ('island-space',     'Space Island',      'A launchpad to the stars.',               '🪐', 'island', 'adventure-islands', '/kids/world/region/island-space',     'purple',    0, 0, 2),
  ('island-animals',   'Animal Island',     'Friendly creatures everywhere.',          '🐾', 'island', 'adventure-islands', '/kids/world/region/island-animals',   'accent',    0, 0, 3),
  ('island-history',   'History Island',    'Travel back through time.',               '🏺', 'island', 'adventure-islands', '/kids/world/region/island-history',   'pink',      0, 0, 4),
  ('island-coding',    'Coding Island',     'Puzzles you solve with code.',            '💻', 'island', 'adventure-islands', '/kids/world/region/island-coding',    'primary',   0, 0, 5),
  ('island-music',     'Music Island',      'Rhythm and melody adventures.',           '🎶', 'island', 'adventure-islands', '/kids/world/region/island-music',     'purple',    0, 0, 6),
  -- Systems (bespoke pages, still shown on map/home)
  ('my-home',          'My Home',           'Your very own place to decorate.',        '🏠', 'system', NULL, '/kids/world/my-home',        'primary', 12, 30, 20),
  ('marketplace',      'Marketplace',       'Spend your VX coins on fun things.',      '🛒', 'system', NULL, '/kids/world/marketplace',    'accent',  68, 74, 21),
  ('transportation',   'Transportation',    'Unlock ways to travel the world.',        '🚂', 'system', NULL, '/kids/world/transportation', 'secondary', 90, 66, 22),
  ('weather-center',   'Weather Center',    'See and change the world weather.',       '⛅', 'system', NULL, '/kids/world/weather',        'primary', 90, 20, 23),
  ('world-passport',   'World Passport',    'Your stamps, medals, and discoveries.',   '🛂', 'system', NULL, '/kids/world/passport',       'purple',  10, 82, 24)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_world_activities — polymorphic in-world content. `kind`:
--   'activity' (do-it action), 'quest' (goal to complete for a reward),
--   'story' (read), 'game' (link to a mini-game), 'mission' (multi-step).
-- `content` carries kind-specific payload (steps, target, link, etc.).
-- `npc_slug` optionally attributes it to an NPC "quest giver".
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_world_activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region       TEXT NOT NULL,
  slug         TEXT NOT NULL,
  title        TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '⭐',
  summary      TEXT,
  kind         TEXT NOT NULL DEFAULT 'activity' CHECK (kind IN ('activity', 'quest', 'story', 'game', 'mission')),
  cadence      TEXT NOT NULL DEFAULT 'anytime' CHECK (cadence IN ('anytime', 'daily', 'weekly', 'seasonal')),
  npc_slug     TEXT,
  content      JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward_xp    INTEGER NOT NULL DEFAULT 20 CHECK (reward_xp >= 0 AND reward_xp <= 60),
  reward_coins INTEGER NOT NULL DEFAULT 15 CHECK (reward_coins >= 0 AND reward_coins <= 40),
  order_index  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (region, slug)
);

ALTER TABLE public.kids_world_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_world_activities: public read published"
  ON public.kids_world_activities FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_world_activities: admins manage"
  ON public.kids_world_activities FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_world_activities_region ON public.kids_world_activities(region, kind, order_index);

INSERT INTO public.kids_world_activities (region, slug, title, emoji, summary, kind, cadence, npc_slug, reward_xp, reward_coins, order_index) VALUES
  ('science-city',    'mix-a-potion',     'Mix a Safe Potion',      '⚗️', 'Follow the steps to make a fizzy color change.', 'quest',    'daily',   'npc-scientist', 25, 15, 0),
  ('science-city',    'solve-the-riddle', 'Solve the Lab Riddle',   '🧩', 'Crack the science riddle of the day.',           'quest',    'daily',   'npc-scientist', 20, 12, 1),
  ('reading-village', 'read-a-story',     'Read a Village Story',   '📖', 'Enjoy a short story and answer one question.',   'story',    'anytime', 'npc-teacher',   20, 10, 0),
  ('reading-village', 'reading-race',     'Reading Race',           '🏁', 'Read for 10 minutes this week.',                 'quest',    'weekly',  'npc-teacher',   40, 20, 1),
  ('art-district',    'paint-a-mural',    'Paint a Mural',          '🖌️', 'Add your colors to the district mural.',         'activity', 'anytime', 'npc-artist',    20, 12, 0),
  ('music-town',      'learn-a-beat',     'Learn a Beat',           '🥁', 'Tap along and learn a simple rhythm.',           'activity', 'anytime', 'npc-artist',    20, 12, 0),
  ('sports-arena',    'fitness-dash',     'Fitness Dash',           '🏃', 'Complete today''s movement challenge.',          'quest',    'daily',   NULL,            20, 12, 0),
  ('space-port',      'launch-mission',   'Launch a Mission',       '🚀', 'Plan and launch a rocket to a planet.',          'mission',  'anytime', 'npc-pilot',     30, 18, 0),
  ('ocean-world',     'reef-cleanup',     'Reef Cleanup',           '🪸', 'Help clean the reef and protect sea life.',      'quest',    'weekly',  NULL,            40, 20, 0),
  ('nature-park',     'photo-safari',     'Photo Safari',           '📸', 'Spot and "photograph" three animals.',           'activity', 'anytime', 'npc-farmer',    20, 12, 0),
  ('dream-city',      'build-a-park',     'Build a Park',           '🌳', 'Add a park to your Dream City.',                 'activity', 'anytime', 'npc-explorer',  20, 12, 0),
  ('island-dinosaur', 'dino-dig',         'Dino Dig',               '🦴', 'Dig up a dinosaur fossil.',                      'quest',    'anytime', 'npc-explorer',  25, 15, 0),
  ('island-coding',   'code-the-path',    'Code the Path',          '🧭', 'Program a path through the maze.',               'quest',    'anytime', 'npc-robot',     25, 15, 0),
  ('events-plaza',    'seasonal-festival','Seasonal Festival',      '🎉', 'Join this season''s world festival.',            'quest',    'seasonal', NULL,           40, 20, 0)
ON CONFLICT (region, slug) DO NOTHING;

-- ============================================================
-- kids_npcs — non-player characters who give quests and tell stories.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_npcs (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('teacher', 'explorer', 'scientist', 'artist', 'robot', 'pilot', 'farmer')),
  region      TEXT,
  emoji       TEXT NOT NULL DEFAULT '🧑',
  greeting    TEXT,
  content     JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_npcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_npcs: public read published"
  ON public.kids_npcs FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_npcs: admins manage"
  ON public.kids_npcs FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_npcs (slug, name, role, region, emoji, greeting, order_index) VALUES
  ('npc-teacher',   'Miss Maple',   'teacher',   'reading-village', '👩‍🏫', 'Hello, young reader! Ready for a story adventure?', 0),
  ('npc-explorer',  'Captain Coco', 'explorer',  'dream-city',      '🧭', 'Ahoy! There is a whole world to discover!',          1),
  ('npc-scientist', 'Dr. Spark',    'scientist', 'science-city',    '👩‍🔬', 'Welcome to the lab! Let us experiment safely.',     2),
  ('npc-artist',    'Pablo Paints', 'artist',    'art-district',    '🧑‍🎨', 'Let your imagination color the world!',              3),
  ('npc-robot',     'Bolt',         'robot',     'island-coding',   '🤖', 'Beep boop! Let us solve puzzles with code.',         4),
  ('npc-pilot',     'Captain Nova', 'pilot',     'space-port',      '👨‍🚀', 'Strap in — the stars are calling!',                 5),
  ('npc-farmer',    'Farmer Fern',  'farmer',    'nature-park',     '🧑‍🌾', 'Nature is full of wonders. Come and see!',           6)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_marketplace_items — VX-coin shop catalog. `category` groups items;
-- `price_coins` is the fixed server-side price (client never sends a price).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_marketplace_items (
  slug         TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  emoji        TEXT NOT NULL DEFAULT '🎁',
  category     TEXT NOT NULL CHECK (category IN ('clothing', 'decor', 'furniture', 'pet', 'tool', 'effect')),
  price_coins  INTEGER NOT NULL CHECK (price_coins >= 0 AND price_coins <= 100000),
  rarity       TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  color        TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  order_index  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_marketplace_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_marketplace_items: public read published"
  ON public.kids_marketplace_items FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_marketplace_items: admins manage"
  ON public.kids_marketplace_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_marketplace_items_cat ON public.kids_marketplace_items(category, order_index);

INSERT INTO public.kids_marketplace_items (slug, title, description, emoji, category, price_coins, rarity, color, order_index) VALUES
  ('hat-explorer',   'Explorer Hat',   'A hat for brave adventurers.',      '🧢', 'clothing',  150,  'common', 'accent',    0),
  ('cape-hero',      'Hero Cape',      'Swoosh into action!',               '🦸', 'clothing',  400,  'rare',   'pink',      1),
  ('glasses-cool',   'Cool Glasses',   'Look super smart.',                 '🕶️', 'clothing',  120,  'common', 'primary',   2),
  ('rug-cozy',       'Cozy Rug',       'A soft rug for your room.',         '🟫', 'decor',     100,  'common', 'green',     3),
  ('lamp-star',      'Star Lamp',      'Twinkly light for your home.',      '🌟', 'decor',     200,  'rare',   'purple',    4),
  ('poster-space',   'Space Poster',   'Decorate with the galaxy.',         '🪐', 'decor',     130,  'common', 'secondary', 5),
  ('desk-study',     'Study Desk',     'A tidy desk to learn at.',          '🪑', 'furniture', 300,  'common', 'primary',   6),
  ('bookshelf',      'Bookshelf',      'Show off your favorite books.',     '📚', 'furniture', 350,  'rare',   'accent',    7),
  ('bed-comfy',      'Comfy Bed',      'Rest up for the next adventure.',   '🛏️', 'furniture', 500,  'rare',   'purple',    8),
  ('pet-cat',        'Kitten',         'A playful virtual kitten.',         '🐱', 'pet',       600,  'epic',   'pink',      9),
  ('pet-dog',        'Puppy',          'A loyal virtual puppy.',            '🐶', 'pet',       600,  'epic',   'accent',    10),
  ('pet-dragon',     'Baby Dragon',    'A rare friendly dragon.',           '🐉', 'pet',       2000, 'legendary','green',   11),
  ('tool-telescope', 'Telescope',      'Peek at faraway planets.',          '🔭', 'tool',      450,  'rare',   'secondary', 12),
  ('tool-magnifier', 'Magnifier',      'Look closely at tiny things.',      '🔍', 'tool',      180,  'common', 'primary',   13),
  ('effect-sparkles','Sparkle Trail',  'Leave sparkles as you move.',       '✨', 'effect',    800,  'epic',   'purple',    14),
  ('effect-rainbow', 'Rainbow Aura',   'Glow with rainbow colors.',         '🌈', 'effect',    1200, 'legendary','pink',    15)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_transportation — ways to travel, unlocked by achievements/conditions.
-- `unlock_achievement` (a kids_achievements key) gates non-default modes;
-- NULL means available from the start.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_transportation (
  slug               TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  emoji              TEXT NOT NULL DEFAULT '🚶',
  speed              INTEGER NOT NULL DEFAULT 1 CHECK (speed >= 1 AND speed <= 10),
  unlock_achievement TEXT,
  order_index        INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_transportation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_transportation: public read published"
  ON public.kids_transportation FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_transportation: admins manage"
  ON public.kids_transportation FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_transportation (slug, name, emoji, speed, unlock_achievement, order_index) VALUES
  ('walk',      'Walking',        '🚶', 1, NULL,               0),
  ('bike',      'Bicycle',        '🚲', 3, 'world_explorer',   1),
  ('bus',       'Bus',            '🚌', 4, 'world_reader',     2),
  ('train',     'Train',          '🚂', 6, 'world_builder',    3),
  ('boat',      'Boat',           '⛵', 5, 'world_scientist',  4),
  ('spaceship', 'Spaceship',      '🚀', 10, 'world_inventor',  5)
ON CONFLICT (slug) DO NOTHING;
