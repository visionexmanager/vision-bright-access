-- ============================================================
-- Migration: VisionKids Stories — achievements, AI stories, quiz
-- attempts, storage buckets, and seed content.
--
-- Reused, not redefined: public.touch_updated_at(), public.has_role(),
-- public.user_points (the real VX wallet — see award_kids_xp below,
-- mirroring award_library_xp's self-only capped-amount model exactly).
-- ============================================================

-- ============================================================
-- kids_achievements / kids_user_achievements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_achievements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  criteria      JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward_vx     INTEGER NOT NULL DEFAULT 0 CHECK (reward_vx >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_achievements: public read"
  ON public.kids_achievements FOR SELECT USING (true);

CREATE POLICY "kids_achievements: admins manage"
  ON public.kids_achievements FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.kids_user_achievements (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id  UUID NOT NULL REFERENCES public.kids_achievements(id) ON DELETE CASCADE,
  earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE public.kids_user_achievements ENABLE ROW LEVEL SECURITY;

-- Earned badges are a public flex (same visibility model as kids_story_ratings).
CREATE POLICY "kids_user_achievements: public read"
  ON public.kids_user_achievements FOR SELECT USING (true);

-- No direct INSERT policy — only award_kids_achievement() (SECURITY DEFINER,
-- below) can write here, so a user can never grant themselves a badge.

CREATE INDEX IF NOT EXISTS idx_kids_user_achievements_achievement ON public.kids_user_achievements(achievement_id);

-- Self-only, achievement-gated award: the achievement must already exist by
-- key, and the trigger inserts idempotently (ON CONFLICT DO NOTHING) so it's
-- safe to call repeatedly (e.g. "read 5 stories" checked after every
-- completion, not just the 5th).
CREATE OR REPLACE FUNCTION public.award_kids_achievement(_key TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _achievement_id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT id INTO _achievement_id FROM public.kids_achievements WHERE key = _key;
  IF _achievement_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.kids_user_achievements (user_id, achievement_id)
  VALUES (_user_id, _achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_kids_achievement(TEXT) TO authenticated;

-- Self-only VX award, same security model as award_library_xp — GRANTed
-- directly to `authenticated`, so the per-reason cap MUST live here (not
-- just trusted client-side), same reasoning as that function's own comment.
CREATE OR REPLACE FUNCTION public.award_kids_xp(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  CASE
    WHEN _reason LIKE 'Story completed:%' THEN _max_amount := 50;
    WHEN _reason LIKE 'Quiz completed:%'   THEN _max_amount := 30;
    WHEN _reason LIKE 'Reading streak:%'   THEN _max_amount := 50;
    WHEN _reason LIKE 'AI story created:%' THEN _max_amount := 20;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN
    RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason;
  END IF;

  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_kids_xp(INTEGER, TEXT) TO authenticated;

-- ============================================================
-- kids_quiz_attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_quiz_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id       UUID NOT NULL REFERENCES public.kids_quizzes(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL DEFAULT 0,
  answers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_quiz_attempts: user manages own"
  ON public.kids_quiz_attempts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_quiz_attempts_user ON public.kids_quiz_attempts(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_quiz_attempts_quiz ON public.kids_quiz_attempts(quiz_id);

-- ============================================================
-- kids_ai_stories (AI Story Generator output)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_ai_stories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt            TEXT NOT NULL,
  title             TEXT NOT NULL DEFAULT '',
  pages             JSONB NOT NULL DEFAULT '[]'::jsonb,
  characters        JSONB NOT NULL DEFAULT '[]'::jsonb,
  cover_image_url   TEXT,
  moral_lesson      TEXT,
  vocabulary        JSONB NOT NULL DEFAULT '[]'::jsonb,
  quiz              JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public         BOOLEAN NOT NULL DEFAULT false,
  status            TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('generating', 'ready', 'failed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_ai_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_ai_stories: read own or public"
  ON public.kids_ai_stories FOR SELECT
  USING (auth.uid() = user_id OR is_public = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_ai_stories: owner manages own"
  ON public.kids_ai_stories FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_ai_stories_user ON public.kids_ai_stories(user_id, created_at DESC);

-- ============================================================
-- Storage: kids-story-media (admin-curated catalog assets — covers,
-- gallery, audio, video, pdf, epub, brf) and kids-ai-story-assets
-- (AI-generated cover images, one folder per owning user).
-- Pattern follows 20260720000004_library_storage.sql exactly.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kids-story-media', 'kids-story-media', true,
  52428800, -- 50 MB (audio/video)
  ARRAY['image/png','image/jpeg','image/webp','image/gif','audio/mpeg','audio/mp4','audio/wav','video/mp4','application/pdf','application/epub+zip']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "kids_story_media_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'kids-story-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_story_media_admin_write"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'kids-story-media' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_story_media_admin_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'kids-story-media' AND public.has_role(auth.uid(), 'admin'))
    WITH CHECK (bucket_id = 'kids-story-media' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_story_media_admin_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'kids-story-media' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kids-ai-story-assets', 'kids-ai-story-assets', true,
  5242880, -- 5 MB
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "kids_ai_story_assets_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'kids-ai-story-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Upload path convention: {user_id}/{ai_story_id}/{filename} — enforced by
-- checking the first path segment (storage.foldername) equals the caller's
-- own auth.uid(), so a user can only write into their own prefix.
DO $$ BEGIN
  CREATE POLICY "kids_ai_story_assets_owner_write"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'kids-ai-story-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_ai_story_assets_owner_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'kids-ai-story-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Seed: achievements
-- ============================================================
INSERT INTO public.kids_achievements (key, title, description, icon, reward_vx) VALUES
  ('first_story',   'First Story!',        'Finish your very first story.',            'BookOpen', 10),
  ('five_stories',  'Story Explorer',      'Finish 5 stories.',                          'Compass', 20),
  ('ten_stories',   'Bookworm',            'Finish 10 stories.',                         'Trophy',  40),
  ('streak_3',      '3-Day Streak',        'Read stories 3 days in a row.',              'Flame',   15),
  ('streak_7',      '7-Day Streak',        'Read stories 7 days in a row.',              'Flame',   30),
  ('quiz_ace',      'Quiz Ace',            'Get a perfect score on a story quiz.',       'Star',    15),
  ('first_ai_story','My First AI Story',   'Create your first AI-generated story.',      'Sparkles',15)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Seed: sample authors, narrators, and stories (small, real, structured
-- set so every page has genuine content to render — same precedent as
-- library_core_catalog's own seed migration).
-- ============================================================
INSERT INTO public.kids_story_authors (id, name, bio) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Layla Hassan', 'Layla writes gentle adventure stories for young readers.'),
  ('a1000000-0000-0000-0000-000000000002', 'Tom Whitfield', 'Tom loves writing about curious animals and big feelings.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_story_narrators (id, name, bio) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Aunt Mona', 'A warm, friendly storytelling voice.'),
  ('b1000000-0000-0000-0000-000000000002', 'Mr. Sam', 'A calm, cheerful narrator.')
ON CONFLICT (id) DO NOTHING;

-- Story 1: The Lion Who Flew to the Stars (space)
INSERT INTO public.kids_stories (
  id, slug, title, subtitle, description, author_id, narrator_id, age_group, difficulty,
  language, reading_time_minutes, page_count, tags, category_id, accessibility_features,
  status, published_at
) VALUES (
  'c1000000-0000-0000-0000-000000000001', 'the-lion-who-flew-to-the-stars',
  'The Lion Who Flew to the Stars', 'A brave lion''s journey past the moon',
  'Leo the lion always looked up at the night sky and dreamed of the stars. One day, a friendly comet gives him the chance of a lifetime.',
  'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
  '6-8', 'easy', 'en', 4, 4, ARRAY['space','courage','dreams'],
  (SELECT id FROM public.kids_story_categories WHERE slug = 'space'),
  '["screen_reader_friendly","large_print_ready"]'::jsonb,
  'published', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_story_pages (story_id, page_number, text_content) VALUES
  ('c1000000-0000-0000-0000-000000000001', 1, 'Leo the lion lived on a sunny hill, but every night he looked up and dreamed of the stars.'),
  ('c1000000-0000-0000-0000-000000000001', 2, 'One night, a friendly comet swooped down and said, "Climb on, Leo — let''s see the stars up close!"'),
  ('c1000000-0000-0000-0000-000000000001', 3, 'Leo flew past the sleepy moon and danced between a thousand twinkling stars.'),
  ('c1000000-0000-0000-0000-000000000001', 4, 'When morning came, Leo landed back on his hill, smiling — the stars felt a little closer now, every single night.')
ON CONFLICT (story_id, page_number) DO NOTHING;

-- Story 2: Milo the Curious Kitten (animals/friendship)
INSERT INTO public.kids_stories (
  id, slug, title, subtitle, description, author_id, narrator_id, age_group, difficulty,
  language, reading_time_minutes, page_count, tags, category_id, status, published_at
) VALUES (
  'c1000000-0000-0000-0000-000000000002', 'milo-the-curious-kitten',
  'Milo the Curious Kitten', 'A small cat with a big question',
  'Milo the kitten wants to know what''s on the other side of the garden fence — and finds a new best friend along the way.',
  'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002',
  '3-5', 'easy', 'en', 3, 3, ARRAY['animals','friendship','curiosity'],
  (SELECT id FROM public.kids_story_categories WHERE slug = 'animals'),
  'published', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_story_pages (story_id, page_number, text_content) VALUES
  ('c1000000-0000-0000-0000-000000000002', 1, 'Milo the kitten always wondered what was on the other side of the garden fence.'),
  ('c1000000-0000-0000-0000-000000000002', 2, 'One sunny day, Milo squeezed through a gap and met Pip, a bouncy little rabbit.'),
  ('c1000000-0000-0000-0000-000000000002', 3, 'Milo and Pip played all afternoon and promised to meet at the fence every single day.')
ON CONFLICT (story_id, page_number) DO NOTHING;

-- Story 3: The Whispering Forest (nature/mystery) — with a quiz
INSERT INTO public.kids_stories (
  id, slug, title, subtitle, description, author_id, narrator_id, age_group, difficulty,
  language, reading_time_minutes, page_count, tags, category_id, status, published_at
) VALUES (
  'c1000000-0000-0000-0000-000000000003', 'the-whispering-forest',
  'The Whispering Forest', 'Something is humming among the trees',
  'Nora hears a strange humming in the forest behind her house — and follows it to a wonderful discovery.',
  'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002',
  '6-8', 'medium', 'en', 5, 3, ARRAY['nature','mystery'],
  (SELECT id FROM public.kids_story_categories WHERE slug = 'mystery'),
  'published', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_story_pages (story_id, page_number, text_content) VALUES
  ('c1000000-0000-0000-0000-000000000003', 1, 'Nora heard a soft humming sound coming from the forest behind her house.'),
  ('c1000000-0000-0000-0000-000000000003', 2, 'She followed the sound past tall oak trees until she found a clearing full of glowing fireflies.'),
  ('c1000000-0000-0000-0000-000000000003', 3, 'The fireflies were humming a little tune — and Nora hummed right along with them.')
ON CONFLICT (story_id, page_number) DO NOTHING;

INSERT INTO public.kids_quizzes (id, story_id, title) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'The Whispering Forest Quiz')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_quiz_questions (quiz_id, type, question, options, correct_answer, explanation, order_index, points) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'multiple_choice', 'What sound did Nora hear?', '["A humming sound","A loud bang","Music from a radio","Nothing at all"]'::jsonb, 'A humming sound', 'The story begins with Nora hearing a soft humming sound.', 1, 10),
  ('d1000000-0000-0000-0000-000000000001', 'true_false', 'The clearing was full of glowing fireflies.', '["True","False"]'::jsonb, 'True', 'Nora found a clearing full of glowing fireflies.', 2, 10),
  ('d1000000-0000-0000-0000-000000000001', 'vocabulary', 'What does "clearing" mean in the story?', '["An open space in a forest","A type of firefly","A loud noise","A kind of tree"]'::jsonb, 'An open space in a forest', 'A "clearing" is an open space with no trees.', 3, 10)
ON CONFLICT DO NOTHING;

-- Story 4: Grandma's Garden of Stories (family/bedtime)
INSERT INTO public.kids_stories (
  id, slug, title, subtitle, description, author_id, age_group, difficulty,
  language, reading_time_minutes, page_count, tags, category_id, status, published_at
) VALUES (
  'c1000000-0000-0000-0000-000000000004', 'grandmas-garden-of-stories',
  'Grandma''s Garden of Stories', 'Every flower holds a tale',
  'In Grandma''s garden, every flower has a story to tell — if you know how to listen.',
  'a1000000-0000-0000-0000-000000000002', '3-5', 'easy', 'en', 3, 3,
  ARRAY['family','bedtime'],
  (SELECT id FROM public.kids_story_categories WHERE slug = 'bedtime'),
  'published', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_story_pages (story_id, page_number, text_content) VALUES
  ('c1000000-0000-0000-0000-000000000004', 1, 'Every evening, Grandma took Sara into her garden to listen to the flowers.'),
  ('c1000000-0000-0000-0000-000000000004', 2, '"This rose remembers your first laugh," Grandma whispered, "and this daisy remembers your first step."'),
  ('c1000000-0000-0000-0000-000000000004', 3, 'Sara closed her eyes, breathed in the sweet air, and drifted off to the softest sleep.')
ON CONFLICT (story_id, page_number) DO NOTHING;

-- Story 5: The Robot Who Learned to Smile (educational)
INSERT INTO public.kids_stories (
  id, slug, title, subtitle, description, author_id, age_group, difficulty,
  language, reading_time_minutes, page_count, tags, category_id, status, published_at
) VALUES (
  'c1000000-0000-0000-0000-000000000005', 'the-robot-who-learned-to-smile',
  'The Robot Who Learned to Smile', 'A robot discovers what makes a good friend',
  'Beep the robot could solve any math problem, but he had to learn something much harder: how to make a friend smile.',
  'a1000000-0000-0000-0000-000000000002', '6-8', 'easy', 'en', 4, 3,
  ARRAY['educational','friendship','robots'],
  (SELECT id FROM public.kids_story_categories WHERE slug = 'educational'),
  'published', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_story_pages (story_id, page_number, text_content) VALUES
  ('c1000000-0000-0000-0000-000000000005', 1, 'Beep the robot could count to a million and solve any puzzle, but he had never made anyone smile.'),
  ('c1000000-0000-0000-0000-000000000005', 2, 'He tried telling jokes about numbers, but his new friend Amir just looked confused.'),
  ('c1000000-0000-0000-0000-000000000005', 3, 'Then Beep simply asked, "How was your day?" — and listened. Amir smiled the biggest smile of all.')
ON CONFLICT (story_id, page_number) DO NOTHING;

-- Story 6: Choose Your Jungle Adventure (interactive — branching)
INSERT INTO public.kids_stories (
  id, slug, title, subtitle, description, author_id, age_group, difficulty,
  language, reading_time_minutes, page_count, tags, category_id, is_interactive, status, published_at
) VALUES (
  'c1000000-0000-0000-0000-000000000006', 'choose-your-jungle-adventure',
  'Choose Your Jungle Adventure', 'You decide what happens next!',
  'You are exploring a mysterious jungle. Every choice you make leads somewhere new — can you find the hidden treehouse?',
  'a1000000-0000-0000-0000-000000000001', '9-12', 'medium', 'en', 6, 0,
  ARRAY['adventure','interactive'],
  (SELECT id FROM public.kids_story_categories WHERE slug = 'interactive'),
  true, 'published', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_story_nodes (id, story_id, node_key, text_content, is_start, is_ending, ending_type) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000006', 'start', 'You step into the jungle. The path splits into two: one leads toward a river, the other toward tall, rustling trees. Which way do you go?', true, false, NULL),
  ('e1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000006', 'river', 'You follow the river and find a friendly turtle who offers to guide you across. Do you accept the ride?', false, false, NULL),
  ('e1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000006', 'trees', 'You climb into the tall trees and spot something shiny in the distance — a hidden treehouse! Do you climb toward it?', false, false, NULL),
  ('e1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000006', 'treehouse_found', 'You reach the treehouse and find a cozy room full of books, maps, and a warm cup of cocoa waiting just for you. You made it!', false, true, 'happy'),
  ('e1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000006', 'turtle_island', 'The turtle carries you to a quiet little island full of butterflies. It''s peaceful, but the treehouse feels far away today. The end.', false, true, 'peaceful'),
  ('e1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000006', 'river_alone', 'You decide to explore the riverbank alone and discover a field of glowing flowers. A magical, quiet ending to your adventure. The end.', false, true, 'magical')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_story_choices (node_id, choice_text, next_node_id, order_index) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'Follow the river', 'e1000000-0000-0000-0000-000000000002', 1),
  ('e1000000-0000-0000-0000-000000000001', 'Climb the tall trees', 'e1000000-0000-0000-0000-000000000003', 2),
  ('e1000000-0000-0000-0000-000000000002', 'Ride with the turtle', 'e1000000-0000-0000-0000-000000000005', 1),
  ('e1000000-0000-0000-0000-000000000002', 'Explore the riverbank alone', 'e1000000-0000-0000-0000-000000000006', 2),
  ('e1000000-0000-0000-0000-000000000003', 'Climb toward the shiny treehouse', 'e1000000-0000-0000-0000-000000000004', 1)
ON CONFLICT DO NOTHING;
