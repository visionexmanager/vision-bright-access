-- ============================================================
-- Migration: VisionKids Health, Wellness & Smart Companion (Phase 10) —
-- core catalogs.
--
-- Architecture note (same polymorphic discipline as kids_explorer_locations
-- and kids_talent_tracks): the browsable educational content across
-- Nutrition, Exercise Center, Mindfulness, Safety Academy, and First Aid Kids
-- is NOT five bespoke tables — it's ONE kids_wellness_lessons catalog
-- (category + topic discriminators + JSONB body/steps). Habits and Daily
-- Routine items likewise share ONE kids_wellness_habits table (kind +
-- routine_slot). Adding a new food, exercise, safety lesson, habit, or
-- routine step later is a data change, never a schema change.
--
-- PRIVACY: everything here is public, non-personal educational content
-- (public-read-when-published + admin-manage). NO personal health data is
-- stored in this migration. Per-child logs (mood/sleep/habits) live in
-- 20260816010000 under strict self-only RLS, are deliberately minimal, and
-- are never aggregated or shared. First Aid content is awareness-only — the
-- app repeatedly directs children to tell a grown-up and call local
-- emergency services, and never instructs risky procedures.
-- ============================================================

-- ============================================================
-- kids_wellness_habits — the Healthy Habits checklist AND the Daily Routine
-- steps, distinguished by `kind`. `routine_slot` groups routine steps
-- (morning / school / evening / weekend); habits use 'anytime'.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_wellness_habits (
  slug          TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  emoji         TEXT NOT NULL DEFAULT '✅',
  kind          TEXT NOT NULL DEFAULT 'habit' CHECK (kind IN ('habit', 'routine')),
  routine_slot  TEXT NOT NULL DEFAULT 'anytime' CHECK (routine_slot IN ('anytime', 'morning', 'school', 'evening', 'weekend')),
  color         TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  reward_xp     INTEGER NOT NULL DEFAULT 10 CHECK (reward_xp >= 0 AND reward_xp <= 20),
  reward_coins  INTEGER NOT NULL DEFAULT 5 CHECK (reward_coins >= 0 AND reward_coins <= 10),
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_wellness_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_wellness_habits: public read published"
  ON public.kids_wellness_habits FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_wellness_habits: admins manage"
  ON public.kids_wellness_habits FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_wellness_habits_kind ON public.kids_wellness_habits(kind, routine_slot, order_index);

INSERT INTO public.kids_wellness_habits (slug, title, description, emoji, kind, routine_slot, color, order_index) VALUES
  -- Healthy Habits
  ('brush-teeth',   'Brush Your Teeth',   'Twice a day keeps your smile bright.',           '🪥', 'habit', 'anytime', 'primary',   0),
  ('wash-hands',    'Wash Your Hands',    'Before eating and after playing.',               '🧼', 'habit', 'anytime', 'accent',    1),
  ('drink-water',   'Drink Water',        'Sip water through the day to stay energized.',   '💧', 'habit', 'anytime', 'secondary', 2),
  ('tidy-room',     'Tidy Your Room',     'A tidy space is a calm space.',                  '🧹', 'habit', 'anytime', 'purple',    3),
  ('read-book',     'Read a Book',        'A few pages a day grows your mind.',             '📖', 'habit', 'anytime', 'green',     4),
  ('be-active',     'Move Your Body',     'Run, jump, or play — get moving every day.',     '🤸', 'habit', 'anytime', 'pink',      5),
  ('less-screen',   'Less Screen Time',   'Take breaks from screens for your eyes.',        '📵', 'habit', 'anytime', 'primary',   6),
  -- Morning routine
  ('m-wake',        'Wake Up',            'Rise and shine!',                                '🌅', 'routine', 'morning', 'accent',   0),
  ('m-brush',       'Brush Teeth',        'Fresh start to the day.',                        '🪥', 'routine', 'morning', 'primary',  1),
  ('m-breakfast',   'Eat Breakfast',      'Fuel up for a great day.',                       '🥣', 'routine', 'morning', 'green',    2),
  ('m-dress',       'Get Dressed',        'Ready to go!',                                   '👕', 'routine', 'morning', 'purple',   3),
  -- School routine
  ('s-pack',        'Pack Your Bag',      'Books, water, and snack.',                       '🎒', 'routine', 'school', 'secondary', 0),
  ('s-listen',      'Listen & Learn',     'Do your best in class.',                         '✏️', 'routine', 'school', 'accent',    1),
  ('s-homework',    'Do Homework',        'Finish it before play.',                         '📚', 'routine', 'school', 'primary',   2),
  -- Evening routine
  ('e-dinner',      'Eat Dinner',         'A healthy meal with family.',                    '🍽️', 'routine', 'evening', 'green',    0),
  ('e-bath',        'Wash Up',            'Get clean before bed.',                          '🛁', 'routine', 'evening', 'accent',    1),
  ('e-brush',       'Brush Teeth',        'Clean teeth for the night.',                     '🪥', 'routine', 'evening', 'primary',  2),
  ('e-pajamas',     'Put On Pajamas',     'Cozy and ready for sleep.',                      '👚', 'routine', 'evening', 'purple',   3),
  -- Weekend routine
  ('w-outdoors',    'Play Outside',       'Fresh air and fun.',                             '🌳', 'routine', 'weekend', 'green',    0),
  ('w-help',        'Help at Home',       'Lend a hand with a chore.',                      '🧺', 'routine', 'weekend', 'pink',     1),
  ('w-hobby',       'Do a Hobby',         'Draw, build, or create.',                        '🎨', 'routine', 'weekend', 'purple',   2)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_wellness_lessons — polymorphic browsable content. `category` is the
-- big group (nutrition/exercise/mindfulness/safety/first_aid); `topic` is a
-- per-category sub-type. `steps` is an ordered JSONB list (exercise moves,
-- breathing steps, first-aid awareness steps); `content` carries extra
-- per-category fields. `duration_seconds` powers the guided timer on
-- exercise/mindfulness lessons.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_wellness_lessons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         TEXT NOT NULL CHECK (category IN ('nutrition', 'exercise', 'mindfulness', 'safety', 'first_aid')),
  topic            TEXT NOT NULL,
  slug             TEXT NOT NULL,
  title            TEXT NOT NULL,
  emoji            TEXT NOT NULL DEFAULT '✨',
  summary          TEXT,
  body             TEXT,
  steps            JSONB NOT NULL DEFAULT '[]'::jsonb,
  content          JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds INTEGER,
  color            TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  order_index      INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, slug)
);

ALTER TABLE public.kids_wellness_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_wellness_lessons: public read published"
  ON public.kids_wellness_lessons FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_wellness_lessons: admins manage"
  ON public.kids_wellness_lessons FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_wellness_lessons_cat ON public.kids_wellness_lessons(category, topic, order_index);

-- Nutrition (topic = fruit | vegetable | protein | grain | meal | tip)
INSERT INTO public.kids_wellness_lessons (category, topic, slug, title, emoji, summary, body, content, color, order_index) VALUES
  ('nutrition', 'fruit',     'apples',       'Apples',        '🍎', 'Crunchy and sweet, full of fiber.',         'Apples give you energy and help your tummy. An apple a day is a tasty habit!', '{"group":"fruit"}', 'pink',      0),
  ('nutrition', 'fruit',     'bananas',      'Bananas',       '🍌', 'Soft, sweet, and full of potassium.',       'Bananas give quick energy and help your muscles — great before playing.',       '{"group":"fruit"}', 'green',     1),
  ('nutrition', 'vegetable', 'carrots',      'Carrots',       '🥕', 'Crunchy orange veggies good for your eyes.', 'Carrots have vitamin A which helps you see well, even in the dark!',            '{"group":"vegetable"}', 'accent',  2),
  ('nutrition', 'vegetable', 'broccoli',     'Broccoli',      '🥦', 'Little green trees packed with vitamins.',   'Broccoli keeps you strong and healthy. Try it steamed with a little lemon.',    '{"group":"vegetable"}', 'green',   3),
  ('nutrition', 'protein',   'eggs',         'Eggs',          '🥚', 'A protein powerhouse to help you grow.',     'Protein builds your muscles and keeps you full. Eggs are an easy way to get it.','{"group":"protein"}', 'secondary', 4),
  ('nutrition', 'protein',   'beans',        'Beans',         '🫘', 'Tiny but mighty plant protein.',            'Beans give you protein and fiber and keep your energy steady.',                 '{"group":"protein"}', 'purple',   5),
  ('nutrition', 'grain',     'oats',         'Oats',          '🌾', 'Warm, filling whole grains.',               'Whole grains like oats give you long-lasting energy for school and play.',      '{"group":"grain"}', 'accent',    6),
  ('nutrition', 'meal',      'balanced-plate','The Healthy Plate','🍽️','Half veggies & fruit, a quarter grains, a quarter protein.','A balanced plate has lots of colors: fill half with fruits and veggies, a quarter with whole grains, and a quarter with protein.','{"group":"meal"}','primary',7),
  ('nutrition', 'tip',       'rainbow-food', 'Eat the Rainbow','🌈', 'Different colors give different vitamins.',  'Try to eat foods of many colors each day — red, orange, yellow, green, and purple!','{"group":"tip"}','pink',   8);

-- Exercise (topic = yoga | stretch | balance | dance | workout)
INSERT INTO public.kids_wellness_lessons (category, topic, slug, title, emoji, summary, steps, duration_seconds, color, order_index) VALUES
  ('exercise', 'yoga',    'tree-pose',    'Tree Pose',        '🌳', 'A calm balancing yoga pose.',
    '["Stand tall and still.","Rest one foot on your other leg.","Reach your arms up like branches.","Breathe slowly and hold.","Switch legs and try again."]', 60, 'green',  0),
  ('exercise', 'stretch', 'reach-stretch','Reach & Stretch',  '🙆', 'Wake up your whole body.',
    '["Reach both arms up high.","Stretch to the left, then right.","Touch your toes gently.","Roll your shoulders back."]', 45, 'accent', 1),
  ('exercise', 'balance', 'flamingo',     'Flamingo Balance', '🦩', 'Stand on one leg like a flamingo.',
    '["Stand on one leg.","Hold your arms out.","Count to ten.","Switch to the other leg."]', 40, 'pink',   2),
  ('exercise', 'dance',   'freeze-dance', 'Freeze Dance',     '🕺', 'Dance, then freeze!',
    '["Play your favorite song.","Dance any way you like.","Freeze when the music stops.","Dance again!"]', 90, 'purple', 3),
  ('exercise', 'workout', 'jumping-jacks','Jumping Jacks',    '🤸', 'A quick energy booster.',
    '["Stand with feet together.","Jump and spread your arms and legs.","Jump back together.","Repeat 10 times."]', 30, 'secondary', 4);

-- Mindfulness (topic = breathing | focus | gratitude | relaxation | positive)
INSERT INTO public.kids_wellness_lessons (category, topic, slug, title, emoji, summary, steps, duration_seconds, color, order_index) VALUES
  ('mindfulness', 'breathing', 'balloon-breath', 'Balloon Breathing', '🎈', 'Slow breaths to feel calm.',
    '["Sit comfortably.","Breathe in slowly like filling a balloon.","Hold for a moment.","Breathe out slowly.","Repeat five times."]', 60, 'accent', 0),
  ('mindfulness', 'relaxation','body-relax',     'Calm Body',         '🧘', 'Relax from head to toes.',
    '["Close your eyes.","Relax your face.","Relax your shoulders and arms.","Relax your legs and toes.","Notice how calm you feel."]', 90, 'purple', 1),
  ('mindfulness', 'focus',     'five-senses',    'Five Senses',       '🌟', 'Notice the world around you.',
    '["Name 5 things you can see.","4 things you can touch.","3 things you can hear.","2 things you can smell.","1 thing you can taste."]', 60, 'primary', 2),
  ('mindfulness', 'gratitude', 'three-good',     'Three Good Things', '🙏', 'Think of good things today.',
    '["Think of one good thing that happened.","Think of a person you are thankful for.","Think of something you are proud of."]', 45, 'green', 3),
  ('mindfulness', 'positive',  'kind-words',     'Kind Words to Me',  '💛', 'Say something kind to yourself.',
    '["Take a deep breath.","Say: I am kind.","Say: I can try my best.","Say: I am learning and growing."]', 40, 'pink', 4);

-- Safety Academy (topic = home | online | school | road | fire)
INSERT INTO public.kids_wellness_lessons (category, topic, slug, title, emoji, summary, steps, color, order_index) VALUES
  ('safety', 'home',   'home-safety',   'Home Safety',     '🏠', 'Stay safe around the house.',
    '["Keep away from sharp things and hot stoves.","Do not open the door to strangers.","Tell a grown-up if something breaks or spills.","Know where your grown-ups are."]', 'primary', 0),
  ('safety', 'online', 'online-safety', 'Online Safety',   '💻', 'Be smart and safe online.',
    '["Never share your name, address, or photos with strangers.","Tell a grown-up if something online feels scary or mean.","Only talk to people you know in real life.","Keep passwords secret."]', 'accent', 1),
  ('safety', 'school', 'school-safety', 'School Safety',   '🏫', 'Stay safe at school.',
    '["Walk, do not run, in the halls.","Follow your teacher''s instructions.","Be kind and tell a teacher if someone is hurt.","Know your way to a safe adult."]', 'secondary', 2),
  ('safety', 'road',   'road-safety',   'Road Safety',     '🚦', 'Cross streets safely.',
    '["Stop at the curb.","Look left, right, and left again.","Cross when it is clear and hold a grown-up''s hand.","Always use the crosswalk."]', 'green', 3),
  ('safety', 'fire',   'fire-safety',   'Fire Safety',     '🔥', 'Know what to do about fire.',
    '["Never play with matches or lighters.","If you see fire, tell a grown-up right away.","If there is smoke, stay low and get out.","Know your family''s meeting spot outside."]', 'pink', 4);

-- First Aid Kids (AWARENESS ONLY — topic = scratch | burn | nosebleed | choking | get_help)
INSERT INTO public.kids_wellness_lessons (category, topic, slug, title, emoji, summary, body, steps, color, order_index) VALUES
  ('first_aid', 'scratch',   'small-scratches', 'Small Scratches', '🩹', 'What to do for a little scratch.',
    'For a small scratch, a grown-up can help you clean it and put on a bandage.',
    '["Tell a grown-up.","Rinse it gently with clean water.","A grown-up puts on a clean bandage.","Keep it clean."]', 'accent', 0),
  ('first_aid', 'burn',      'minor-burns',     'Minor Burns',     '🧊', 'Cool a little burn with water.',
    'For a small burn, cool water helps. Always tell a grown-up right away.',
    '["Tell a grown-up immediately.","Run cool (not icy) water over it.","Do not pop any blisters.","Let a grown-up decide what to do next."]', 'secondary', 1),
  ('first_aid', 'nosebleed', 'nosebleeds',      'Nosebleeds',      '🤧', 'Sit, lean forward, and pinch.',
    'A nosebleed can look scary but usually stops soon. Tell a grown-up.',
    '["Tell a grown-up.","Sit down and lean forward a little.","Gently pinch the soft part of your nose.","Wait quietly for a few minutes."]', 'pink', 2),
  ('first_aid', 'choking',   'choking-aware',   'Choking (Learn Only)', '⚠️', 'Awareness only — get a grown-up fast.',
    'Choking is serious. This is only to help you understand — always get a grown-up or call emergency services right away.',
    '["If someone cannot breathe, get a grown-up immediately.","Call your local emergency number.","Stay with the person and stay calm.","Let trained grown-ups help."]', 'primary', 3),
  ('first_aid', 'get_help',  'asking-for-help', 'Asking for Help', '🆘', 'How to get help fast.',
    'Knowing how to ask for help is a superpower. Practice it with your family.',
    '["Find a grown-up you trust.","Speak clearly: what happened and where.","Call your local emergency number if it is serious.","Stay calm and stay safe."]', 'green', 4);

-- ============================================================
-- kids_healthy_challenges — Healthy Challenges catalog (daily/weekly).
-- `metric` names what is being tracked; `target_value`/`unit` are the goal.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_healthy_challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT,
  emoji         TEXT NOT NULL DEFAULT '🏅',
  period        TEXT NOT NULL DEFAULT 'daily' CHECK (period IN ('daily', 'weekly')),
  metric        TEXT NOT NULL CHECK (metric IN ('water', 'walk', 'read', 'sleep', 'exercise')),
  target_value  INTEGER NOT NULL DEFAULT 1 CHECK (target_value > 0),
  unit          TEXT,
  reward_xp     INTEGER NOT NULL DEFAULT 30 CHECK (reward_xp >= 0 AND reward_xp <= 40),
  reward_coins  INTEGER NOT NULL DEFAULT 15 CHECK (reward_coins >= 0 AND reward_coins <= 20),
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_healthy_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_healthy_challenges: public read published"
  ON public.kids_healthy_challenges FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_healthy_challenges: admins manage"
  ON public.kids_healthy_challenges FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_healthy_challenges (slug, title, description, emoji, period, metric, target_value, unit, reward_xp, reward_coins, order_index) VALUES
  ('daily-water',    'Water Hero',      'Drink 6 cups of water today.',        '💧', 'daily',  'water',    6, 'cups',    30, 15, 0),
  ('daily-walk',     'Happy Steps',     'Walk or play actively for 20 minutes.','🚶', 'daily',  'walk',    20, 'minutes', 30, 15, 1),
  ('daily-read',     'Reading Time',    'Read for 15 minutes today.',          '📖', 'daily',  'read',    15, 'minutes', 30, 15, 2),
  ('daily-sleep',    'Early to Bed',    'Get to bed on time tonight.',         '🌙', 'daily',  'sleep',    1, 'night',   30, 15, 3),
  ('daily-exercise', 'Move & Groove',   'Do 15 minutes of exercise.',          '🤸', 'daily',  'exercise',15, 'minutes', 30, 15, 4),
  ('weekly-water',   'Hydration Week',  'Hit your water goal 5 days this week.','💧', 'weekly', 'water',    5, 'days',    40, 20, 5),
  ('weekly-active',  'Active Week',     'Be active 5 days this week.',         '🏃', 'weekly', 'walk',     5, 'days',    40, 20, 6),
  ('weekly-reader',  'Bookworm Week',   'Read 5 days this week.',              '📚', 'weekly', 'read',     5, 'days',    40, 20, 7)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_emergency_numbers — reference list of local emergency numbers, per
-- country. Public read. IMPORTANT: these are a convenience only — the UI
-- always tells the child to confirm the right number with a parent, and lets
-- a family set their own in kids_wellness_settings (next migration). Seeded
-- with a small, clearly-labeled set, not an authoritative global directory.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_emergency_numbers (
  country_code  TEXT PRIMARY KEY,
  country_name  TEXT NOT NULL,
  general       TEXT,
  police        TEXT,
  ambulance     TEXT,
  fire          TEXT,
  note          TEXT,
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_emergency_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_emergency_numbers: public read published"
  ON public.kids_emergency_numbers FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_emergency_numbers: admins manage"
  ON public.kids_emergency_numbers FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_emergency_numbers (country_code, country_name, general, police, ambulance, fire, note, order_index) VALUES
  ('INTL', 'General (many countries)', '112', '112', '112', '112', 'In many countries 112 reaches emergency services. Always check the right number for where you live with a parent.', 0),
  ('US',   'United States',            '911', '911', '911', '911', 'Confirm with a parent.', 1),
  ('EU',   'European Union',           '112', '112', '112', '112', 'Confirm with a parent.', 2),
  ('UK',   'United Kingdom',           '999', '999', '999', '999', 'Confirm with a parent.', 3),
  ('LB',   'Lebanon',                  NULL,  '112', '140', '175', 'Confirm the current numbers with a parent.', 4),
  ('AE',   'United Arab Emirates',     '999', '999', '998', '997', 'Confirm with a parent.', 5),
  ('SA',   'Saudi Arabia',             '911', '999', '997', '998', 'Confirm with a parent.', 6),
  ('EG',   'Egypt',                    '123', '122', '123', '180', 'Confirm with a parent.', 7)
ON CONFLICT (country_code) DO NOTHING;
