-- ============================================================
-- Migration: VisionKids Academy — parent link codes, mission/XP/coins
-- extensions, downloads log, storage, and real seed content.
-- ============================================================

-- ============================================================
-- kids_parent_link_codes — a student generates a short code, a parent
-- redeems it once to create the kids_parent_child_links row. This is the
-- ONLY way that table gets written to (see its migration's comment).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_parent_link_codes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code              TEXT NOT NULL UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  redeemed_at       TIMESTAMPTZ
);

ALTER TABLE public.kids_parent_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_parent_link_codes: student manages own"
  ON public.kids_parent_link_codes FOR ALL
  USING (auth.uid() = student_user_id) WITH CHECK (auth.uid() = student_user_id);

CREATE OR REPLACE FUNCTION public.generate_kids_parent_link_code()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _student_id UUID := auth.uid();
  _code TEXT;
  _chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  IF _student_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  _code := '';
  FOR i IN 1..6 LOOP
    _code := _code || substr(_chars, (floor(random() * length(_chars)) + 1)::int, 1);
  END LOOP;

  INSERT INTO public.kids_parent_link_codes (student_user_id, code) VALUES (_student_id, _code);
  RETURN _code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_kids_parent_link_code() TO authenticated;

-- SECURITY DEFINER so a parent (who has no SELECT access to another user's
-- link-code row under the owner-only policy above) can still redeem it —
-- the function itself enforces validity/expiry/single-use instead of RLS.
CREATE OR REPLACE FUNCTION public.redeem_kids_parent_link_code(_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _parent_id UUID := auth.uid();
  _student_id UUID;
BEGIN
  IF _parent_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT student_user_id INTO _student_id
  FROM public.kids_parent_link_codes
  WHERE code = upper(_code) AND redeemed_at IS NULL AND expires_at > now();

  IF _student_id IS NULL THEN RETURN false; END IF;
  IF _student_id = _parent_id THEN RETURN false; END IF;

  UPDATE public.kids_parent_link_codes SET redeemed_at = now() WHERE code = upper(_code);

  INSERT INTO public.kids_parent_child_links (parent_user_id, child_user_id)
  VALUES (_parent_id, _student_id)
  ON CONFLICT (parent_user_id, child_user_id) DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_kids_parent_link_code(TEXT) TO authenticated;

-- ============================================================
-- Extend award_kids_xp / award_kids_coins (20260809010000) with Academy
-- reasons — same self-only capped-amount model, CREATE OR REPLACE so every
-- existing call site (Stories, Games) keeps working unchanged.
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_kids_xp(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  CASE
    WHEN _reason LIKE 'Story completed:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'Quiz completed:%'        THEN _max_amount := 30;
    WHEN _reason LIKE 'Reading streak:%'        THEN _max_amount := 50;
    WHEN _reason LIKE 'AI story created:%'      THEN _max_amount := 20;
    WHEN _reason LIKE 'Game completed:%'        THEN _max_amount := 40;
    WHEN _reason LIKE 'Perfect score:%'         THEN _max_amount := 25;
    WHEN _reason LIKE 'Daily challenge:%'       THEN _max_amount := 30;
    WHEN _reason LIKE 'Weekly challenge:%'      THEN _max_amount := 100;
    WHEN _reason LIKE 'Achievement unlocked:%'  THEN _max_amount := 30;
    WHEN _reason LIKE 'Daily login:%'           THEN _max_amount := 15;
    WHEN _reason LIKE 'Lesson completed:%'      THEN _max_amount := 25;
    WHEN _reason LIKE 'Course completed:%'      THEN _max_amount := 150;
    WHEN _reason LIKE 'Homework submitted:%'    THEN _max_amount := 20;
    WHEN _reason LIKE 'Project submitted:%'     THEN _max_amount := 50;
    WHEN _reason LIKE 'Exam passed:%'           THEN _max_amount := 80;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
  INSERT INTO public.kids_xp_events(user_id, amount, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_kids_coins(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  CASE
    WHEN _reason LIKE 'Game completed:%'      THEN _max_amount := 20;
    WHEN _reason LIKE 'Daily challenge:%'     THEN _max_amount := 15;
    WHEN _reason LIKE 'Weekly challenge:%'    THEN _max_amount := 50;
    WHEN _reason LIKE 'Daily login:%'         THEN _max_amount := 10;
    WHEN _reason LIKE 'Lesson completed:%'    THEN _max_amount := 15;
    WHEN _reason LIKE 'Course completed:%'    THEN _max_amount := 75;
    WHEN _reason LIKE 'Homework submitted:%'  THEN _max_amount := 10;
    WHEN _reason LIKE 'Project submitted:%'   THEN _max_amount := 25;
    WHEN _reason LIKE 'Exam passed:%'         THEN _max_amount := 40;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

-- ============================================================
-- Extend kids_daily_challenges / kids_weekly_challenges (20260809020000)
-- with a lesson target — "Daily/Weekly Missions" for Academy reuse the
-- exact same challenge system Games already has, not a parallel one.
-- ============================================================
ALTER TABLE public.kids_daily_challenges ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.kids_lessons(id) ON DELETE SET NULL;
ALTER TABLE public.kids_daily_challenges DROP CONSTRAINT IF EXISTS kids_daily_challenges_target_type_check;
ALTER TABLE public.kids_daily_challenges ADD CONSTRAINT kids_daily_challenges_target_type_check
  CHECK (target_type IN ('play_game', 'score_at_least', 'win_count', 'complete_any_game', 'complete_lesson'));

ALTER TABLE public.kids_weekly_challenges ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.kids_lessons(id) ON DELETE SET NULL;
ALTER TABLE public.kids_weekly_challenges DROP CONSTRAINT IF EXISTS kids_weekly_challenges_target_type_check;
ALTER TABLE public.kids_weekly_challenges ADD CONSTRAINT kids_weekly_challenges_target_type_check
  CHECK (target_type IN ('play_game', 'score_at_least', 'win_count', 'complete_any_game', 'complete_lesson'));

-- ============================================================
-- kids_academy_downloads — "Downloads" page log (mirrors kids_downloads
-- from Stories, kept as its own table since lessons/worksheets aren't
-- stories and forcing a shared polymorphic table here isn't worth the
-- extra nullable-FK complexity for a simple download log).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_academy_downloads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id     UUID REFERENCES public.kids_lessons(id) ON DELETE CASCADE,
  worksheet_id  UUID REFERENCES public.kids_worksheets(id) ON DELETE CASCADE,
  format        TEXT NOT NULL CHECK (format IN ('video', 'audio', 'worksheet', 'lesson_text')),
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((lesson_id IS NOT NULL) OR (worksheet_id IS NOT NULL))
);

ALTER TABLE public.kids_academy_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_academy_downloads: user manages own"
  ON public.kids_academy_downloads FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_academy_downloads_user ON public.kids_academy_downloads(user_id, downloaded_at DESC);

-- ============================================================
-- Storage: kids-academy-media (public — lesson videos/audio/thumbnails/
-- worksheets, teacher/admin write) and reuse of kids-submissions (private,
-- new here) for homework + project file uploads.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kids-academy-media', 'kids-academy-media', true,
  104857600, -- 100 MB (lesson video)
  ARRAY['image/png','image/jpeg','image/webp','audio/mpeg','audio/mp4','video/mp4','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "kids_academy_media_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'kids-academy-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_academy_media_teacher_write"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'kids-academy-media' AND (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_teacher_profiles t WHERE t.user_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_academy_media_owner_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'kids-academy-media' AND (public.has_role(auth.uid(), 'admin') OR owner = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Private bucket for homework/project file submissions. Upload path
-- convention: {user_id}/{homework_or_project_id}/{filename} — the first
-- segment is checked against auth.uid() for owner read/write; course
-- teachers read via the kids_homework_submissions/kids_student_projects
-- TABLE rows (which carry their own file_urls), not via a storage-level
-- teacher policy — keeps this bucket's RLS simple (owner-only) while the
-- table RLS already grants teachers the read access they need to the URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kids-submissions', 'kids-submissions', false,
  26214400, -- 25 MB
  ARRAY['image/png','image/jpeg','image/webp','audio/mpeg','audio/mp4','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "kids_submissions_owner_read"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'kids-submissions' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_submissions_owner_write"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'kids-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_submissions_owner_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'kids-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Seed: academy achievements (added to the shared kids_achievements table)
-- ============================================================
INSERT INTO public.kids_achievements (key, title, description, icon, reward_vx) VALUES
  ('first_lesson',     'First Lesson!',        'Complete your very first Academy lesson.',   'GraduationCap', 10),
  ('five_lessons',     'Curious Learner',      'Complete 5 lessons.',                         'BookOpen',       20),
  ('first_course',     'Course Graduate',      'Complete your first course.',                 'Award',          50),
  ('first_certificate','Certified!',           'Earn your first VisionKids certificate.',      'ShieldCheck',    30),
  ('homework_hero',    'Homework Hero',        'Submit 5 pieces of homework.',                 'FileText',       20),
  ('project_star',     'Project Star',         'Submit your first project.',                   'Star',           25)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Seed: one fully real course end-to-end (Math, ages 6-8) — "Numbers &
-- Counting". Every other subject/course exists as real catalog rows
-- (Subjects page is fully real) but only this one has deep lesson content;
-- the rest render an honest empty state, same "Coming Soon" precedent as
-- Games' uncovered titles.
-- ============================================================
INSERT INTO public.kids_courses (id, slug, title, subtitle, description, subject_id, age_range, difficulty, xp_reward, coins_reward, status, published_at)
VALUES (
  'f1000000-0000-0000-0000-000000000001', 'numbers-and-counting',
  'Numbers & Counting', 'Your first steps into the world of numbers',
  'Learn to count, add, and subtract with fun lessons made just for you.',
  (SELECT id FROM public.kids_subjects WHERE slug = 'math'),
  '6-8', 'easy', 80, 40, 'published', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_units (id, course_id, title, description, order_index) VALUES
  ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'Counting to 20', 'Learn to count from 1 all the way to 20.', 1),
  ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'Adding & Subtracting', 'Learn to add and take away numbers.', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_lessons (id, unit_id, course_id, slug, title, description, content, order_index, estimated_minutes, xp_reward, coins_reward, status) VALUES
  ('f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'counting-1-to-10',
   'Counting 1 to 10', 'Count from 1 to 10 with pictures.',
   'Let''s count together! 1 apple 🍎, 2 apples 🍎🍎, 3 apples 🍎🍎🍎... Keep going all the way to 10! Numbers help us count everything around us — toys, fingers, and even stars in the sky.',
   1, 8, 15, 8, 'published'),
  ('f3000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'counting-11-to-20',
   'Counting 11 to 20', 'Count from 11 to 20.',
   'Great job counting to 10! Now let''s keep going: 11, 12, 13, 14, 15, 16, 17, 18, 19, 20! After 20 you can start again with a new group of ten.',
   2, 8, 15, 8, 'published'),
  ('f3000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'simple-addition',
   'Simple Addition', 'Add small numbers together.',
   'Addition means putting numbers together! If you have 2 apples and get 3 more, how many do you have? 2 + 3 = 5! Try adding small numbers together using your fingers.',
   1, 10, 15, 8, 'published'),
  ('f3000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'simple-subtraction',
   'Simple Subtraction', 'Take away numbers.',
   'Subtraction means taking away! If you have 5 cookies and eat 2, how many are left? 5 - 2 = 3! Subtraction helps us know how much is left over.',
   2, 10, 15, 8, 'published')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_lesson_activities (lesson_id, type, prompt, content, order_index, points) VALUES
  ('f3000000-0000-0000-0000-000000000001', 'multiple_choice', 'How many apples are there? 🍎🍎🍎', '{"options": ["2", "3", "4", "5"], "correctAnswer": "3"}'::jsonb, 1, 10),
  ('f3000000-0000-0000-0000-000000000001', 'matching', 'Match the number to the correct number of stars.', '{"pairs": [{"left": "2", "right": "⭐⭐"}, {"left": "3", "right": "⭐⭐⭐"}, {"left": "4", "right": "⭐⭐⭐⭐"}]}'::jsonb, 2, 10),
  ('f3000000-0000-0000-0000-000000000002', 'multiple_choice', 'What number comes after 15?', '{"options": ["14", "16", "17", "20"], "correctAnswer": "16"}'::jsonb, 1, 10),
  ('f3000000-0000-0000-0000-000000000003', 'multiple_choice', 'What is 2 + 3?', '{"options": ["4", "5", "6", "7"], "correctAnswer": "5"}'::jsonb, 1, 10),
  ('f3000000-0000-0000-0000-000000000004', 'typing', 'Type the answer: 5 - 2 = ?', '{"correctAnswer": "3"}'::jsonb, 1, 10)
ON CONFLICT DO NOTHING;

-- No worksheet seeded here — kids_worksheets.file_url is NOT NULL by design
-- (a worksheet without a file isn't meaningful) and there's no real PDF to
-- attach yet. The table/RLS/UI are fully wired; an admin/teacher can add
-- one whenever real worksheet files exist.

INSERT INTO public.kids_projects (id, course_id, title, description, instructions, age_range, xp_reward, coins_reward) VALUES
  ('f4000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'Count Your Toys',
   'Count 10 toys or objects at home and tell us about them.',
   'Find 10 toys or objects around your home. Count them one by one. Then write or tell an adult how many you found, and which one is your favorite!',
   '6-8', 40, 20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_quizzes (id, course_id, title) VALUES
  ('f5000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'Numbers & Counting — Final Exam')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kids_quiz_questions (quiz_id, type, question, options, correct_answer, explanation, order_index, points) VALUES
  ('f5000000-0000-0000-0000-000000000001', 'multiple_choice', 'What number comes after 9?', '["8", "10", "11", "20"]'::jsonb, '10', 'After 9 comes 10!', 1, 20),
  ('f5000000-0000-0000-0000-000000000001', 'multiple_choice', 'What is 4 + 1?', '["3", "4", "5", "6"]'::jsonb, '5', '4 + 1 = 5.', 2, 20),
  ('f5000000-0000-0000-0000-000000000001', 'true_false', 'Subtraction means adding numbers together.', '["True", "False"]'::jsonb, 'False', 'Subtraction means taking away, not adding.', 3, 20),
  ('f5000000-0000-0000-0000-000000000001', 'multiple_choice', 'What is 6 - 2?', '["3", "4", "5", "8"]'::jsonb, '4', '6 - 2 = 4.', 4, 20)
ON CONFLICT DO NOTHING;
