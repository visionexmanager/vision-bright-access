-- ============================================================
-- Migration: VisionKids Explorer (Phase 6) — core catalog.
--
-- Architecture note (same discipline as kids_creative_projects in
-- 20260811003000_kids_studio_core.sql): rather than one bespoke table per
-- browsable domain (planets, ocean creatures, animals, body systems,
-- dinosaurs, civilizations, geography entries, weather topics, nature
-- topics — 9 near-identical tables), this uses ONE polymorphic
-- kids_explorer_locations table (world_slug + category discriminators +
-- a JSONB content column for domain-specific fields). Adding a 10th, 50th,
-- or 200th browsable world later is a data change (new kids_explorer_worlds
-- row + new kids_explorer_locations rows), never a schema change — directly
-- satisfying "قابل للتوسع لإضافة مئات العوالم مستقبلاً دون إعادة هيكلة".
--
-- The 4 interactive simulators (Space Mission, City Builder, Farm
-- Simulator, Eco World) are NOT modeled here — they're stateful mini-apps,
-- not browsable content, and get their own polymorphic save-state table in
-- the next migration (20260812010000).
--
-- Images: seeded content deliberately has no cover_image_url (same
-- decision as the Stories catalog seed) — the UI renders the location's
-- `emoji` as a large illustrative placeholder when no image is set, so
-- browsing works without depending on external photography assets.
-- ============================================================

-- ============================================================
-- kids_explorer_worlds — the 14 content/simulator worlds (Explorer Home
-- and Explorer Passport are app pages, not rows here — Virtual World is
-- the one "hub" kind, an interactive map linking to the other 13).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_explorer_worlds (
  slug          TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('hub', 'content', 'simulator')),
  title         TEXT NOT NULL,
  description   TEXT,
  emoji         TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_explorer_worlds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_explorer_worlds: public read published"
  ON public.kids_explorer_worlds FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_explorer_worlds: admins manage"
  ON public.kids_explorer_worlds FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- kids_explorer_locations — the polymorphic content table.
-- `category` is a per-world sub-type (e.g. 'mammal'/'bird' under
-- animal-kingdom, 'continent'/'country'/'mountain' under
-- geography-explorer). `content` carries the rest of the fields, which
-- vary by world — documented per-world in this migration's own comments,
-- not enforced by schema (matching kids_creative_projects' content JSONB).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_explorer_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_slug    TEXT NOT NULL REFERENCES public.kids_explorer_worlds(slug) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,
  emoji         TEXT NOT NULL DEFAULT '✨',
  summary       TEXT,
  image_url     TEXT,
  video_url     TEXT,
  audio_url     TEXT,
  fun_facts     JSONB NOT NULL DEFAULT '[]'::jsonb,
  content       JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (world_slug, slug)
);

ALTER TABLE public.kids_explorer_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_explorer_locations: public read published"
  ON public.kids_explorer_locations FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_explorer_locations: admins manage"
  ON public.kids_explorer_locations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_explorer_locations_world ON public.kids_explorer_locations(world_slug, category, order_index);

-- ============================================================
-- Seed: the 14 worlds.
-- ============================================================
INSERT INTO public.kids_explorer_worlds (slug, kind, title, description, emoji, color, order_index) VALUES
  ('virtual-world',       'hub',        'Virtual World',        'An interactive map of every world you can explore.',      '🗺️', 'primary',   0),
  ('planet-explorer',     'content',    'Planet Explorer',      'Explore the entire solar system, planet by planet.',      '🪐', 'purple',    1),
  ('ocean-explorer',      'content',    'Ocean Explorer',       'Dive into the deep sea and meet its creatures.',          '🌊', 'accent',    2),
  ('animal-kingdom',      'content',    'Animal Kingdom',       'Meet mammals, birds, reptiles, fish, insects, and more.', '🦁', 'secondary', 3),
  ('human-body-explorer', 'content',    'Human Body Explorer',  'Discover how your body works, system by system.',        '🫀', 'pink',      4),
  ('dinosaur-world',      'content',    'Dinosaur World',       'Travel back in time to the age of the dinosaurs.',       '🦖', 'green',     5),
  ('history-explorer',    'content',    'History Explorer',     'Visit the great civilizations of the ancient world.',     '🏛️', 'accent',    6),
  ('geography-explorer',  'content',    'Geography Explorer',   'Continents, countries, mountains, rivers, and deserts.',  '🌍', 'primary',   7),
  ('weather-lab',         'content',    'Weather Lab',          'Learn how rain, snow, wind, and storms are made.',        '⛅', 'secondary', 8),
  ('nature-explorer',     'content',    'Nature Explorer',      'Plants, trees, flowers, forests, and the environment.',   '🌳', 'green',     9),
  ('space-mission',       'simulator',  'Space Mission',        'Pilot a spacecraft, explore planets, and collect samples.', '🚀', 'purple',   10),
  ('city-builder',        'simulator',  'City Builder',         'Plan and build your own city.',                           '🏙️', 'pink',     11),
  ('farm-simulator',      'simulator',  'Farm Simulator',       'Plant, water, harvest, and care for animals.',            '🚜', 'green',     12),
  ('eco-world',           'simulator',  'Eco World',             'Make choices that protect the planet.',                   '♻️', 'accent',   13)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Seed: Planet Explorer (category = 'planet' | 'dwarf_planet')
-- content: { order, diameter_km, distance_from_sun_km, moons, day_length, year_length, temp_c }
-- ============================================================
INSERT INTO public.kids_explorer_locations (world_slug, category, slug, name, emoji, summary, fun_facts, content, order_index) VALUES
('planet-explorer', 'star', 'sun', 'The Sun', '☀️', 'The star at the center of our solar system — a giant ball of hot glowing gas.',
  '["The Sun is so big that about 1.3 million Earths could fit inside it.","Light from the Sun takes about 8 minutes to reach Earth.","The Sun is actually a star, not a planet."]',
  '{"diameter_km": 1392700, "distance_from_sun_km": 0, "moons": 0, "day_length": "27 Earth days", "year_length": "-", "temp_c": "5,500°C (surface)"}', 0),
('planet-explorer', 'planet', 'mercury', 'Mercury', '☿️', 'The smallest planet and the closest one to the Sun.',
  '["A year on Mercury is only 88 Earth days.","Mercury has no atmosphere to trap heat, so it is scorching by day and freezing by night.","Mercury has no moons."]',
  '{"order": 1, "diameter_km": 4879, "distance_from_sun_km": 57900000, "moons": 0, "day_length": "59 Earth days", "year_length": "88 Earth days", "temp_c": "-180°C to 430°C"}', 1),
('planet-explorer', 'planet', 'venus', 'Venus', '♀️', 'The hottest planet, wrapped in thick clouds that trap heat.',
  '["Venus spins backwards compared to most planets.","A day on Venus is longer than its year.","Venus is the brightest planet in our night sky."]',
  '{"order": 2, "diameter_km": 12104, "distance_from_sun_km": 108200000, "moons": 0, "day_length": "243 Earth days", "year_length": "225 Earth days", "temp_c": "465°C"}', 2),
('planet-explorer', 'planet', 'earth', 'Earth', '🌍', 'Our home planet — the only place we know of with life.',
  '["Earth is the only planet not named after a god.","About 71% of Earth is covered in water.","Earth spins at about 1,670 km/h at the equator."]',
  '{"order": 3, "diameter_km": 12742, "distance_from_sun_km": 149600000, "moons": 1, "day_length": "24 hours", "year_length": "365.25 days", "temp_c": "-88°C to 58°C"}', 3),
('planet-explorer', 'moon', 'moon', 'The Moon', '🌕', 'Earth''s only natural satellite, and the closest object in space to us.',
  '["The Moon is slowly moving away from Earth, about 3.8 cm per year.","The same side of the Moon always faces Earth.","Twelve astronauts have walked on the Moon."]',
  '{"diameter_km": 3474, "distance_from_sun_km": null, "moons": 0, "day_length": "27 Earth days", "year_length": "-", "temp_c": "-173°C to 127°C"}', 4),
('planet-explorer', 'planet', 'mars', 'Mars', '♂️', 'The "Red Planet", named for its rusty, iron-rich soil.',
  '["Mars has the tallest volcano in the solar system, Olympus Mons.","Mars has two small moons: Phobos and Deimos.","A year on Mars lasts almost twice as long as an Earth year."]',
  '{"order": 4, "diameter_km": 6779, "distance_from_sun_km": 227900000, "moons": 2, "day_length": "24.6 hours", "year_length": "687 Earth days", "temp_c": "-153°C to 20°C"}', 5),
('planet-explorer', 'planet', 'jupiter', 'Jupiter', '🟠', 'The largest planet in the solar system, a giant ball of gas.',
  '["Jupiter''s Great Red Spot is a giant storm bigger than Earth.","Jupiter has at least 95 known moons.","Jupiter is so big that all other planets could fit inside it."]',
  '{"order": 5, "diameter_km": 139820, "distance_from_sun_km": 778500000, "moons": 95, "day_length": "10 hours", "year_length": "12 Earth years", "temp_c": "-145°C"}', 6),
('planet-explorer', 'planet', 'saturn', 'Saturn', '🪐', 'Famous for its beautiful rings made of ice and rock.',
  '["Saturn''s rings are made of billions of pieces of ice and rock.","Saturn is the least dense planet — it would float in water.","Saturn has 146 known moons."]',
  '{"order": 6, "diameter_km": 116460, "distance_from_sun_km": 1434000000, "moons": 146, "day_length": "10.7 hours", "year_length": "29 Earth years", "temp_c": "-178°C"}', 7),
('planet-explorer', 'planet', 'uranus', 'Uranus', '🔵', 'An icy giant that spins on its side.',
  '["Uranus rotates almost sideways, like a rolling ball.","Uranus is the coldest planet in the solar system.","Uranus has 28 known moons."]',
  '{"order": 7, "diameter_km": 50724, "distance_from_sun_km": 2871000000, "moons": 28, "day_length": "17 hours", "year_length": "84 Earth years", "temp_c": "-224°C"}', 8),
('planet-explorer', 'planet', 'neptune', 'Neptune', '🔷', 'The windiest planet, and the farthest from the Sun.',
  '["Neptune has the fastest winds in the solar system, up to 2,100 km/h.","Neptune was discovered using math before it was ever seen.","Neptune has 16 known moons."]',
  '{"order": 8, "diameter_km": 49244, "distance_from_sun_km": 4495000000, "moons": 16, "day_length": "16 hours", "year_length": "165 Earth years", "temp_c": "-214°C"}', 9),
('planet-explorer', 'dwarf_planet', 'pluto', 'Pluto', '⚪', 'Once called the ninth planet, now known as a dwarf planet.',
  '["Pluto was reclassified as a dwarf planet in 2006.","Pluto has 5 known moons, the largest called Charon.","A year on Pluto lasts 248 Earth years."]',
  '{"diameter_km": 2377, "distance_from_sun_km": 5906000000, "moons": 5, "day_length": "6.4 Earth days", "year_length": "248 Earth years", "temp_c": "-229°C"}', 10),
('planet-explorer', 'dwarf_planet', 'ceres', 'Ceres', '⚪', 'The largest object in the asteroid belt, and a dwarf planet.',
  '["Ceres is the only dwarf planet located in the inner solar system.","Ceres may have a layer of water ice beneath its surface.","Ceres was the first asteroid ever discovered, in 1801."]',
  '{"diameter_km": 946, "distance_from_sun_km": 413700000, "moons": 0, "day_length": "9 hours", "year_length": "4.6 Earth years", "temp_c": "-105°C"}', 11),
('planet-explorer', 'dwarf_planet', 'eris', 'Eris', '⚪', 'A distant, icy dwarf planet even more massive than Pluto.',
  '["Discovering Eris in 2005 led scientists to redefine what a planet is.","Eris takes 559 Earth years to orbit the Sun.","Eris has one known moon, named Dysnomia."]',
  '{"diameter_km": 2326, "distance_from_sun_km": 10120000000, "moons": 1, "day_length": "26 hours", "year_length": "559 Earth years", "temp_c": "-231°C"}', 12)
ON CONFLICT (world_slug, slug) DO NOTHING;

-- ============================================================
-- Seed: Ocean Explorer (category = 'creature' | 'place')
-- content: { habitat, diet, size, depth_range }
-- ============================================================
INSERT INTO public.kids_explorer_locations (world_slug, category, slug, name, emoji, summary, fun_facts, content, order_index) VALUES
('ocean-explorer', 'place', 'coral-reefs', 'Coral Reefs', '🪸', 'Colorful underwater "cities" built by tiny living animals called coral polyps.',
  '["Coral reefs cover less than 1% of the ocean floor but support 25% of all marine life.","Corals are animals, not plants or rocks.","The Great Barrier Reef is the largest living structure on Earth."]',
  '{"habitat": "Warm, shallow, sunlit waters", "depth_range": "0-30m"}', 0),
('ocean-explorer', 'creature', 'whales', 'Whales', '🐋', 'The largest animals to have ever lived on Earth.',
  '["The blue whale''s heart is about the size of a small car.","Whales are mammals — they breathe air and nurse their babies.","Some whales can sing songs that travel for hundreds of kilometers underwater."]',
  '{"habitat": "All oceans", "diet": "Krill, small fish, plankton", "size": "Up to 30m (blue whale)"}', 1),
('ocean-explorer', 'creature', 'dolphins', 'Dolphins', '🐬', 'Playful, highly intelligent marine mammals known for their clicks and whistles.',
  '["Dolphins use echolocation to "see" with sound.","Dolphins sleep with one half of their brain at a time.","Dolphins live in social groups called pods."]',
  '{"habitat": "Oceans and some rivers", "diet": "Fish, squid", "size": "2-4m"}', 2),
('ocean-explorer', 'creature', 'sharks', 'Sharks', '🦈', 'Powerful predators that have existed for over 400 million years.',
  '["Sharks have existed longer than trees.","A shark''s skeleton is made of cartilage, not bone.","Most sharks are not dangerous to humans."]',
  '{"habitat": "All oceans", "diet": "Fish, seals, plankton (varies by species)", "size": "0.2m-18m"}', 3),
('ocean-explorer', 'creature', 'octopus', 'Octopus', '🐙', 'A clever, shape-shifting creature with eight arms and three hearts.',
  '["An octopus has three hearts and blue blood.","Octopuses can change color and texture to hide from danger.","Octopuses are considered one of the most intelligent invertebrates."]',
  '{"habitat": "Ocean floors worldwide", "diet": "Crabs, shrimp, mollusks", "size": "Varies widely by species"}', 4),
('ocean-explorer', 'creature', 'jellyfish', 'Jellyfish', '🎐', 'A soft, drifting creature that has floated in the oceans for over 500 million years.',
  '["Jellyfish have no brain, heart, or bones.","Some jellyfish glow in the dark.","Jellyfish are made of about 95% water."]',
  '{"habitat": "All oceans, from surface to deep sea", "diet": "Plankton, small fish", "size": "A few mm to 2m"}', 5),
('ocean-explorer', 'place', 'shipwrecks', 'Sunken Shipwrecks', '🚢', 'Old ships resting on the ocean floor, now home to coral and sea life.',
  '["Sunken ships often become artificial reefs, full of fish and coral.","Some famous shipwrecks have been resting underwater for over a century.","Divers and scientists explore shipwrecks to learn about history."]',
  '{"habitat": "Ocean floor near coastlines and shipping routes", "depth_range": "Varies — a few meters to thousands"}', 6)
ON CONFLICT (world_slug, slug) DO NOTHING;

-- ============================================================
-- Seed: Animal Kingdom (category = 'mammal' | 'bird' | 'reptile' | 'fish' | 'insect' | 'amphibian')
-- content: { habitat, diet, lifespan, distribution }
-- ============================================================
INSERT INTO public.kids_explorer_locations (world_slug, category, slug, name, emoji, summary, fun_facts, content, order_index) VALUES
('animal-kingdom', 'mammal', 'lion', 'Lion', '🦁', 'A powerful big cat known as the "king of the jungle", though it actually lives on grasslands.',
  '["Lions are the only cats that live in social groups, called prides.","A lion''s roar can be heard up to 8 km away.","Only male lions usually have manes."]',
  '{"habitat": "African savannas and grasslands", "diet": "Zebras, wildebeest, buffalo", "lifespan": "10-14 years", "distribution": "Sub-Saharan Africa, small population in India"}', 0),
('animal-kingdom', 'mammal', 'elephant', 'Elephant', '🐘', 'The largest land animal, known for its long trunk and strong family bonds.',
  '["An elephant''s trunk has over 40,000 muscles.","Elephants can recognize themselves in a mirror.","Elephant herds are led by the oldest female, called the matriarch."]',
  '{"habitat": "Savannas, forests", "diet": "Grass, leaves, bark, fruit", "lifespan": "60-70 years", "distribution": "Africa and Asia"}', 1),
('animal-kingdom', 'bird', 'eagle', 'Eagle', '🦅', 'A powerful bird of prey with incredible eyesight.',
  '["Eagles can spot prey from over 3 km away.","Some eagles can fly higher than 3,000 meters.","Eagles mate for life and reuse the same nest for years."]',
  '{"habitat": "Mountains, forests, coastlines", "diet": "Fish, small mammals, birds", "lifespan": "20-30 years", "distribution": "Every continent except Antarctica"}', 2),
('animal-kingdom', 'bird', 'penguin', 'Penguin', '🐧', 'A flightless bird that is an expert swimmer, built for cold climates.',
  '["Penguins can''t fly, but they can "fly" underwater at speeds of 15 km/h.","Emperor penguin fathers keep eggs warm on their feet for two months.","Penguins huddle together in groups to stay warm."]',
  '{"habitat": "Antarctica and cool southern coastlines", "diet": "Fish, krill, squid", "lifespan": "15-20 years", "distribution": "Antarctica, southern Africa, South America, Australia"}', 3),
('animal-kingdom', 'reptile', 'crocodile', 'Crocodile', '🐊', 'An ancient, armored predator that has barely changed in 200 million years.',
  '["Crocodiles have the strongest bite of any living animal.","Crocodiles can hold their breath underwater for over an hour.","Baby crocodiles chirp from inside the egg to signal it''s time to hatch."]',
  '{"habitat": "Rivers, lakes, wetlands", "diet": "Fish, birds, mammals", "lifespan": "70+ years", "distribution": "Africa, Asia, Americas, Australia"}', 4),
('animal-kingdom', 'reptile', 'chameleon', 'Chameleon', '🦎', 'A lizard famous for changing color and having independently rotating eyes.',
  '["Chameleons change color mainly to communicate, not just to hide.","A chameleon''s tongue can be as long as its whole body.","Each of a chameleon''s eyes can look in a different direction."]',
  '{"habitat": "Forests, savannas", "diet": "Insects", "lifespan": "2-10 years", "distribution": "Africa, Madagascar, southern Europe, Asia"}', 5),
('animal-kingdom', 'fish', 'clownfish', 'Clownfish', '🐠', 'A small, brightly colored fish that lives safely among sea anemones.',
  '["Clownfish are immune to the sting of the anemones they live in.","All clownfish are born male and can change to female.","Clownfish rarely swim far from their home anemone."]',
  '{"habitat": "Coral reefs", "diet": "Algae, plankton, small crustaceans", "lifespan": "6-10 years", "distribution": "Indian and Pacific Oceans"}', 6),
('animal-kingdom', 'insect', 'honeybee', 'Honeybee', '🐝', 'A hardworking insect essential for pollinating flowers and crops.',
  '["A single bee colony can pollinate 300 million flowers a day.","Bees communicate the location of food using a "waggle dance".","Worker bees are all female."]',
  '{"habitat": "Nearly everywhere with flowering plants", "diet": "Nectar, pollen", "lifespan": "A few weeks to a few years (queen)", "distribution": "Worldwide except Antarctica"}', 7),
('animal-kingdom', 'insect', 'monarch-butterfly', 'Monarch Butterfly', '🦋', 'A butterfly famous for migrating thousands of kilometers every year.',
  '["Monarchs can travel over 4,000 km during migration.","No single monarch completes the whole round trip — it takes several generations.","Monarch caterpillars eat only milkweed."]',
  '{"habitat": "Meadows, gardens, migration routes", "diet": "Nectar (adult), milkweed (caterpillar)", "lifespan": "2-6 weeks (except migrating generation: up to 8 months)", "distribution": "North America"}', 8),
('animal-kingdom', 'amphibian', 'frog', 'Frog', '🐸', 'A small amphibian that lives both in water and on land.',
  '["Frogs breathe partly through their skin.","Some frogs can freeze solid in winter and thaw out alive in spring.","There are over 7,000 known species of frogs."]',
  '{"habitat": "Ponds, rivers, rainforests", "diet": "Insects, worms", "lifespan": "4-15 years", "distribution": "Every continent except Antarctica"}', 9),
('animal-kingdom', 'amphibian', 'axolotl', 'Axolotl', '🦎', 'A unique salamander that keeps its youthful features its whole life and can regrow lost limbs.',
  '["Axolotls can regrow an entire lost leg, and even parts of their brain and heart.","Axolotls almost never leave the water, unlike most salamanders.","Axolotls are critically endangered in the wild."]',
  '{"habitat": "Freshwater lakes and canals", "diet": "Small fish, worms, insects", "lifespan": "10-15 years", "distribution": "Xochimilco, Mexico"}', 10)
ON CONFLICT (world_slug, slug) DO NOTHING;

-- ============================================================
-- Seed: Human Body Explorer (category = 'system')
-- content: { organs: [], function_summary }
-- ============================================================
INSERT INTO public.kids_explorer_locations (world_slug, category, slug, name, emoji, summary, fun_facts, content, order_index) VALUES
('human-body-explorer', 'system', 'skeletal-system', 'The Skeletal System', '🦴', 'The framework of bones that supports and protects your body.',
  '["Adults have 206 bones, but babies are born with about 300 (some fuse together as they grow).","The femur (thigh bone) is the longest and strongest bone in the body.","Bones are living tissue — they can heal themselves when broken."]',
  '{"organs": ["Skull", "Spine", "Ribs", "Femur", "Pelvis"], "function_summary": "Supports the body, protects organs, and lets you move using joints and muscles."}', 0),
('human-body-explorer', 'system', 'muscles', 'The Muscular System', '💪', 'The muscles that let your body move, from blinking to running.',
  '["The body has over 600 muscles.","The strongest muscle relative to its size is the masseter (jaw muscle).","Muscles work in pairs — one contracts while the other relaxes."]',
  '{"organs": ["Biceps", "Quadriceps", "Heart muscle", "Diaphragm"], "function_summary": "Contracts and relaxes to move bones and organs."}', 1),
('human-body-explorer', 'system', 'heart', 'The Heart', '🫀', 'A powerful muscle that pumps blood all around your body.',
  '["Your heart beats about 100,000 times a day.","The heart pumps roughly 7,500 liters of blood every day.","A heartbeat is the sound of its valves opening and closing."]',
  '{"organs": ["Heart", "Blood vessels"], "function_summary": "Pumps blood to deliver oxygen and nutrients to every part of the body."}', 2),
('human-body-explorer', 'system', 'brain', 'The Brain', '🧠', 'Your body''s control center, in charge of thoughts, feelings, and movement.',
  '["The brain uses about 20% of the body''s energy.","The brain has no pain receptors of its own.","The brain generates enough electricity to power a small light bulb."]',
  '{"organs": ["Brain", "Spinal cord", "Nerves"], "function_summary": "Controls thoughts, movement, senses, and every automatic body function."}', 3),
('human-body-explorer', 'system', 'lungs', 'The Lungs', '🫁', 'The organs that let you breathe in oxygen and breathe out carbon dioxide.',
  '["You take about 20,000 breaths a day.","If unfolded, the surface of the lungs would cover a tennis court.","Only the left lung has a small notch to make room for the heart."]',
  '{"organs": ["Lungs", "Trachea", "Diaphragm"], "function_summary": "Brings oxygen into the blood and removes carbon dioxide."}', 4),
('human-body-explorer', 'system', 'digestive-system', 'The Digestive System', '🍽️', 'The pathway that turns food into energy your body can use.',
  '["The small intestine is about 6 meters long.","Digestion starts in the mouth, with saliva breaking down food.","It takes 24-72 hours for food to move all the way through the digestive system."]',
  '{"organs": ["Mouth", "Stomach", "Small intestine", "Large intestine", "Liver"], "function_summary": "Breaks down food into nutrients and removes what the body can''t use."}', 5),
('human-body-explorer', 'system', 'senses', 'The Five Senses', '👀', 'The systems that let you see, hear, smell, taste, and touch the world.',
  '["The human eye can distinguish about 10 million colors.","Your sense of smell can detect over 1 trillion different scents.","Taste and smell work together, which is why food tastes different with a blocked nose."]',
  '{"organs": ["Eyes", "Ears", "Nose", "Tongue", "Skin"], "function_summary": "Gathers information from the world so the brain can respond to it."}', 6)
ON CONFLICT (world_slug, slug) DO NOTHING;

-- ============================================================
-- Seed: Dinosaur World (category = 'dinosaur')
-- content: { period, diet, length_m, weight_kg, region }
-- ============================================================
INSERT INTO public.kids_explorer_locations (world_slug, category, slug, name, emoji, summary, fun_facts, content, order_index) VALUES
('dinosaur-world', 'dinosaur', 'tyrannosaurus-rex', 'Tyrannosaurus Rex', '🦖', 'One of the largest land predators ever, with massive jaws and tiny arms.',
  '["A T. rex bite could crush a car.","T. rex arms were small but extremely strong.","T. rex went extinct about 66 million years ago, along with most dinosaurs."]',
  '{"period": "Late Cretaceous (68-66 million years ago)", "diet": "Carnivore", "length_m": 12, "weight_kg": 8000, "region": "North America"}', 0),
('dinosaur-world', 'dinosaur', 'triceratops', 'Triceratops', '🦕', 'A plant-eating dinosaur with three horns and a large bony frill.',
  '["Triceratops means "three-horned face".","Its frill may have been used for display or protection.","Triceratops lived alongside T. rex."]',
  '{"period": "Late Cretaceous (68-66 million years ago)", "diet": "Herbivore", "length_m": 9, "weight_kg": 6000, "region": "North America"}', 1),
('dinosaur-world', 'dinosaur', 'stegosaurus', 'Stegosaurus', '🦕', 'Famous for the row of large bony plates along its back and spiked tail.',
  '["Stegosaurus had a brain about the size of a walnut.","Its tail spikes are nicknamed the "thagomizer".","The plates may have helped control body temperature."]',
  '{"period": "Late Jurassic (155-150 million years ago)", "diet": "Herbivore", "length_m": 9, "weight_kg": 5000, "region": "North America"}', 2),
('dinosaur-world', 'dinosaur', 'velociraptor', 'Velociraptor', '🦖', 'A small, fast, and intelligent hunter, much smaller than in the movies.',
  '["Velociraptor was actually about the size of a turkey.","It likely had feathers.","It hunted in the deserts of what is now Mongolia."]',
  '{"period": "Late Cretaceous (75-71 million years ago)", "diet": "Carnivore", "length_m": 2, "weight_kg": 15, "region": "Central Asia"}', 3),
('dinosaur-world', 'dinosaur', 'brachiosaurus', 'Brachiosaurus', '🦕', 'A giant long-necked dinosaur, one of the tallest animals to ever live.',
  '["Brachiosaurus could reach leaves 12 meters up.","Its front legs were longer than its back legs, unusual for long-necked dinosaurs.","It may have weighed as much as 10 elephants."]',
  '{"period": "Late Jurassic (154-153 million years ago)", "diet": "Herbivore", "length_m": 22, "weight_kg": 40000, "region": "North America"}', 4),
('dinosaur-world', 'flying_reptile', 'pterodactyl', 'Pterodactyl', '🦅', 'A flying reptile that lived alongside the dinosaurs (not a dinosaur itself).',
  '["Pterodactyls were reptiles, not dinosaurs or birds.","Some pterosaur species had wingspans over 10 meters.","They were likely covered in a hair-like fuzz."]',
  '{"period": "Late Jurassic (150 million years ago)", "diet": "Carnivore (fish, small animals)", "length_m": 1, "weight_kg": 5, "region": "Europe"}', 5)
ON CONFLICT (world_slug, slug) DO NOTHING;

-- ============================================================
-- Seed: History Explorer (category = 'civilization')
-- content: { era, region, famous_for: [] }
-- ============================================================
INSERT INTO public.kids_explorer_locations (world_slug, category, slug, name, emoji, summary, fun_facts, content, order_index) VALUES
('history-explorer', 'civilization', 'ancient-egypt', 'Ancient Egypt', '🏺', 'A civilization along the Nile River, famous for pyramids and pharaohs.',
  '["The Great Pyramid of Giza was the tallest human-made structure for over 3,800 years.","Ancient Egyptians invented one of the earliest writing systems, hieroglyphics.","Egyptians mummified their dead to preserve them for the afterlife."]',
  '{"era": "c. 3100-30 BCE", "region": "Along the Nile River, northeast Africa", "famous_for": ["Pyramids", "Pharaohs", "Hieroglyphics", "The Sphinx"]}', 0),
('history-explorer', 'civilization', 'ancient-rome', 'The Romans', '🏛️', 'A powerful empire that once ruled much of Europe, North Africa, and the Middle East.',
  '["Roman roads and aqueducts were engineering marvels, some still standing today.","The Colosseum could hold up to 50,000-80,000 spectators.","Latin, the Roman language, is the root of many modern languages."]',
  '{"era": "c. 753 BCE-476 CE", "region": "Mediterranean, Europe, North Africa", "famous_for": ["The Colosseum", "Roman roads", "Roman law", "Julius Caesar"]}', 1),
('history-explorer', 'civilization', 'ancient-greece', 'The Greeks', '🏺', 'The birthplace of democracy, philosophy, and the Olympic Games.',
  '["The first Olympic Games were held in Greece in 776 BCE.","Ancient Greeks developed early ideas of democracy in Athens.","Greek myths about gods and heroes are still told today."]',
  '{"era": "c. 800-146 BCE", "region": "Greece and the Aegean Sea", "famous_for": ["Democracy", "Olympic Games", "Philosophy", "Greek mythology"]}', 2),
('history-explorer', 'civilization', 'mesopotamia', 'Mesopotamia', '📜', 'One of the earliest civilizations, in the land between the Tigris and Euphrates rivers.',
  '["Mesopotamia is often called the "Cradle of Civilization".","The Sumerians invented one of the first writing systems, cuneiform.","The wheel is believed to have been invented in Mesopotamia."]',
  '{"era": "c. 3500-539 BCE", "region": "Modern-day Iraq and Syria", "famous_for": ["Cuneiform writing", "The wheel", "Babylon", "Ziggurats"]}', 3),
('history-explorer', 'civilization', 'islamic-civilization', 'The Islamic Civilization', '🕌', 'A golden age of learning that preserved and advanced science, medicine, and mathematics.',
  '["Scholars of this era preserved and translated many ancient Greek and Roman texts.","The concept of algebra was greatly advanced by Muslim mathematicians.","Cities like Baghdad and Cordoba became major centers of learning."]',
  '{"era": "c. 8th-13th century CE", "region": "Middle East, North Africa, Spain", "famous_for": ["House of Wisdom", "Algebra", "Advances in medicine and astronomy"]}', 4),
('history-explorer', 'civilization', 'ancient-china', 'Ancient China', '🏯', 'One of the world''s oldest continuous civilizations, with many great inventions.',
  '["Ancient China gave the world paper, printing, the compass, and gunpowder.","The Great Wall of China stretches over 21,000 km.","The Terracotta Army guards the tomb of China''s first emperor."]',
  '{"era": "c. 2070 BCE-1912 CE (imperial era)", "region": "East Asia", "famous_for": ["The Great Wall", "Terracotta Army", "Paper and printing", "The Silk Road"]}', 5)
ON CONFLICT (world_slug, slug) DO NOTHING;

-- ============================================================
-- Seed: Geography Explorer (category = 'continent' | 'country' | 'mountain' | 'river' | 'desert' | 'forest')
-- content: { capital, flag_emoji, height_m, length_km, area_km2, population }
-- ============================================================
INSERT INTO public.kids_explorer_locations (world_slug, category, slug, name, emoji, summary, fun_facts, content, order_index) VALUES
('geography-explorer', 'continent', 'africa', 'Africa', '🌍', 'The second-largest continent, home to the Sahara Desert and the Nile River.',
  '["Africa has 54 countries — more than any other continent.","The Sahara is the largest hot desert in the world.","Africa is home to the world''s longest river, the Nile."]', '{"area_km2": 30370000}', 0),
('geography-explorer', 'continent', 'asia', 'Asia', '🌏', 'The largest and most populous continent on Earth.',
  '["Asia is home to Mount Everest, the tallest mountain in the world.","Asia has over 4.7 billion people, more than half the world''s population.","Asia spans 49 countries."]', '{"area_km2": 44579000}', 1),
('geography-explorer', 'continent', 'europe', 'Europe', '🌍', 'A continent with a long history and many countries close together.',
  '["Europe has over 50 countries in a relatively small area.","The Ural Mountains mark part of the boundary between Europe and Asia.","Europe has more than 250 languages spoken across it."]', '{"area_km2": 10180000}', 2),
('geography-explorer', 'continent', 'north-america', 'North America', '🌎', 'Home to Canada, the United States, Mexico, and Central America.',
  '["North America has the Grand Canyon, one of the world''s deepest canyons.","It stretches from the Arctic Circle to the tropics.","The Great Lakes hold about 20% of the world''s surface fresh water."]', '{"area_km2": 24709000}', 3),
('geography-explorer', 'continent', 'south-america', 'South America', '🌎', 'Home to the Amazon Rainforest and the Andes mountain range.',
  '["The Amazon Rainforest produces about 20% of the world''s oxygen.","The Andes is the longest mountain range in the world.","South America has the driest place on Earth, the Atacama Desert."]', '{"area_km2": 17840000}', 4),
('geography-explorer', 'continent', 'australia', 'Australia', '🌏', 'The smallest continent, also a single country, known for unique wildlife.',
  '["Australia is the only continent that is also a single country.","It is home to unique animals like kangaroos and koalas found nowhere else.","Australia has the world''s largest coral reef system, the Great Barrier Reef."]', '{"area_km2": 8600000}', 5),
('geography-explorer', 'continent', 'antarctica', 'Antarctica', '🧊', 'The coldest, windiest, and driest continent, covered almost entirely in ice.',
  '["Antarctica holds about 70% of the world''s fresh water, frozen as ice.","No country owns Antarctica — it''s used for peaceful scientific research.","In winter, parts of Antarctica get 24 hours of darkness a day."]', '{"area_km2": 14200000}', 6),

('geography-explorer', 'country', 'egypt', 'Egypt', '🇪🇬', 'A country in North Africa famous for the pyramids and the Nile River.', '["Egypt is home to the last surviving Ancient Wonder of the World, the Great Pyramid.","The Nile is the longest river in Africa."]', '{"capital": "Cairo", "flag_emoji": "🇪🇬", "population": 109000000}', 7),
('geography-explorer', 'country', 'japan', 'Japan', '🇯🇵', 'An island nation in East Asia known for its blend of ancient tradition and modern technology.', '["Japan is made up of nearly 6,900 islands.","Japan has the world''s oldest company, founded over 1,400 years ago."]', '{"capital": "Tokyo", "flag_emoji": "🇯🇵", "population": 124000000}', 8),
('geography-explorer', 'country', 'brazil', 'Brazil', '🇧🇷', 'The largest country in South America, home to most of the Amazon Rainforest.', '["Brazil shares a border with every South American country except Chile and Ecuador.","Brazil is the largest producer of coffee in the world."]', '{"capital": "Brasília", "flag_emoji": "🇧🇷", "population": 216000000}', 9),
('geography-explorer', 'country', 'france', 'France', '🇫🇷', 'A European country known for its art, food, and the Eiffel Tower.', '["France is the most visited country in the world by tourists.","The Louvre in Paris is the world''s largest art museum."]', '{"capital": "Paris", "flag_emoji": "🇫🇷", "population": 68000000}', 10),
('geography-explorer', 'country', 'united-states', 'United States', '🇺🇸', 'A large country in North America made up of 50 states.', '["The United States has the Grand Canyon and Yellowstone, the first national park in the world.","It stretches across 6 time zones with its territories."]', '{"capital": "Washington, D.C.", "flag_emoji": "🇺🇸", "population": 335000000}', 11),
('geography-explorer', 'country', 'china', 'China', '🇨🇳', 'The most populous country in the world, with a history spanning thousands of years.', '["China is home to the Great Wall, visible from space under the right conditions.","China has the world''s fastest network of high-speed trains."]', '{"capital": "Beijing", "flag_emoji": "🇨🇳", "population": 1412000000}', 12),
('geography-explorer', 'country', 'south-africa', 'South Africa', '🇿🇦', 'A country at the southern tip of Africa with 12 official languages.', '["South Africa has three capital cities.","It is one of the most biodiverse countries in the world."]', '{"capital": "Pretoria / Cape Town / Bloemfontein", "flag_emoji": "🇿🇦", "population": 60000000}', 13),
('geography-explorer', 'country', 'lebanon', 'Lebanon', '🇱🇧', 'A small Mediterranean country known for its cedar trees and ancient cities.', '["The cedar tree is Lebanon''s national symbol, shown on its flag.","Byblos, in Lebanon, is one of the oldest continuously inhabited cities in the world."]', '{"capital": "Beirut", "flag_emoji": "🇱🇧", "population": 5500000}', 14),

('geography-explorer', 'mountain', 'mount-everest', 'Mount Everest', '⛰️', 'The tallest mountain above sea level on Earth.', '["Mount Everest grows about 4mm taller every year.","The summit temperature can drop to -60°C."]', '{"height_m": 8849}', 15),
('geography-explorer', 'mountain', 'mount-kilimanjaro', 'Mount Kilimanjaro', '⛰️', 'The tallest mountain in Africa, and a dormant volcano.', '["Kilimanjaro is the tallest free-standing mountain in the world.","Its snowy peak is disappearing due to climate change."]', '{"height_m": 5895}', 16),
('geography-explorer', 'mountain', 'the-alps', 'The Alps', '🏔️', 'A major mountain range stretching across eight European countries.', '["The Alps formed over millions of years as tectonic plates collided.","Mont Blanc, in the Alps, is the tallest mountain in Western Europe."]', '{"height_m": 4809}', 17),

('geography-explorer', 'river', 'nile-river', 'The Nile River', '🏞️', 'Widely considered the longest river in the world, flowing through northeast Africa.', '["The Nile flows north into the Mediterranean Sea.","Ancient Egyptian civilization grew around the Nile''s yearly floods."]', '{"length_km": 6650}', 18),
('geography-explorer', 'river', 'amazon-river', 'The Amazon River', '🏞️', 'The river carrying the most water of any river on Earth.', '["The Amazon River has no bridges crossing it along its entire length.","It carries more water than the next several largest rivers combined."]', '{"length_km": 6400}', 19),
('geography-explorer', 'river', 'yangtze-river', 'The Yangtze River', '🏞️', 'The longest river in Asia, flowing through the heart of China.', '["The Yangtze is home to the Three Gorges Dam, the world''s largest power station.","It supports about a third of China''s population along its banks."]', '{"length_km": 6300}', 20),

('geography-explorer', 'desert', 'sahara-desert', 'The Sahara Desert', '🏜️', 'The largest hot desert in the world, covering much of North Africa.', '["The Sahara is almost as large as the entire United States.","Parts of the Sahara were green and covered in lakes thousands of years ago."]', '{"area_km2": 9200000}', 21),
('geography-explorer', 'desert', 'gobi-desert', 'The Gobi Desert', '🏜️', 'A vast desert across northern China and southern Mongolia, known for dinosaur fossils.', '["Many famous dinosaur fossils, including Velociraptor, were found in the Gobi.","The Gobi can be extremely cold in winter, unlike most deserts."]', '{"area_km2": 1300000}', 22),
('geography-explorer', 'desert', 'antarctic-desert', 'The Antarctic Desert', '🧊', 'The largest desert in the world — Antarctica, defined by its extremely low precipitation.', '["A desert is defined by low rainfall, not just heat — Antarctica qualifies.","It receives less precipitation than the Sahara."]', '{"area_km2": 14000000}', 23),

('geography-explorer', 'forest', 'amazon-rainforest', 'The Amazon Rainforest', '🌳', 'The largest tropical rainforest on Earth, home to millions of species.', '["The Amazon is home to about 10% of all known species on Earth.","It spans nine countries in South America."]', '{"area_km2": 5500000}', 24),
('geography-explorer', 'forest', 'congo-rainforest', 'The Congo Rainforest', '🌳', 'The second-largest rainforest in the world, in Central Africa.', '["The Congo Basin is home to gorillas, forest elephants, and okapis.","It helps regulate rainfall across much of Africa."]', '{"area_km2": 2000000}', 25),
('geography-explorer', 'forest', 'boreal-forest', 'The Boreal Forest (Taiga)', '🌲', 'The largest land biome on Earth, a vast forest of cold-hardy conifer trees.', '["The boreal forest circles the globe across Canada, Russia, and Scandinavia.","It stores more carbon than any other land ecosystem."]', '{"area_km2": 17000000}', 26)
ON CONFLICT (world_slug, slug) DO NOTHING;

-- ============================================================
-- Seed: Weather Lab (category = 'phenomenon' | 'season')
-- content: { causes, effects }
-- ============================================================
INSERT INTO public.kids_explorer_locations (world_slug, category, slug, name, emoji, summary, fun_facts, content, order_index) VALUES
('weather-lab', 'phenomenon', 'rain', 'Rain', '🌧️', 'Water that falls from clouds when droplets become too heavy to stay airborne.',
  '["A single raindrop can fall at about 32 km/h.","Rain shapes are usually more like a hamburger bun than a teardrop.","The wettest place on Earth gets rain almost every day of the year."]',
  '{"causes": "Water vapor cools and condenses into droplets inside clouds until they''re heavy enough to fall.", "effects": "Waters plants, fills rivers and lakes, can cause flooding if heavy."}', 0),
('weather-lab', 'phenomenon', 'snow', 'Snow', '❄️', 'Frozen water crystals that fall from clouds when it''s cold enough.',
  '["No two snowflakes are exactly alike.","Snow looks white because it reflects all colors of light.","Snow can insulate the ground, keeping it warmer than the freezing air above."]',
  '{"causes": "Water vapor freezes directly into ice crystals inside cold clouds.", "effects": "Covers the ground, can disrupt travel, provides water when it melts."}', 1),
('weather-lab', 'phenomenon', 'wind', 'Wind', '💨', 'Moving air, caused by differences in air pressure and temperature.',
  '["Wind is created because warm air rises and cool air rushes in to replace it.","The fastest wind ever recorded was over 400 km/h, in a tornado.","Wind can be used to generate clean electricity with wind turbines."]',
  '{"causes": "Uneven heating of the Earth''s surface creates areas of high and low pressure; air flows between them.", "effects": "Moves weather systems, powers turbines, can be destructive in storms."}', 2),
('weather-lab', 'phenomenon', 'hurricanes', 'Hurricanes', '🌀', 'Massive, swirling storms that form over warm ocean water.',
  '["Hurricanes are called typhoons in the Pacific and cyclones near Australia and India.","The calm "eye" at the center of a hurricane can be 30-65 km wide.","Hurricanes need warm ocean water of at least 26.5°C to form."]',
  '{"causes": "Warm, moist ocean air rises rapidly and starts spinning due to the Earth''s rotation.", "effects": "Strong winds, heavy rain, storm surges, flooding."}', 3),
('weather-lab', 'phenomenon', 'thunder', 'Thunder', '🔊', 'The loud sound caused by rapidly expanding air after a lightning flash.',
  '["Thunder is the sound of air explosively expanding after being heated by lightning.","You can estimate a storm''s distance by counting seconds between lightning and thunder.","Thunder can be heard up to about 15-20 km away."]',
  '{"causes": "Lightning heats the surrounding air to about 30,000°C almost instantly, making it expand explosively.", "effects": "A loud booming sound, sometimes rattling windows."}', 4),
('weather-lab', 'phenomenon', 'lightning', 'Lightning', '⚡', 'A giant, powerful spark of electricity between clouds, or between a cloud and the ground.',
  '["Lightning is about five times hotter than the surface of the Sun.","About 100 lightning bolts strike the Earth every second.","Lightning can strike the same place more than once."]',
  '{"causes": "Static electricity builds up inside storm clouds until it discharges as a spark.", "effects": "Can start fires, cause power outages, and is dangerous to be near outdoors."}', 5),
('weather-lab', 'season', 'spring', 'Spring', '🌸', 'The season when plants bloom and animals wake from winter, as days grow warmer.', '["Spring begins when the Northern Hemisphere tilts back toward the Sun.","Many animals give birth in spring when food becomes plentiful."]', '{"causes": "Earth''s tilt starts angling that hemisphere more toward the Sun."}', 6),
('weather-lab', 'season', 'summer', 'Summer', '☀️', 'The warmest season, with the longest days of the year.', '["The longest day of the year is called the summer solstice.","Summer in the Northern and Southern Hemispheres happens at opposite times of year."]', '{"causes": "The hemisphere is tilted most directly toward the Sun."}', 7),
('weather-lab', 'season', 'autumn', 'Autumn', '🍂', 'The season when leaves change color and temperatures start to cool.', '["Leaves change color when trees stop producing green chlorophyll.","Autumn is also called "fall" because of falling leaves."]', '{"causes": "The hemisphere begins tilting away from the Sun again."}', 8),
('weather-lab', 'season', 'winter', 'Winter', '⛄', 'The coldest season, with the shortest days of the year.', '["The shortest day of the year is called the winter solstice.","Some animals hibernate through winter to save energy."]', '{"causes": "The hemisphere is tilted farthest away from the Sun."}', 9)
ON CONFLICT (world_slug, slug) DO NOTHING;

-- ============================================================
-- Seed: Nature Explorer (category = 'plant' | 'tree' | 'flower' | 'ecosystem' | 'conservation')
-- content: { habitat, note }
-- ============================================================
INSERT INTO public.kids_explorer_locations (world_slug, category, slug, name, emoji, summary, fun_facts, content, order_index) VALUES
('nature-explorer', 'plant', 'cactus', 'Cactus', '🌵', 'A plant built to survive in the driest places on Earth.',
  '["Cacti store water in their thick stems to survive long droughts.","Cactus spines are actually modified leaves.","Some cacti can live for over 150 years."]', '{"habitat": "Deserts"}', 0),
('nature-explorer', 'tree', 'giant-sequoia', 'Giant Sequoia', '🌲', 'One of the largest and oldest living trees on Earth.',
  '["Giant sequoias can grow taller than a 25-story building.","Some living sequoias are over 3,000 years old.","Their thick bark protects them from forest fires."]', '{"habitat": "Mountain forests of California"}', 1),
('nature-explorer', 'flower', 'sunflower', 'Sunflower', '🌻', 'A tall, cheerful flower that turns to follow the Sun as it moves across the sky.',
  '["Young sunflowers track the Sun from east to west during the day.","A sunflower head is actually made of thousands of tiny flowers.","Sunflowers can grow taller than 3 meters."]', '{"habitat": "Sunny fields and gardens worldwide"}', 2),
('nature-explorer', 'flower', 'lotus', 'Lotus', '🪷', 'A beautiful flower that grows in water and is a symbol of purity in many cultures.',
  '["Lotus leaves and petals naturally repel dirt and water.","Lotus seeds can remain able to sprout for over 1,000 years.","The lotus is a national flower in several countries."]', '{"habitat": "Ponds and slow-moving water"}', 3),
('nature-explorer', 'ecosystem', 'rainforest-ecosystem', 'The Rainforest Ecosystem', '🌴', 'One of the richest ecosystems on Earth, home to more species than any other habitat.',
  '["Rainforests cover about 6% of Earth''s land but hold over half of its species.","A single rainforest tree can host hundreds of insect species.","Rainforests help regulate the Earth''s climate and rainfall patterns."]', '{"habitat": "Near the equator, warm and wet year-round"}', 4),
('nature-explorer', 'conservation', 'recycling', 'Recycling', '♻️', 'Turning used materials like paper, plastic, and metal into something new instead of throwing them away.',
  '["Recycling one aluminum can saves enough energy to run a TV for three hours.","Glass can be recycled endlessly without losing quality.","Recycling reduces the need for landfills and new raw materials."]', '{"note": "Look for the recycling symbol to know what can be recycled."}', 5)
ON CONFLICT (world_slug, slug) DO NOTHING;
