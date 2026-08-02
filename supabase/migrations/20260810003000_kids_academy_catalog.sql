-- ============================================================
-- Migration: VisionKids Academy — catalog (Phase 4)
-- Purpose:   kids_subjects (22, seeded), kids_teacher_profiles (self-service,
--            same pattern as Library's "Become Author"), kids_courses,
--            kids_units, kids_lessons, kids_lesson_activities,
--            kids_worksheets, kids_projects (templates), and extending the
--            Stories-phase kids_quizzes/kids_quiz_questions
--            (20260808000000) to be reusable for lesson quizzes and
--            course final exams — same quiz engine (and QuizRunner UI),
--            not a second one.
--
-- Age bands are Academy-specific (3-5/6-8/9-12/13-15) — a superset of the
-- 3-band system Stories/Games used (3-5/6-8/9-12), added here rather than
-- widening those two CHECK constraints retroactively (out of scope for
-- this migration, and their content doesn't need the 13-15 band).
--
-- Reused, not redefined: public.touch_updated_at(), public.has_role().
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kids_subjects (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    TEXT NOT NULL UNIQUE,
  name                    TEXT NOT NULL,
  description             TEXT,
  icon                    TEXT,
  color                   TEXT,
  display_order           INTEGER NOT NULL DEFAULT 0,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  applicable_age_ranges   TEXT[] NOT NULL DEFAULT ARRAY['3-5', '6-8', '9-12', '13-15'],
  course_count            INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_subjects: public reads active"
  ON public.kids_subjects FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_subjects: admins manage"
  ON public.kids_subjects FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kids_subjects_updated_at
  BEFORE UPDATE ON public.kids_subjects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_kids_subjects_order ON public.kids_subjects(display_order);

-- ============================================================
-- kids_teacher_profiles — self-service, same model as Library's
-- "Become Author" (any signed-in user may become a teacher; no admin
-- approval gate). is_approved exists for a future moderation pass but
-- defaults to true so it doesn't block anyone today.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_teacher_profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  bio           TEXT,
  is_approved   BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_teacher_profiles: public read"
  ON public.kids_teacher_profiles FOR SELECT USING (true);

CREATE POLICY "kids_teacher_profiles: self manages own"
  ON public.kids_teacher_profiles FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- kids_courses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  description     TEXT,
  subject_id      UUID REFERENCES public.kids_subjects(id) ON DELETE SET NULL,
  age_range       TEXT NOT NULL DEFAULT '6-8' CHECK (age_range IN ('3-5', '6-8', '9-12', '13-15')),
  difficulty      TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  thumbnail_url   TEXT,
  xp_reward       INTEGER NOT NULL DEFAULT 50,
  coins_reward    INTEGER NOT NULL DEFAULT 25,
  lesson_count    INTEGER NOT NULL DEFAULT 0,
  teacher_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_courses: public reads published"
  ON public.kids_courses FOR SELECT
  USING (status = 'published' OR teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_courses: teachers create own"
  ON public.kids_courses FOR INSERT
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.kids_teacher_profiles t WHERE t.user_id = auth.uid())
  );

CREATE POLICY "kids_courses: owner or admin updates"
  ON public.kids_courses FOR UPDATE
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_courses: owner or admin deletes"
  ON public.kids_courses FOR DELETE
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kids_courses_updated_at
  BEFORE UPDATE ON public.kids_courses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_kids_courses_subject ON public.kids_courses(subject_id);
CREATE INDEX IF NOT EXISTS idx_kids_courses_status ON public.kids_courses(status);
CREATE INDEX IF NOT EXISTS idx_kids_courses_teacher ON public.kids_courses(teacher_id);

CREATE OR REPLACE FUNCTION public.bump_kids_subject_course_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.subject_id IS NOT NULL AND NEW.status = 'published' THEN
      UPDATE public.kids_subjects SET course_count = course_count + 1 WHERE id = NEW.subject_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.subject_id IS NOT NULL AND OLD.status = 'published' THEN
      UPDATE public.kids_subjects SET course_count = GREATEST(course_count - 1, 0) WHERE id = OLD.subject_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.subject_id IS NOT DISTINCT FROM NEW.subject_id AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
      RETURN NEW;
    END IF;
    IF OLD.subject_id IS NOT NULL AND OLD.status = 'published' THEN
      UPDATE public.kids_subjects SET course_count = GREATEST(course_count - 1, 0) WHERE id = OLD.subject_id;
    END IF;
    IF NEW.subject_id IS NOT NULL AND NEW.status = 'published' THEN
      UPDATE public.kids_subjects SET course_count = course_count + 1 WHERE id = NEW.subject_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER kids_courses_subject_count
  AFTER INSERT OR UPDATE OR DELETE ON public.kids_courses
  FOR EACH ROW EXECUTE FUNCTION public.bump_kids_subject_course_count();

-- ============================================================
-- kids_units
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_units (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES public.kids_courses(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  order_index   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, order_index)
);

ALTER TABLE public.kids_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_units: readable if course readable"
  ON public.kids_units FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_courses c
    WHERE c.id = course_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_units: course owner or admin manages"
  ON public.kids_units FOR ALL
  USING (EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE INDEX IF NOT EXISTS idx_kids_units_course ON public.kids_units(course_id, order_index);

-- ============================================================
-- kids_lessons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_lessons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id             UUID NOT NULL REFERENCES public.kids_units(id) ON DELETE CASCADE,
  course_id           UUID NOT NULL REFERENCES public.kids_courses(id) ON DELETE CASCADE,
  slug                TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  content             TEXT,
  video_url           TEXT,
  audio_url           TEXT,
  order_index         INTEGER NOT NULL DEFAULT 0,
  estimated_minutes   INTEGER NOT NULL DEFAULT 10,
  xp_reward           INTEGER NOT NULL DEFAULT 15,
  coins_reward        INTEGER NOT NULL DEFAULT 8,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug),
  UNIQUE (unit_id, order_index)
);

ALTER TABLE public.kids_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_lessons: readable if course readable"
  ON public.kids_lessons FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_courses c
    WHERE c.id = course_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_lessons: course owner or admin manages"
  ON public.kids_lessons FOR ALL
  USING (EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TRIGGER kids_lessons_updated_at
  BEFORE UPDATE ON public.kids_lessons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_kids_lessons_unit ON public.kids_lessons(unit_id, order_index);
CREATE INDEX IF NOT EXISTS idx_kids_lessons_course ON public.kids_lessons(course_id);

CREATE OR REPLACE FUNCTION public.bump_kids_course_lesson_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'published' THEN UPDATE public.kids_courses SET lesson_count = lesson_count + 1 WHERE id = NEW.course_id; END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN UPDATE public.kids_courses SET lesson_count = GREATEST(lesson_count - 1, 0) WHERE id = OLD.course_id; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'published' THEN UPDATE public.kids_courses SET lesson_count = lesson_count + 1 WHERE id = NEW.course_id; END IF;
      IF OLD.status = 'published' THEN UPDATE public.kids_courses SET lesson_count = GREATEST(lesson_count - 1, 0) WHERE id = OLD.course_id; END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER kids_lessons_course_count
  AFTER INSERT OR UPDATE OR DELETE ON public.kids_lessons
  FOR EACH ROW EXECUTE FUNCTION public.bump_kids_course_lesson_count();

-- ============================================================
-- kids_lesson_activities (the "Exercises": multiple_choice, drag_drop,
-- typing, speaking, listening, matching, drawing, voice_answer)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_lesson_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     UUID NOT NULL REFERENCES public.kids_lessons(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('multiple_choice', 'drag_drop', 'typing', 'speaking', 'listening', 'matching', 'drawing', 'voice_answer')),
  prompt        TEXT NOT NULL,
  content       JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_index   INTEGER NOT NULL DEFAULT 0,
  points        INTEGER NOT NULL DEFAULT 10,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_lesson_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_lesson_activities: readable if lesson readable"
  ON public.kids_lesson_activities FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
    WHERE l.id = lesson_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_lesson_activities: course owner or admin manages"
  ON public.kids_lesson_activities FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
    WHERE l.id = lesson_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
    WHERE l.id = lesson_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE INDEX IF NOT EXISTS idx_kids_lesson_activities_lesson ON public.kids_lesson_activities(lesson_id, order_index);

-- ============================================================
-- kids_worksheets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_worksheets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     UUID REFERENCES public.kids_lessons(id) ON DELETE CASCADE,
  course_id     UUID REFERENCES public.kids_courses(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_worksheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_worksheets: public read"
  ON public.kids_worksheets FOR SELECT USING (true);

CREATE POLICY "kids_worksheets: admins manage"
  ON public.kids_worksheets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_worksheets_lesson ON public.kids_worksheets(lesson_id);
CREATE INDEX IF NOT EXISTS idx_kids_worksheets_course ON public.kids_worksheets(course_id);

-- ============================================================
-- kids_projects (assignment templates — real, hands-on projects)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID NOT NULL REFERENCES public.kids_courses(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  instructions    TEXT,
  age_range       TEXT NOT NULL DEFAULT '6-8' CHECK (age_range IN ('3-5', '6-8', '9-12', '13-15')),
  xp_reward       INTEGER NOT NULL DEFAULT 40,
  coins_reward    INTEGER NOT NULL DEFAULT 20,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_projects: readable if course readable"
  ON public.kids_projects FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_courses c
    WHERE c.id = course_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_projects: course owner or admin manages"
  ON public.kids_projects FOR ALL
  USING (EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE INDEX IF NOT EXISTS idx_kids_projects_course ON public.kids_projects(course_id);

-- ============================================================
-- Extend kids_quizzes (20260808000000) to also serve as lesson quizzes and
-- course final exams — same table, same kids_quiz_questions/
-- kids_quiz_attempts, same QuizRunner UI on the frontend. Exactly one of
-- story_id / lesson_id / course_id must be set.
-- ============================================================
ALTER TABLE public.kids_quizzes ALTER COLUMN story_id DROP NOT NULL;
ALTER TABLE public.kids_quizzes DROP CONSTRAINT IF EXISTS kids_quizzes_story_id_key;

ALTER TABLE public.kids_quizzes ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.kids_lessons(id) ON DELETE CASCADE;
ALTER TABLE public.kids_quizzes ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.kids_courses(id) ON DELETE CASCADE;

ALTER TABLE public.kids_quizzes DROP CONSTRAINT IF EXISTS kids_quizzes_one_owner;
ALTER TABLE public.kids_quizzes ADD CONSTRAINT kids_quizzes_one_owner CHECK (
  (CASE WHEN story_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN lesson_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN course_id IS NOT NULL THEN 1 ELSE 0 END) = 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kids_quizzes_story_unique ON public.kids_quizzes(story_id) WHERE story_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_kids_quizzes_lesson_unique ON public.kids_quizzes(lesson_id) WHERE lesson_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_kids_quizzes_course_unique ON public.kids_quizzes(course_id) WHERE course_id IS NOT NULL;

-- Replaces the Stories-only readability policy with one covering all three owners.
DROP POLICY IF EXISTS "kids_quizzes: readable if story readable" ON public.kids_quizzes;
CREATE POLICY "kids_quizzes: readable if owner readable"
  ON public.kids_quizzes FOR SELECT
  USING (
    (story_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_stories s WHERE s.id = story_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))))
    OR (lesson_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
      WHERE l.id = lesson_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    ))
    OR (course_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    ))
  );

DROP POLICY IF EXISTS "kids_quizzes: admins manage" ON public.kids_quizzes;
CREATE POLICY "kids_quizzes: admins or course owner manage"
  ON public.kids_quizzes FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = lesson_id AND c.teacher_id = auth.uid()))
    OR (course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND c.teacher_id = auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = lesson_id AND c.teacher_id = auth.uid()))
    OR (course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND c.teacher_id = auth.uid()))
  );

-- kids_quiz_questions' existing policies join through kids_quizzes -> kids_stories
-- specifically; replace with a policy that defers to kids_quizzes' own
-- (now-updated) readability, so it automatically covers all three owners.
DROP POLICY IF EXISTS "kids_quiz_questions: readable if quiz readable" ON public.kids_quiz_questions;
CREATE POLICY "kids_quiz_questions: readable if quiz readable"
  ON public.kids_quiz_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_quizzes q WHERE q.id = quiz_id
    AND (
      (q.story_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_stories s WHERE s.id = q.story_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))))
      OR (q.lesson_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
        WHERE l.id = q.lesson_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
      ))
      OR (q.course_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kids_courses c WHERE c.id = q.course_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
      ))
    )
  ));

DROP POLICY IF EXISTS "kids_quiz_questions: admins manage" ON public.kids_quiz_questions;
CREATE POLICY "kids_quiz_questions: admins or course owner manage"
  ON public.kids_quiz_questions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.kids_quizzes q WHERE q.id = quiz_id AND (
      public.has_role(auth.uid(), 'admin')
      OR (q.lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = q.lesson_id AND c.teacher_id = auth.uid()))
      OR (q.course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = q.course_id AND c.teacher_id = auth.uid()))
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kids_quizzes q WHERE q.id = quiz_id AND (
      public.has_role(auth.uid(), 'admin')
      OR (q.lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = q.lesson_id AND c.teacher_id = auth.uid()))
      OR (q.course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = q.course_id AND c.teacher_id = auth.uid()))
    )
  ));

-- ============================================================
-- Seed: the 22 fixed VisionKids Academy subjects
-- ============================================================
INSERT INTO public.kids_subjects (slug, name, icon, color, display_order) VALUES
  ('arabic',             'Arabic',              'Languages',      'primary',   1),
  ('english',            'English',             'Languages',      'secondary', 2),
  ('french',             'French',              'Languages',      'accent',    3),
  ('german',             'German',              'Languages',      'pink',      4),
  ('spanish',            'Spanish',             'Languages',      'green',     5),
  ('turkish',            'Turkish',             'Languages',      'purple',    6),
  ('math',               'Mathematics',         'Calculator',     'primary',   7),
  ('science',             'Science',            'FlaskConical',   'secondary', 8),
  ('physics',            'Physics (Simplified)','Atom',           'accent',    9),
  ('chemistry',          'Chemistry (Simplified)','TestTube',     'pink',      10),
  ('biology',            'Biology',             'Leaf',           'green',     11),
  ('geography',          'Geography',           'Globe2',         'purple',    12),
  ('history',            'History',             'Landmark',       'primary',   13),
  ('coding',              'Coding',             'Code2',          'secondary', 14),
  ('robotics',            'Robotics',           'Bot',            'accent',    15),
  ('ai',                  'Artificial Intelligence','Sparkles',   'pink',      16),
  ('arts',                'Arts',               'Palette',        'green',     17),
  ('music',               'Music',              'Music',          'purple',    18),
  ('logic',               'Logic',              'PuzzleIcon',     'primary',   19),
  ('critical-thinking',   'Critical Thinking',  'Brain',          'secondary', 20),
  ('finance',             'Finance for Kids',   'Coins',          'accent',    21),
  ('digital-safety',      'Digital Safety',     'ShieldCheck',    'pink',      22)
ON CONFLICT (slug) DO NOTHING;
