-- ============================================================
-- Migration: VisionKids Talent Hub & Future Skills (Phase 9) — core catalogs.
--
-- Architecture note (same polymorphic discipline as kids_explorer_locations
-- in 20260812000000 and kids_creative_projects in 20260811000000): the 10
-- "academies" (Coding, Robotics, AI, Music, Art, Writing, Public Speaking,
-- Entrepreneurship, Financial Literacy, Innovation Lab) are NOT 10 bespoke
-- tables — they are rows in ONE kids_talent_tracks catalog, each with an
-- ordered set of kids_track_modules rows. Adding an 11th track later is a
-- data change (new track + modules), never a schema change, and the whole
-- set is served by ONE generic TrackDetail template on the client — directly
-- satisfying "قابل للتوسع لإضافة مجالات ومهارات جديدة مستقبلاً".
--
-- Every catalog here is public-read-when-published + admin-manage, matching
-- kids_explorer_worlds. User progress (assessment results, skill/module
-- completion, portfolio, mentor bookings) lives in the next migration
-- (20260815010000); gamification RPCs/achievements/certificate in
-- 20260815020000.
-- ============================================================

-- ============================================================
-- kids_talent_domains — the 10 talent areas the assessment maps a child to,
-- and the axis every skill / track / career is tagged against.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_talent_domains (
  slug          TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  emoji         TEXT NOT NULL DEFAULT '✨',
  color         TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_talent_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_talent_domains: public read published"
  ON public.kids_talent_domains FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_talent_domains: admins manage"
  ON public.kids_talent_domains FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_talent_domains (slug, title, description, emoji, color, order_index) VALUES
  ('creativity',      'Creativity',       'Imagining new ideas and expressing them.',            '🎨', 'pink',      0),
  ('logic',           'Logic',            'Thinking step by step and spotting patterns.',        '🧩', 'purple',    1),
  ('math',            'Math',             'Playing with numbers, shapes, and quantities.',       '🔢', 'primary',   2),
  ('language',        'Language',         'Words, reading, writing, and storytelling.',          '📖', 'accent',    3),
  ('drawing',         'Drawing',          'Seeing and making pictures and designs.',             '✏️', 'pink',      4),
  ('music',           'Music',            'Rhythm, melody, and sound.',                          '🎵', 'green',     5),
  ('science',         'Science',          'Asking questions and running experiments.',           '🔬', 'secondary', 6),
  ('coding',          'Coding',           'Giving instructions to computers.',                   '💻', 'purple',    7),
  ('leadership',      'Leadership',       'Guiding a team and making decisions.',                '🧭', 'accent',    8),
  ('problem_solving', 'Problem Solving',  'Finding smart ways around tricky challenges.',        '💡', 'primary',   9)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_talent_assessment_questions — the interactive "discover your talents"
-- quiz. Each option carries a JSONB weight map { domain_slug: points } that
-- the client sums into per-domain scores; no answer is "wrong" — it's a
-- preference profiler, not a test. `options` shape:
--   [{ "id": "a", "label": "...", "emoji": "🎨", "weights": {"creativity": 2, "drawing": 1} }]
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_talent_assessment_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt        TEXT NOT NULL,
  emoji         TEXT NOT NULL DEFAULT '❓',
  options       JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_talent_assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_talent_assessment_questions: public read published"
  ON public.kids_talent_assessment_questions FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_talent_assessment_questions: admins manage"
  ON public.kids_talent_assessment_questions FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_talent_assessment_questions (prompt, emoji, order_index, options) VALUES
  ('On a free afternoon, what sounds most fun?', '🌈', 0, '[
    {"id":"a","label":"Draw or paint something","emoji":"🎨","weights":{"creativity":2,"drawing":2}},
    {"id":"b","label":"Build or fix a gadget","emoji":"🔧","weights":{"logic":2,"problem_solving":2}},
    {"id":"c","label":"Read or write a story","emoji":"📖","weights":{"language":2,"creativity":1}},
    {"id":"d","label":"Play or make music","emoji":"🎵","weights":{"music":2}}
  ]'),
  ('A puzzle is really hard. What do you do?', '🧩', 1, '[
    {"id":"a","label":"Try lots of clever ways until it works","emoji":"💡","weights":{"problem_solving":2,"logic":1}},
    {"id":"b","label":"Look for the pattern or rule","emoji":"🔍","weights":{"logic":2,"math":1}},
    {"id":"c","label":"Ask friends and solve it together","emoji":"🤝","weights":{"leadership":2}},
    {"id":"d","label":"Turn it into a game or story","emoji":"✨","weights":{"creativity":2}}
  ]'),
  ('Which school moment do you enjoy most?', '🏫', 2, '[
    {"id":"a","label":"Math and number games","emoji":"🔢","weights":{"math":2,"logic":1}},
    {"id":"b","label":"Science experiments","emoji":"🔬","weights":{"science":2}},
    {"id":"c","label":"Reading and writing","emoji":"📝","weights":{"language":2}},
    {"id":"d","label":"Art and crafts","emoji":"🖌️","weights":{"drawing":2,"creativity":1}}
  ]'),
  ('If you made your own app or robot, it would…', '🤖', 3, '[
    {"id":"a","label":"Do something helpful and smart","emoji":"💻","weights":{"coding":2,"problem_solving":1}},
    {"id":"b","label":"Look amazing and colorful","emoji":"🎨","weights":{"drawing":2,"creativity":1}},
    {"id":"c","label":"Play music or sounds","emoji":"🎶","weights":{"music":2}},
    {"id":"d","label":"Teach or tell people things","emoji":"📢","weights":{"language":1,"leadership":2}}
  ]'),
  ('Your friends would say you are the one who…', '⭐', 4, '[
    {"id":"a","label":"Comes up with the best ideas","emoji":"💡","weights":{"creativity":2}},
    {"id":"b","label":"Explains things clearly","emoji":"🗣️","weights":{"language":1,"leadership":2}},
    {"id":"c","label":"Never gives up on a problem","emoji":"🧗","weights":{"problem_solving":2}},
    {"id":"d","label":"Loves figuring out how things work","emoji":"⚙️","weights":{"science":1,"logic":2}}
  ]'),
  ('Pick the prize you would want to win!', '🏆', 5, '[
    {"id":"a","label":"A robotics kit","emoji":"🤖","weights":{"coding":1,"problem_solving":1,"science":1}},
    {"id":"b","label":"A set of paints and brushes","emoji":"🎨","weights":{"drawing":2,"creativity":1}},
    {"id":"c","label":"A musical instrument","emoji":"🎸","weights":{"music":2}},
    {"id":"d","label":"A stack of great books","emoji":"📚","weights":{"language":2}}
  ]')
ON CONFLICT DO NOTHING;

-- ============================================================
-- kids_skills — the Skill Tree. Each skill belongs to a domain, sits at a
-- `tier` (0 = root, unlocked from the start), and lists its prerequisite
-- skill slugs. "Next skills" are derived by reverse lookup on prerequisites,
-- so the graph is defined in exactly one place. `tasks` is an ordered JSONB
-- checklist shown on the skill; `quiz`/`badge_key` tie into the shared quiz
-- and achievement systems. XP/coins are granted on completion (capped by the
-- award_kids_* reason 'Skill mastered:%' added in 20260815020000).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_skills (
  slug            TEXT PRIMARY KEY,
  domain_slug     TEXT NOT NULL REFERENCES public.kids_talent_domains(slug) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  emoji           TEXT NOT NULL DEFAULT '⭐',
  tier            INTEGER NOT NULL DEFAULT 0,
  prerequisites   TEXT[] NOT NULL DEFAULT '{}',
  tasks           JSONB NOT NULL DEFAULT '[]'::jsonb,
  badge_key       TEXT,
  reward_xp       INTEGER NOT NULL DEFAULT 20 CHECK (reward_xp >= 0 AND reward_xp <= 60),
  reward_coins    INTEGER NOT NULL DEFAULT 10 CHECK (reward_coins >= 0 AND reward_coins <= 30),
  order_index     INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_skills: public read published"
  ON public.kids_skills FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_skills: admins manage"
  ON public.kids_skills FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_skills_domain ON public.kids_skills(domain_slug, tier, order_index);

INSERT INTO public.kids_skills (slug, domain_slug, title, description, emoji, tier, prerequisites, tasks, reward_xp, reward_coins, order_index) VALUES
  ('coding-basics',    'coding', 'Coding Basics',        'Understand what a program is and how instructions run in order.', '💻', 0, '{}',                          '["Watch the intro","Order 3 instruction blocks","Answer the mini quiz"]', 20, 10, 0),
  ('loops',            'coding', 'Loops & Repeats',      'Make the computer repeat actions without copying them.',           '🔁', 1, '{coding-basics}',            '["Build a loop","Repeat a drawing 4 times"]', 25, 12, 1),
  ('conditionals',     'coding', 'If / Then Logic',      'Make your program make decisions.',                                '🔀', 1, '{coding-basics}',            '["Add an if-block","Make a yes/no game"]', 25, 12, 2),
  ('first-app',        'coding', 'Build Your First App', 'Combine loops and logic into a tiny working app.',                 '🚀', 2, '{loops,conditionals}',       '["Plan your app","Build it","Share it in your Portfolio"]', 40, 20, 3),
  ('shapes-lines',     'drawing','Shapes & Lines',       'The building blocks of every drawing.',                            '✏️', 0, '{}',                          '["Draw 5 shapes","Combine them into an object"]', 20, 10, 0),
  ('color-theory',     'drawing','Color Magic',          'How colors mix and work together.',                                '🌈', 1, '{shapes-lines}',             '["Mix warm and cool colors","Color a scene"]', 25, 12, 1),
  ('character-design', 'drawing','Design a Character',   'Turn shapes and colors into your own character.',                  '🦸', 2, '{color-theory}',             '["Sketch a character","Give it a name and story"]', 40, 20, 2),
  ('rhythm',           'music',  'Feel the Rhythm',      'Clap, tap, and keep a steady beat.',                               '🥁', 0, '{}',                          '["Copy 3 rhythms","Make your own beat"]', 20, 10, 0),
  ('melody',           'music',  'Make a Melody',        'Put notes together into a tune.',                                  '🎹', 1, '{rhythm}',                   '["Play a scale","Compose a short melody"]', 25, 12, 1),
  ('number-sense',     'math',   'Number Sense',         'Feel comfortable with numbers and counting.',                      '🔢', 0, '{}',                          '["Count challenges","Compare numbers"]', 20, 10, 0),
  ('mental-math',      'math',   'Mental Math',          'Add and subtract quickly in your head.',                           '🧠', 1, '{number-sense}',             '["Beat the timer","Solve 10 in a row"]', 25, 12, 1),
  ('storytelling',     'language','Storytelling',        'Tell a story with a beginning, middle, and end.',                  '📖', 0, '{}',                          '["Plan a story","Write 3 sentences"]', 20, 10, 0),
  ('speak-up',         'leadership','Speak Up',          'Share your idea clearly and with confidence.',                     '🗣️', 0, '{}',                          '["Record a short intro","Present one idea"]', 20, 10, 0),
  ('curious-scientist','science','Curious Scientist',    'Ask a question and test it like a scientist.',                     '🔬', 0, '{}',                          '["Ask a why-question","Run a safe experiment"]', 20, 10, 0)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_talent_tracks — the 10 academies/labs, one row each. `kind` groups
-- them for the hub; `primary_domain` ties a track to the assessment so the
-- hub can recommend tracks that match a child's top talents.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_talent_tracks (
  slug            TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  emoji           TEXT NOT NULL DEFAULT '🎓',
  color           TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  primary_domain  TEXT REFERENCES public.kids_talent_domains(slug) ON DELETE SET NULL,
  is_future_track BOOLEAN NOT NULL DEFAULT false,
  order_index     INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_talent_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_talent_tracks: public read published"
  ON public.kids_talent_tracks FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_talent_tracks: admins manage"
  ON public.kids_talent_tracks FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_talent_tracks (slug, title, description, emoji, color, primary_domain, is_future_track, order_index) VALUES
  ('coding-academy',      'Coding Academy',        'Scratch, Blockly, Python, and your first web pages.',        '💻', 'purple',    'coding',          true,  0),
  ('robotics-lab',        'Robotics Lab',          'Sensors, motors, and programming robots.',                   '🤖', 'secondary', 'problem_solving', true,  1),
  ('ai-playground',       'AI Playground',         'What AI is, and fun little AI experiments.',                 '🧠', 'accent',    'science',         true,  2),
  ('music-academy',       'Music Academy',         'Rhythm, piano, drums, guitar, and composing.',               '🎵', 'green',     'music',           false, 3),
  ('art-academy',         'Art Academy',           'Drawing, coloring, digital art, and character design.',      '🎨', 'pink',      'drawing',         false, 4),
  ('writing-academy',     'Writing Academy',       'Stories, poems, dialogue, and imagination.',                 '✍️', 'accent',    'language',        false, 5),
  ('public-speaking',     'Public Speaking',       'Delivery, confidence, communication, and presenting.',       '🎤', 'primary',   'leadership',      false, 6),
  ('entrepreneurship',    'Entrepreneurship Kids', 'Idea, product, customer, marketing, and money.',             '🚀', 'secondary', 'leadership',      true,  7),
  ('financial-literacy',  'Financial Literacy',    'Saving, budgeting, spending, and investing — kid-sized.',    '💰', 'green',     'math',            false, 8),
  ('innovation-lab',      'Innovation Lab',        'Weekly innovation challenges, projects, and experiments.',   '💡', 'purple',    'creativity',      true,  9)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_track_modules — ordered lessons/activities/projects within a track.
-- `kind` lets the client pick a renderer (a reading lesson, an interactive
-- activity, or a portfolio-producing project). `content` is per-kind JSONB
-- (e.g. a lesson's body, an activity's config), documented by convention,
-- not schema — same approach as kids_explorer_locations.content.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_track_modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_slug    TEXT NOT NULL REFERENCES public.kids_talent_tracks(slug) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  emoji         TEXT NOT NULL DEFAULT '📘',
  kind          TEXT NOT NULL DEFAULT 'lesson' CHECK (kind IN ('lesson', 'activity', 'project')),
  content       JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward_xp     INTEGER NOT NULL DEFAULT 25 CHECK (reward_xp >= 0 AND reward_xp <= 60),
  reward_coins  INTEGER NOT NULL DEFAULT 12 CHECK (reward_coins >= 0 AND reward_coins <= 30),
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (track_slug, slug)
);

ALTER TABLE public.kids_track_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_track_modules: public read published"
  ON public.kids_track_modules FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_track_modules: admins manage"
  ON public.kids_track_modules FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_track_modules_track ON public.kids_track_modules(track_slug, order_index);

INSERT INTO public.kids_track_modules (track_slug, slug, title, description, emoji, kind, content, order_index) VALUES
  -- Coding Academy
  ('coding-academy', 'scratch-intro',   'Meet Scratch',          'Drag-and-drop blocks to make a cat move.',           '🐱', 'activity', '{"body":"Scratch uses colorful blocks you snap together like LEGO to tell the computer what to do. No typing needed!","activity":"block_sequence"}', 0),
  ('coding-academy', 'blockly-loops',   'Blockly Loops',         'Use Blockly to repeat actions with loops.',          '🔁', 'activity', '{"body":"A loop tells the computer to repeat something. Instead of 4 move blocks, use 1 loop that repeats 4 times."}', 1),
  ('coding-academy', 'python-hello',    'Python: Hello!',        'Write your very first line of Python.',              '🐍', 'lesson',   '{"body":"In Python we can print words to the screen with print(\"Hello!\"). Python reads your code from top to bottom."}', 2),
  ('coding-academy', 'html-page',       'My First Web Page',     'Build a page with HTML headings and text.',          '🌐', 'lesson',   '{"body":"HTML uses tags like <h1> for a big heading and <p> for a paragraph to build web pages."}', 3),
  ('coding-academy', 'css-colors',      'Color It with CSS',     'Style your page with colors and fonts.',             '🎨', 'lesson',   '{"body":"CSS decorates your HTML — it sets colors, sizes, and fonts so your page looks great."}', 4),
  ('coding-academy', 'coding-project',  'Build a Mini Game',     'Combine what you learned into a small game.',        '🎮', 'project',  '{"body":"Design and build a tiny game, then save it to your Portfolio!"}', 5),
  -- Robotics Lab
  ('robotics-lab', 'what-is-robot',     'What Is a Robot?',      'Machines that sense, think, and act.',               '🤖', 'lesson',   '{"body":"A robot senses the world (sensors), decides what to do (a program), and acts (motors)."}', 0),
  ('robotics-lab', 'sensors',           'Sensors',               'How robots feel light, distance, and touch.',        '📡', 'lesson',   '{"body":"Sensors are a robot''s senses — light sensors, distance sensors, and touch sensors."}', 1),
  ('robotics-lab', 'motors',            'Motors',                'How robots move and turn.',                          '⚙️', 'lesson',   '{"body":"Motors spin wheels and arms. Change their speed and direction to make a robot move."}', 2),
  ('robotics-lab', 'robot-sim',         'Robot Simulator',       'Program a virtual robot through a maze.',             '🕹️', 'activity', '{"body":"Give the robot a list of moves to reach the goal without hitting a wall.","activity":"robot_maze"}', 3),
  -- AI Playground
  ('ai-playground', 'what-is-ai',       'What Is AI?',           'Computers that learn from examples.',                '🧠', 'lesson',   '{"body":"AI learns patterns from lots of examples, then makes guesses about new things it has never seen."}', 0),
  ('ai-playground', 'teach-machine',    'Teach the Machine',     'Show examples and watch it learn to sort them.',     '🎓', 'activity', '{"body":"Sort pictures into two groups and see how the computer learns the pattern.","activity":"classify"}', 1),
  ('ai-playground', 'ai-project',       'AI Idea Lab',           'Invent a helpful AI and describe how it works.',     '💡', 'project',  '{"body":"Dream up an AI that helps people, and add it to your Portfolio."}', 2),
  -- Music Academy
  ('music-academy', 'rhythm-basics',    'Rhythm Basics',         'Clap and keep a steady beat.',                       '🥁', 'activity', '{"body":"Music has a beat like a heartbeat. Clap along and keep it steady."}', 0),
  ('music-academy', 'piano-keys',       'Piano Keys',            'Find the notes on a keyboard.',                      '🎹', 'lesson',   '{"body":"The white keys repeat a pattern of 7 notes: C D E F G A B."}', 1),
  ('music-academy', 'compose',          'Compose a Tune',        'Put notes together into your own melody.',           '🎼', 'project',  '{"body":"Create a short melody and save it to your Portfolio."}', 2),
  -- Art Academy
  ('art-academy', 'art-shapes',         'Shapes & Lines',        'Every drawing starts with simple shapes.',           '✏️', 'activity', '{"body":"Circles, squares, and triangles combine into anything you can imagine."}', 0),
  ('art-academy', 'art-color',          'Colors',                'Mix and match colors that work together.',           '🌈', 'lesson',   '{"body":"Warm colors (red, orange) feel cozy; cool colors (blue, green) feel calm."}', 1),
  ('art-academy', 'art-character',      'Design a Character',    'Create your own character from scratch.',            '🦸', 'project',  '{"body":"Design a character, name it, and save it to your Portfolio."}', 2),
  -- Writing Academy
  ('writing-academy', 'story-parts',    'Parts of a Story',      'Beginning, middle, and end.',                        '📖', 'lesson',   '{"body":"Every story has a beginning (meet the hero), a middle (a problem), and an end (a solution)."}', 0),
  ('writing-academy', 'write-poem',     'Write a Poem',          'Play with rhyme and rhythm in words.',               '🪶', 'activity', '{"body":"Poems paint pictures with words. Try making two lines that rhyme."}', 1),
  ('writing-academy', 'write-story',    'Write Your Story',      'Write a short story and save it.',                   '✍️', 'project',  '{"body":"Write a short story and add it to your Portfolio."}', 2),
  -- Public Speaking
  ('public-speaking', 'confidence',     'Confidence',            'Stand tall and breathe before you speak.',           '💪', 'lesson',   '{"body":"Take a deep breath, stand tall, and smile. Everyone gets nervous — that''s normal!"}', 0),
  ('public-speaking', 'clear-voice',    'A Clear Voice',         'Speak slowly and clearly so everyone hears you.',    '🗣️', 'activity', '{"body":"Practice saying a sentence slowly and clearly, like a news reporter."}', 1),
  ('public-speaking', 'mini-talk',      'Give a Mini Talk',      'Present one idea for 30 seconds.',                   '🎤', 'project',  '{"body":"Prepare and record a 30-second talk about something you love."}', 2),
  -- Entrepreneurship
  ('entrepreneurship', 'the-idea',      'The Big Idea',          'Spot a problem worth solving.',                      '💡', 'lesson',   '{"body":"Great businesses start by noticing a problem people have, then imagining a fix."}', 0),
  ('entrepreneurship', 'product',       'Make a Product',        'Turn your idea into something real.',                 '📦', 'lesson',   '{"body":"A product is your solution — a thing or a service people can use."}', 1),
  ('entrepreneurship', 'customer',      'Know Your Customer',    'Who is your idea for?',                              '🙋', 'lesson',   '{"body":"Your customer is the person your product helps. Picture exactly who they are."}', 2),
  ('entrepreneurship', 'marketing',     'Tell People',           'Marketing is sharing why your idea is great.',       '📣', 'lesson',   '{"body":"Marketing means telling the right people about your product in a fun, honest way."}', 3),
  ('entrepreneurship', 'biz-project',   'Pitch Your Business',   'Plan and pitch a tiny business.',                   '🚀', 'project',  '{"body":"Plan a small business — idea, product, customer, price — and save the pitch."}', 4),
  -- Financial Literacy
  ('financial-literacy', 'saving',      'Saving',                'Keep some money for later.',                         '🐷', 'lesson',   '{"body":"Saving means keeping some money instead of spending it all now, so you can reach a bigger goal."}', 0),
  ('financial-literacy', 'budget',      'Budgeting',             'Plan where your money goes.',                        '📊', 'activity', '{"body":"A budget splits your money into save, spend, and give jars."}', 1),
  ('financial-literacy', 'spending',    'Smart Spending',        'Needs vs wants.',                                   '🛒', 'lesson',   '{"body":"Needs come first (things you must have); wants come after (things that are nice to have)."}', 2),
  ('financial-literacy', 'investing',   'Investing (Simple!)',   'Money that can grow over time.',                    '🌱', 'lesson',   '{"body":"Investing means putting money to work so it can grow slowly over a long time."}', 3),
  -- Innovation Lab
  ('innovation-lab', 'innovate-what',   'What Is Innovation?',   'Making something new and better.',                   '💡', 'lesson',   '{"body":"Innovation means solving a problem in a new, clever way that helps people."}', 0),
  ('innovation-lab', 'design-thinking', 'Design Thinking',       'Empathize, imagine, build, test.',                   '🔄', 'lesson',   '{"body":"Understand the person, imagine ideas, build a rough version, and test it — then improve."}', 1),
  ('innovation-lab', 'weekly-challenge','This Week''s Challenge', 'Solve the weekly innovation challenge.',             '🏁', 'project',  '{"body":"Take on this week''s challenge and add your solution to your Portfolio."}', 2)
ON CONFLICT (track_slug, slug) DO NOTHING;

-- ============================================================
-- kids_future_skills — the "skills of the future" showcase. Browsable
-- content (like kids_explorer_locations), each optionally cross-linked to a
-- track a child can actually start (`related_track`).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_future_skills (
  slug            TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  why_it_matters  TEXT,
  emoji           TEXT NOT NULL DEFAULT '🚀',
  color           TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  related_track   TEXT REFERENCES public.kids_talent_tracks(slug) ON DELETE SET NULL,
  order_index     INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_future_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_future_skills: public read published"
  ON public.kids_future_skills FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_future_skills: admins manage"
  ON public.kids_future_skills FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_future_skills (slug, title, description, why_it_matters, emoji, color, related_track, order_index) VALUES
  ('artificial-intelligence', 'Artificial Intelligence', 'Teaching computers to learn and help us.',        'AI already helps doctors, cars, and games — knowing how it works is a superpower.', '🧠', 'accent',    'ai-playground',    0),
  ('programming',             'Programming',             'Writing instructions that bring ideas to life.',   'Almost every job of the future will touch code in some way.',                        '💻', 'purple',    'coding-academy',   1),
  ('robotics',                'Robotics',                'Building machines that help people.',               'Robots are moving into homes, hospitals, and space.',                                '🤖', 'secondary', 'robotics-lab',     2),
  ('design',                  'Design',                  'Making things beautiful and easy to use.',          'Good design makes technology friendly for everyone.',                                '🎨', 'pink',      'art-academy',      3),
  ('critical-thinking',       'Critical Thinking',       'Judging ideas carefully before believing them.',    'It helps you tell facts from fibs in a busy world.',                                 '🧐', 'primary',   NULL,               4),
  ('problem-solving',         'Problem Solving',         'Finding smart ways around any obstacle.',           'Every future job is really about solving problems.',                                 '💡', 'primary',   'innovation-lab',   5),
  ('teamwork',                'Teamwork',                'Working together to do more than you could alone.', 'Big ideas are built by teams, not just one person.',                                 '🤝', 'green',     NULL,               6),
  ('communication',          'Communication',           'Sharing ideas clearly with anyone.',                'The best idea only helps if you can explain it.',                                    '🗣️', 'accent',    'public-speaking',  7),
  ('entrepreneurship',        'Entrepreneurship',        'Turning ideas into things that help people.',       'Creators and founders shape what comes next.',                                       '🚀', 'secondary', 'entrepreneurship', 8),
  ('digital-safety',          'Digital Safety',          'Staying safe and kind online.',                     'Knowing how to protect yourself online keeps the internet fun.',                     '🛡️', 'green',     NULL,               9)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_careers — Career Explorer. Kid-friendly professions, each with the
-- skills it uses (domain slugs) and related activities/tracks to try.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_careers (
  slug            TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  emoji           TEXT NOT NULL DEFAULT '🧑‍💼',
  color           TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary', 'secondary', 'accent', 'pink', 'green', 'purple')),
  skill_domains   TEXT[] NOT NULL DEFAULT '{}',
  related_tracks  TEXT[] NOT NULL DEFAULT '{}',
  a_day_like      TEXT,
  order_index     INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_careers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_careers: public read published"
  ON public.kids_careers FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_careers: admins manage"
  ON public.kids_careers FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_careers (slug, title, description, emoji, color, skill_domains, related_tracks, a_day_like, order_index) VALUES
  ('software-engineer', 'Software Engineer', 'Builds apps, websites, and games with code.',        '👩‍💻', 'purple',    '{coding,logic,problem_solving}', '{coding-academy}',            'Write code, fix bugs, and team up to launch new features.', 0),
  ('robotics-engineer', 'Robotics Engineer', 'Designs and programs helpful robots.',               '🤖', 'secondary', '{coding,problem_solving,science}', '{robotics-lab,coding-academy}', 'Build robots, test sensors, and program them to move.', 1),
  ('artist',            'Artist / Illustrator','Creates art, characters, and illustrations.',       '🎨', 'pink',      '{drawing,creativity}',          '{art-academy}',               'Sketch ideas, choose colors, and bring characters to life.', 2),
  ('musician',          'Musician',          'Plays, writes, and performs music.',                 '🎸', 'green',     '{music,creativity}',            '{music-academy}',             'Practice, compose new songs, and perform for people.', 3),
  ('writer',            'Writer / Author',   'Tells stories and shares ideas in words.',           '✍️', 'accent',    '{language,creativity}',         '{writing-academy}',           'Imagine stories, write chapters, and edit them.', 4),
  ('scientist',         'Scientist',         'Asks questions and runs experiments.',               '🔬', 'secondary', '{science,logic,problem_solving}', '{ai-playground}',            'Form a question, run tests, and discover how things work.', 5),
  ('entrepreneur',      'Entrepreneur',      'Turns ideas into businesses that help people.',      '🚀', 'primary',   '{leadership,creativity,math}',  '{entrepreneurship,financial-literacy}', 'Dream up ideas, build products, and lead a team.', 6),
  ('teacher',           'Teacher',           'Helps others learn and grow.',                       '👩‍🏫', 'accent',    '{language,leadership}',          '{public-speaking}',           'Plan lessons, explain ideas, and cheer students on.', 7),
  ('doctor',            'Doctor',            'Keeps people healthy and helps them heal.',          '🩺', 'primary',   '{science,problem_solving}',     '{ai-playground}',             'Listen to patients, solve health puzzles, and care for people.', 8),
  ('game-designer',     'Game Designer',     'Invents fun games and how they work.',               '🎮', 'purple',    '{creativity,logic,coding}',     '{coding-academy,art-academy}', 'Design levels, test ideas, and make games fun and fair.', 9)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_mentors — a directory of mentors/experts. Built now as a catalog +
-- (next migration) a bookings table, so live workshops and 1:1 sessions can
-- be layered on later without reshaping anything — honest scaffolding, not a
-- claim that live mentoring is wired up yet. `accepting` gates whether the
-- "request a session" affordance is shown.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_mentors (
  slug            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  title           TEXT NOT NULL,
  bio             TEXT,
  emoji           TEXT NOT NULL DEFAULT '🧑‍🏫',
  expertise       TEXT[] NOT NULL DEFAULT '{}',
  related_tracks  TEXT[] NOT NULL DEFAULT '{}',
  accepting       BOOLEAN NOT NULL DEFAULT false,
  order_index     INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_mentors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_mentors: public read published"
  ON public.kids_mentors FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_mentors: admins manage"
  ON public.kids_mentors FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_mentors (slug, name, title, bio, emoji, expertise, related_tracks, accepting, order_index) VALUES
  ('coach-sara',  'Coach Sara',  'Coding Mentor',      'Loves helping kids build their first apps and games.', '👩‍💻', '{coding,problem_solving}', '{coding-academy}',   false, 0),
  ('mr-omar',     'Mr. Omar',    'Robotics Mentor',    'Robotics teacher who builds friendly robots.',         '🤖', '{coding,science}',         '{robotics-lab}',     false, 1),
  ('miss-lina',   'Miss Lina',   'Art Mentor',         'Illustrator who teaches character design.',            '🎨', '{drawing,creativity}',     '{art-academy}',      false, 2),
  ('maestro-ali', 'Maestro Ali', 'Music Mentor',       'Music teacher for rhythm, piano, and composing.',      '🎵', '{music}',                  '{music-academy}',    false, 3),
  ('ms-noor',     'Ms. Noor',    'Public Speaking Mentor','Helps kids speak with confidence on any stage.',     '🎤', '{leadership,language}',    '{public-speaking}',  false, 4)
ON CONFLICT (slug) DO NOTHING;
