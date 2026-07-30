-- ============================================================
-- Migration: VisionKids STEM & Innovation Center (Phase 11) — core catalogs.
--
-- Architecture note (same polymorphic discipline as kids_explorer_locations,
-- kids_talent_tracks, and kids_wellness_lessons): the 10 hands-on labs
-- (Science, Physics, Chemistry, Biology, Math, Engineering, Electronics,
-- Robotics, 3D Design, Space) do NOT get 10 bespoke content tables. All
-- experiments/activities live in ONE kids_experiments catalog, discriminated
-- by `lab` (which lab) + `topic` (the concept inside it). JSONB `steps`,
-- `content`, `quiz`, and `simulation` carry per-experiment payloads. Adding a
-- new experiment — or a thousand — is a data change, never a schema change.
--
-- kids_stem_labs is the hub metadata for the 14 STEM Center pages (label,
-- emoji, color, order). Innovation challenges and the Research Center library
-- each get one polymorphic table too.
--
-- SAFETY: all chemistry/physics "reactions" are educational SIMULATIONS ONLY —
-- no real-world procedure is ever instructed. Content is public, non-personal.
-- Per-child progress/projects live under strict owner-only RLS in the
-- 20260817010000 migration.
-- ============================================================

-- ============================================================
-- kids_stem_labs — hub metadata for each lab / center card.
-- `kind` groups them: 'lab' (generic experiment list), 'builder' (interactive
-- workshop), 'center' (innovation / gallery / research). Drives the STEM Home
-- grid and the sub-nav; purely presentational data.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_stem_labs (
  slug         TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  subtitle     TEXT,
  emoji        TEXT NOT NULL DEFAULT '🔬',
  kind         TEXT NOT NULL DEFAULT 'lab' CHECK (kind IN ('lab', 'builder', 'center')),
  color        TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  order_index  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_stem_labs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_stem_labs: public read published"
  ON public.kids_stem_labs FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_stem_labs: admins manage"
  ON public.kids_stem_labs FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_stem_labs (slug, title, subtitle, emoji, kind, color, order_index) VALUES
  ('science',     'Science Lab',        'Safe experiments, videos, and fun simulations.',    '🔬', 'lab',     'primary',   0),
  ('physics',     'Physics Lab',        'Force, motion, energy, gravity, light, and sound.', '🧲', 'lab',     'secondary', 1),
  ('chemistry',   'Chemistry Lab',      'Elements, mixtures, and safe reaction sims.',       '⚗️', 'lab',     'accent',    2),
  ('biology',     'Biology Lab',        'Animals, plants, cells, and the human body.',       '🧬', 'lab',     'green',     3),
  ('math',        'Math Lab',           'Numbers, shapes, measuring, and data.',             '➗', 'lab',     'purple',    4),
  ('engineering', 'Engineering Lab',    'Design bridges, towers, cars, and houses.',         '🏗️', 'lab',     'pink',      5),
  ('electronics', 'Electronics Lab',    'Batteries, circuits, switches, and sensors.',       '💡', 'lab',     'primary',   6),
  ('robotics',    'Robotics Workshop',  'Program a virtual robot to solve tasks.',           '🤖', 'builder', 'secondary', 7),
  ('design3d',    '3D Design Studio',   'Build simple 3D models: houses, cars, and more.',   '🧊', 'builder', 'accent',    8),
  ('space',       'Space Engineering',  'Rockets, orbits, and mission design.',              '🚀', 'lab',     'purple',    9),
  ('innovation',  'Innovation Challenges','A new problem to solve every week.',              '💡', 'center',  'pink',      10),
  ('gallery',     'Inventor Gallery',   'See amazing projects from young inventors.',        '🖼️', 'center',  'green',     11),
  ('research',    'Research Center',    'A friendly science library for curious kids.',      '📚', 'center',  'primary',   12)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_experiments — THE polymorphic experiment/activity catalog for every lab.
-- `lab` = which lab (FK-ish to kids_stem_labs.slug, kept loose for seed order),
-- `topic` = the concept inside the lab. `kind` picks the runner behaviour:
--   'experiment' (steps + optional video + quiz),
--   'simulation' (interactive parametric sim, config in `simulation`),
--   'activity'   (math/practice activity, config in `content`).
-- `quiz` is an ordered JSONB array of { q, choices[], answer (index), explain }.
-- `simulation` describes a client-rendered sim: { type, params, goal }.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_experiments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab              TEXT NOT NULL,
  topic            TEXT NOT NULL,
  slug             TEXT NOT NULL,
  title            TEXT NOT NULL,
  emoji            TEXT NOT NULL DEFAULT '✨',
  summary          TEXT,
  body             TEXT,
  kind             TEXT NOT NULL DEFAULT 'experiment' CHECK (kind IN ('experiment', 'simulation', 'activity')),
  difficulty       TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  steps            JSONB NOT NULL DEFAULT '[]'::jsonb,
  content          JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiz             JSONB NOT NULL DEFAULT '[]'::jsonb,
  simulation       JSONB NOT NULL DEFAULT '{}'::jsonb,
  video_url        TEXT,
  duration_seconds INTEGER,
  color            TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  reward_xp        INTEGER NOT NULL DEFAULT 25 CHECK (reward_xp >= 0 AND reward_xp <= 60),
  reward_coins     INTEGER NOT NULL DEFAULT 12 CHECK (reward_coins >= 0 AND reward_coins <= 30),
  order_index      INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lab, slug)
);

ALTER TABLE public.kids_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_experiments: public read published"
  ON public.kids_experiments FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_experiments: admins manage"
  ON public.kids_experiments FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_experiments_lab ON public.kids_experiments(lab, topic, order_index);

-- ── Science Lab (topic = matter | forces | living | earth | energy) ─────────
INSERT INTO public.kids_experiments (lab, topic, slug, title, emoji, summary, kind, steps, quiz, color, order_index) VALUES
  ('science', 'matter', 'states-of-matter', 'Solids, Liquids, Gases', '🧊', 'Water can be ice, liquid, or steam!', 'experiment',
    '["Look at an ice cube (solid).","Let it melt into water (liquid).","Imagine it heating into steam (gas).","Same water — three states!"]',
    '[{"q":"Which one is a gas?","choices":["Ice","Water","Steam"],"answer":2,"explain":"Steam is water as a gas."}]', 'primary', 0),
  ('science', 'earth', 'day-and-night', 'Day and Night', '🌍', 'Why do we have day and night?', 'experiment',
    '["Earth spins like a top.","The side facing the Sun has day.","The other side has night.","One full spin is one day!"]',
    '[{"q":"What causes day and night?","choices":["Earth spinning","The Moon","Clouds"],"answer":0,"explain":"Earth spinning shows different sides to the Sun."}]', 'accent', 1),
  ('science', 'living', 'plant-a-seed', 'How Seeds Grow', '🌱', 'What a seed needs to grow.', 'experiment',
    '["Plant a seed in soil.","Give it water and sunlight.","Wait patiently each day.","Watch a little sprout appear!"]',
    '[{"q":"What do seeds need to grow?","choices":["Only rocks","Water and sunlight","Nothing"],"answer":1,"explain":"Seeds need water, sunlight, and air."}]', 'green', 2);

-- ── Physics Lab (topic = force | motion | energy | gravity | light | sound | magnetism)
INSERT INTO public.kids_experiments (lab, topic, slug, title, emoji, summary, kind, simulation, quiz, color, reward_xp, reward_coins, order_index) VALUES
  ('physics', 'gravity', 'gravity-drop', 'Gravity Drop', '🍎', 'Drop objects and watch gravity pull them down.', 'simulation',
    '{"type":"gravity","params":{"gravity":9.8,"objects":["feather","apple","ball"]},"goal":"Watch how gravity pulls everything down."}',
    '[{"q":"Which way does gravity pull things?","choices":["Up","Down","Sideways"],"answer":1,"explain":"Gravity pulls objects toward the ground."}]', 'secondary', 30, 15, 0),
  ('physics', 'motion', 'pendulum-swing', 'Pendulum Swing', '🕰️', 'Swing a pendulum and see steady motion.', 'simulation',
    '{"type":"pendulum","params":{"length":1.0,"angle":40},"goal":"See how a longer string swings slower."}',
    '[{"q":"A longer pendulum swings...","choices":["Faster","Slower","The same"],"answer":1,"explain":"Longer pendulums take more time per swing."}]', 'primary', 30, 15, 1),
  ('physics', 'magnetism', 'magnet-poles', 'Magnet Poles', '🧲', 'Opposite poles attract, same poles push away.', 'simulation',
    '{"type":"magnet","params":{},"goal":"Flip a magnet to feel attract vs repel."}',
    '[{"q":"Two north poles will...","choices":["Attract","Repel","Do nothing"],"answer":1,"explain":"Same poles repel each other."}]', 'accent', 30, 15, 2),
  ('physics', 'light', 'light-and-shadow', 'Light and Shadow', '🔦', 'Light makes shadows when blocked.', 'experiment',
    '["Shine a light at a wall.","Put your hand in the beam.","See the shadow appear.","Move closer — the shadow grows!"]',
    '[{"q":"What makes a shadow?","choices":["Blocking light","Adding water","Loud sound"],"answer":0,"explain":"A shadow forms when something blocks light."}]', 'purple', 25, 12, 3),
  ('physics', 'sound', 'good-vibrations', 'Good Vibrations', '🔊', 'Sound is made by things that vibrate.', 'experiment',
    '["Pluck a rubber band.","Feel it wobble fast.","That wobble is a vibration.","Vibrations make the sound you hear!"]',
    '[{"q":"Sound is made by...","choices":["Vibrations","Colors","Cold air"],"answer":0,"explain":"Vibrating objects create sound waves."}]', 'pink', 25, 12, 4),
  ('physics', 'energy', 'ramp-race', 'Ramp Race', '🏎️', 'A higher ramp gives more speed.', 'simulation',
    '{"type":"ramp","params":{"height":50},"goal":"Raise the ramp and watch the car go faster."}',
    '[{"q":"A higher ramp makes the car go...","choices":["Slower","Faster","Backwards"],"answer":1,"explain":"More height stores more energy, so more speed."}]', 'green', 30, 15, 5);

-- ── Chemistry Lab (topic = elements | solutions | reactions | acids_bases | water_cycle) — SIM ONLY
INSERT INTO public.kids_experiments (lab, topic, slug, title, emoji, summary, body, kind, steps, quiz, color, order_index) VALUES
  ('chemistry', 'elements', 'meet-the-elements', 'Meet the Elements', '🧪', 'Everything is made of tiny building blocks.', 'Elements are the building blocks of everything — like oxygen we breathe and carbon in pencils.', 'experiment',
    '["Everything is made of elements.","Oxygen helps us breathe.","Carbon is in pencils.","Hydrogen and oxygen make water!"]',
    '[{"q":"Water is made of hydrogen and...","choices":["Gold","Oxygen","Salt"],"answer":1,"explain":"Water is H2O — hydrogen and oxygen."}]', 'accent', 0),
  ('chemistry', 'solutions', 'dissolving-sugar', 'Dissolving Sugar', '🍬', 'Some things disappear into water.', 'When sugar dissolves it spreads out in the water — it is still there, just too small to see.', 'experiment',
    '["Stir sugar into warm water.","Watch it disappear.","It dissolved into a solution.","Taste — it is still sweet!"]',
    '[{"q":"When sugar dissolves it...","choices":["Vanishes forever","Spreads into the water","Turns to gold"],"answer":1,"explain":"It spreads out but is still there."}]', 'pink', 1),
  ('chemistry', 'acids_bases', 'cabbage-indicator', 'Color-Changing Cabbage (Sim)', '🥬', 'A safe simulation of acids and bases.', 'This is a learning simulation only. Red cabbage juice changes color with acids (red/pink) and bases (green/blue).', 'simulation',
    '[]',
    '[{"q":"Acids turn cabbage juice...","choices":["Green","Red/pink","Black"],"answer":1,"explain":"Acids make it red or pink; bases make it green/blue."}]', 'purple', 2),
  ('chemistry', 'water_cycle', 'the-water-cycle', 'The Water Cycle', '💧', 'Water travels in a never-ending loop.', 'The Sun heats water into vapor (evaporation), it cools into clouds (condensation), and falls as rain (precipitation).', 'experiment',
    '["The Sun warms water into vapor.","Vapor rises and cools into clouds.","Clouds get heavy and it rains.","Rain flows back — and repeats!"]',
    '[{"q":"What is it called when water becomes vapor?","choices":["Evaporation","Freezing","Melting"],"answer":0,"explain":"Heating water turns it to vapor — evaporation."}]', 'secondary', 3);
UPDATE public.kids_experiments SET simulation = '{"type":"ph","params":{},"goal":"Add drops to see acid vs base colors."}'::jsonb WHERE lab = 'chemistry' AND slug = 'cabbage-indicator';

-- ── Biology Lab (topic = animals | plants | cells | human_body | food_chains | environment)
INSERT INTO public.kids_experiments (lab, topic, slug, title, emoji, summary, kind, steps, quiz, color, order_index) VALUES
  ('biology', 'animals', 'animal-groups', 'Animal Groups', '🦁', 'Mammals, birds, fish, reptiles, and more.', 'experiment',
    '["Mammals have fur and drink milk.","Birds have feathers and lay eggs.","Fish live in water and have gills.","Reptiles have scales."]',
    '[{"q":"Which animal is a mammal?","choices":["Shark","Lion","Eagle"],"answer":1,"explain":"Lions have fur and feed milk to their babies."}]', 'accent', 0),
  ('biology', 'cells', 'tiny-cells', 'Tiny Cells', '🔬', 'Living things are made of cells.', 'experiment',
    '["Every living thing is made of cells.","Cells are too small to see.","Some animals have billions of them.","Cells work together to keep you alive!"]',
    '[{"q":"Living things are made of...","choices":["Cells","Bricks","Glass"],"answer":0,"explain":"Cells are the building blocks of life."}]', 'green', 1),
  ('biology', 'human_body', 'your-heart', 'Your Amazing Heart', '❤️', 'Your heart pumps blood all day.', 'experiment',
    '["Your heart is a muscle.","It pumps blood around your body.","It beats about 100,000 times a day!","Exercise keeps it strong."]',
    '[{"q":"What does your heart do?","choices":["Thinks","Pumps blood","Digests food"],"answer":1,"explain":"The heart pumps blood everywhere."}]', 'pink', 2),
  ('biology', 'food_chains', 'food-chain', 'Food Chains', '🌿', 'Who eats what in nature.', 'experiment',
    '["The Sun feeds plants.","Plants feed plant-eaters.","Plant-eaters feed meat-eaters.","This chain connects all life!"]',
    '[{"q":"What starts most food chains?","choices":["The Sun","The Moon","Rocks"],"answer":0,"explain":"The Sun gives plants energy to grow."}]', 'primary', 3);

-- ── Math Lab (topic = add | subtract | multiply | divide | fractions | geometry | measurement | statistics)
INSERT INTO public.kids_experiments (lab, topic, slug, title, emoji, summary, kind, content, color, order_index) VALUES
  ('math', 'add',        'addition-adventure',   'Addition Adventure',   '➕', 'Practice adding numbers.',        'activity', '{"op":"add","min":1,"max":20,"rounds":5}', 'primary',   0),
  ('math', 'subtract',   'subtraction-safari',   'Subtraction Safari',   '➖', 'Practice taking away.',           'activity', '{"op":"subtract","min":1,"max":20,"rounds":5}', 'secondary', 1),
  ('math', 'multiply',   'multiplication-magic', 'Multiplication Magic', '✖️', 'Practice times tables.',          'activity', '{"op":"multiply","min":1,"max":10,"rounds":5}', 'accent',   2),
  ('math', 'divide',     'division-quest',       'Division Quest',       '➗', 'Practice sharing equally.',       'activity', '{"op":"divide","min":1,"max":10,"rounds":5}', 'purple',    3),
  ('math', 'geometry',   'shape-explorer',       'Shape Explorer',       '🔺', 'Meet circles, squares, and more.','experiment', '{}', 'pink', 4),
  ('math', 'measurement','measure-it',           'Measure It!',          '📏', 'Length, weight, and time.',       'experiment', '{}', 'green', 5);
UPDATE public.kids_experiments SET steps = '["A circle is perfectly round.","A square has 4 equal sides.","A triangle has 3 sides.","Look around — shapes are everywhere!"]'::jsonb,
  quiz = '[{"q":"How many sides does a triangle have?","choices":["2","3","4"],"answer":1,"explain":"A triangle has 3 sides."}]'::jsonb
  WHERE lab = 'math' AND slug = 'shape-explorer';
UPDATE public.kids_experiments SET steps = '["We measure length with rulers.","We measure weight with scales.","We measure time with clocks.","Measuring helps us compare things!"]'::jsonb,
  quiz = '[{"q":"What do we use to measure length?","choices":["A ruler","A clock","A scale"],"answer":0,"explain":"A ruler measures how long something is."}]'::jsonb
  WHERE lab = 'math' AND slug = 'measure-it';

-- ── Engineering Lab (topic = bridges | towers | cars | houses)
INSERT INTO public.kids_experiments (lab, topic, slug, title, emoji, summary, kind, steps, quiz, color, order_index) VALUES
  ('engineering', 'bridges', 'build-a-bridge', 'Build a Bridge', '🌉', 'Strong shapes hold more weight.', 'experiment',
    '["Bridges cross rivers and roads.","Triangles make bridges strong.","Test it with a toy car.","Add supports to hold more weight!"]',
    '[{"q":"Which shape makes bridges strong?","choices":["Triangle","Circle","Star"],"answer":0,"explain":"Triangles spread out weight and stay strong."}]', 'pink', 0),
  ('engineering', 'towers', 'tall-towers', 'Tall Towers', '🗼', 'A wide base keeps towers standing.', 'experiment',
    '["Start with a wide, sturdy base.","Stack blocks carefully.","Keep the heavy parts low.","See how tall you can go!"]',
    '[{"q":"To build a tall tower, the base should be...","choices":["Wide and sturdy","Tiny","Wobbly"],"answer":0,"explain":"A wide base stops it from tipping over."}]', 'purple', 1),
  ('engineering', 'cars', 'faster-cars', 'Faster Cars', '🏎️', 'Smooth shapes go faster.', 'experiment',
    '["Cars have wheels that roll.","Smooth shapes cut through air.","Lighter cars go faster.","Design your speediest car!"]',
    '[{"q":"What helps a car go faster?","choices":["A smooth shape","More corners","Heavy weight"],"answer":0,"explain":"Smooth shapes let air flow past easily."}]', 'secondary', 2);

-- ── Electronics Lab (topic = batteries | circuits | bulbs | switches | sensors | solar)
INSERT INTO public.kids_experiments (lab, topic, slug, title, emoji, summary, kind, simulation, quiz, color, order_index) VALUES
  ('electronics', 'circuits', 'light-the-bulb', 'Light the Bulb', '💡', 'Complete a circuit to turn on a light.', 'simulation',
    '{"type":"circuit","params":{},"goal":"Flip the switch to close the circuit and light the bulb."}',
    '[{"q":"A bulb lights when the circuit is...","choices":["Open","Closed","Broken"],"answer":1,"explain":"A closed circuit lets electricity flow."}]', 'primary', 0);
INSERT INTO public.kids_experiments (lab, topic, slug, title, emoji, summary, kind, steps, quiz, color, order_index) VALUES
  ('electronics', 'batteries', 'battery-power', 'Battery Power', '🔋', 'Batteries store energy for later.', 'experiment',
    '["Batteries store electricity.","They have a + and a − end.","Energy flows from + to −.","When empty, we recharge or replace them."]',
    '[{"q":"What do batteries store?","choices":["Water","Energy","Sound"],"answer":1,"explain":"Batteries store electrical energy."}]', 'accent', 1),
  ('electronics', 'solar', 'solar-energy', 'Solar Energy', '☀️', 'Turn sunlight into electricity.', 'experiment',
    '["Solar panels catch sunlight.","They turn light into electricity.","No pollution — clean energy!","Great for a sunny day."]',
    '[{"q":"Solar panels use...","choices":["Sunlight","Wind","Coal"],"answer":0,"explain":"Solar panels turn sunlight into electricity."}]', 'green', 2);

-- ── Space Engineering (topic = rockets | orbits | missions | planets)
INSERT INTO public.kids_experiments (lab, topic, slug, title, emoji, summary, kind, simulation, steps, quiz, color, order_index) VALUES
  ('space', 'rockets', 'rocket-launch', 'Rocket Launch', '🚀', 'More thrust means a higher launch.', 'simulation',
    '{"type":"rocket","params":{"thrust":50},"goal":"Add thrust and launch your rocket higher."}',
    '[]',
    '[{"q":"What pushes a rocket up?","choices":["Thrust","Gravity","Wind"],"answer":0,"explain":"Thrust from the engines pushes the rocket up."}]', 'purple', 0);
INSERT INTO public.kids_experiments (lab, topic, slug, title, emoji, summary, kind, steps, quiz, color, order_index) VALUES
  ('space', 'orbits', 'why-orbits', 'Why Things Orbit', '🛰️', 'Satellites keep falling around Earth.', 'experiment',
    '["Gravity pulls satellites toward Earth.","They also move sideways very fast.","So they keep missing the ground.","That is an orbit!"]',
    '[{"q":"What keeps a satellite in orbit?","choices":["Gravity + speed","Magnets","Balloons"],"answer":0,"explain":"Gravity plus sideways speed makes an orbit."}]', 'primary', 1),
  ('space', 'missions', 'plan-a-mission', 'Plan a Mission', '🧑‍🚀', 'Every space trip needs a plan.', 'experiment',
    '["Pick a destination — Moon or Mars.","Pack fuel, food, and air.","Choose a safe launch day.","Blast off and explore!"]',
    '[{"q":"What must astronauts bring to space?","choices":["Air to breathe","Umbrellas","Bicycles"],"answer":0,"explain":"There is no air in space, so they bring their own."}]', 'secondary', 2);

-- ============================================================
-- kids_innovation_challenges — a weekly problem-solving prompt. The 5-phase
-- flow (problem → idea → solution → prototype → present) is guided client-side;
-- `content` carries hints per phase. `active_from`/`active_to` optionally window
-- a challenge; NULLs mean always available.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_innovation_challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  problem       TEXT NOT NULL,
  description   TEXT,
  emoji         TEXT NOT NULL DEFAULT '💡',
  theme         TEXT,
  content       JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward_xp     INTEGER NOT NULL DEFAULT 60 CHECK (reward_xp >= 0 AND reward_xp <= 60),
  reward_coins  INTEGER NOT NULL DEFAULT 30 CHECK (reward_coins >= 0 AND reward_coins <= 30),
  active_from   DATE,
  active_to     DATE,
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_innovation_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_innovation_challenges: public read published"
  ON public.kids_innovation_challenges FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_innovation_challenges: admins manage"
  ON public.kids_innovation_challenges FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_innovation_challenges (slug, title, problem, description, emoji, theme, content, order_index) VALUES
  ('save-water',   'Save Every Drop',    'How can we use less water at home?',       'Invent a clever way to save water every day.', '💧', 'environment',
    '{"hints":["Think about brushing teeth or watering plants.","Draw your idea.","How would it work?","Give your invention a name."]}', 0),
  ('clean-city',   'Cleaner Playground', 'How can we keep our playground clean?',     'Design something that helps everyone keep the playground tidy.', '🧹', 'community',
    '{"hints":["Where does litter pile up?","What would make cleaning fun?","Sketch your solution.","Explain how it helps."]}', 1),
  ('help-friend',  'Helping Hands',      'How can we help a friend who is far away?', 'Invent a way to stay close to friends who live far.', '🤝', 'kindness',
    '{"hints":["Think about talking or sharing.","What could you build or make?","Draw a prototype.","Present it to your family."]}', 2);

-- ============================================================
-- kids_research_articles — the Research Center: a friendly, simplified science
-- library. Public, non-personal. `fun_facts` is a JSONB array of short strings;
-- `images` is a JSONB array of { url, caption }.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_research_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'science',
  emoji         TEXT NOT NULL DEFAULT '📄',
  summary       TEXT,
  body          TEXT,
  images        JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_url     TEXT,
  fun_facts     JSONB NOT NULL DEFAULT '[]'::jsonb,
  reading_level TEXT NOT NULL DEFAULT 'easy' CHECK (reading_level IN ('easy', 'medium')),
  color         TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_research_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_research_articles: public read published"
  ON public.kids_research_articles FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_research_articles: admins manage"
  ON public.kids_research_articles FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_research_articles_cat ON public.kids_research_articles(category, order_index);

INSERT INTO public.kids_research_articles (slug, title, category, emoji, summary, body, fun_facts, color, order_index) VALUES
  ('why-sky-blue',   'Why Is the Sky Blue?',  'space',   '🌤️', 'Sunlight and air make the sky look blue.',
    'Sunlight looks white but is made of many colors. When it hits the air, blue light scatters the most, so the whole sky looks blue!',
    '["At sunset the sky turns red and orange.","On the Moon the sky is always black — no air!"]', 'primary', 0),
  ('how-plants-eat', 'How Do Plants Eat?',    'biology', '🌻', 'Plants make their own food from sunlight.',
    'Plants use sunlight, water, and air to make their own food in their leaves. This is called photosynthesis. They even make the oxygen we breathe!',
    '["A big tree can make oxygen for two people a day.","Leaves are green because of a helper called chlorophyll."]', 'green', 1),
  ('what-are-stars', 'What Are Stars?',       'space',   '⭐', 'Stars are giant balls of glowing gas.',
    'Stars are huge balls of hot, glowing gas — our Sun is a star too! They look tiny because they are very, very far away.',
    '["The Sun is the closest star to Earth.","Some stars are millions of times bigger than Earth."]', 'purple', 2),
  ('why-we-sleep',   'Why Do We Sleep?',      'biology', '😴', 'Sleep helps your body and brain rest.',
    'When you sleep, your body grows and repairs itself, and your brain sorts what you learned that day. That is why sleep makes you feel great!',
    '["Kids need about 9–11 hours of sleep.","Your brain is very busy while you sleep!"]', 'accent', 3);
