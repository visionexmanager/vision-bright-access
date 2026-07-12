-- ============================================================
-- Migration: Academy LMS core (Phase 1 backend)
-- Purpose:   Real Supabase tables for the course/lesson backbone that
--            previously lived only in localStorage (see
--            src/lib/academy/instructorLocalStore.ts and lessonLocalStore.ts,
--            docs/ACADEMY.md §9 "Known Limitations" #1).
--
-- Tables added: academy_instructor_applications, academy_instructors,
--   academy_courses, academy_course_modules, academy_enrollments,
--   academy_lessons, academy_lesson_progress, academy_lesson_notes,
--   academy_lesson_bookmarks, academy_course_reviews,
--   academy_learning_tracks, academy_learning_track_progress.
--
-- Shapes mirror src/lib/types/academy-modules.ts + academy-lms.ts exactly,
-- so the service-layer rewrite is a straight field-for-field mapping.
--
-- Ordering note: tables are created before any RLS policy/helper function
-- that references them (Postgres validates object references in both
-- LANGUAGE sql functions and CREATE POLICY expressions at creation time).
-- academy_enrollments.current_lesson_id -> academy_lessons is added via a
-- separate ALTER TABLE at the end to break the enrollments<->lessons cycle.
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- academy_instructor_applications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_instructor_applications (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  headline                        TEXT NOT NULL DEFAULT '',
  bio                             TEXT NOT NULL DEFAULT '',
  skills                          TEXT[] NOT NULL DEFAULT '{}',
  status                          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','suspended')),
  submitted_at                    TIMESTAMPTZ,
  experience_years                INTEGER NOT NULL DEFAULT 0,
  expertise                       TEXT[] NOT NULL DEFAULT '{}',
  languages                       TEXT[] NOT NULL DEFAULT '{}',
  country                         TEXT,
  portfolio_url                   TEXT,
  identity_verification_status    TEXT NOT NULL DEFAULT 'not_started' CHECK (identity_verification_status IN ('not_started','submitted','verified')),
  agreement_accepted              BOOLEAN NOT NULL DEFAULT false,
  terms_accepted                  BOOLEAN NOT NULL DEFAULT false,
  review_note                     TEXT,
  reviewed_at                     TIMESTAMPTZ,
  reviewed_by_user_id             UUID REFERENCES auth.users(id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.academy_instructor_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_instructor_applications: owner reads own"
  ON public.academy_instructor_applications FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "academy_instructor_applications: owner creates own draft"
  ON public.academy_instructor_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'draft');

-- Owner may edit their own draft/pending state but can never self-approve/reject/suspend.
CREATE POLICY "academy_instructor_applications: owner updates own"
  ON public.academy_instructor_applications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status IN ('draft', 'pending'));

CREATE POLICY "academy_instructor_applications: owner deletes own draft"
  ON public.academy_instructor_applications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "academy_instructor_applications: admins review"
  ON public.academy_instructor_applications FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER academy_instructor_applications_updated_at
  BEFORE UPDATE ON public.academy_instructor_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_academy_instructor_applications_status ON public.academy_instructor_applications(status);

COMMENT ON TABLE public.academy_instructor_applications IS 'Become-an-instructor applications; one per user; admin-reviewed.';

-- ============================================================
-- academy_instructors
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_instructors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null for VisionEx-staff/system instructors
  name              TEXT NOT NULL DEFAULT '',
  bio               TEXT,
  avatar_url        TEXT,
  subjects          TEXT[] NOT NULL DEFAULT '{}',
  rating            NUMERIC,
  verified          BOOLEAN NOT NULL DEFAULT false,
  headline          TEXT,
  social_links      JSONB NOT NULL DEFAULT '{}'::jsonb,
  skills            TEXT[] NOT NULL DEFAULT '{}',
  courses_count     INTEGER NOT NULL DEFAULT 0,
  students_count    INTEGER NOT NULL DEFAULT 0,
  cover_image_url   TEXT,
  expertise         TEXT[] NOT NULL DEFAULT '{}',
  languages         TEXT[] NOT NULL DEFAULT '{}',
  country           TEXT,
  certifications    TEXT[] NOT NULL DEFAULT '{}',
  portfolio_url     TEXT,
  level             TEXT NOT NULL DEFAULT 'new' CHECK (level IN ('new','rising','expert','master')),
  organization_id   UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.academy_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_instructors: public read"
  ON public.academy_instructors FOR SELECT
  USING (true);

CREATE POLICY "academy_instructors: approved applicant creates own"
  ON public.academy_instructors FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.academy_instructor_applications
      WHERE user_id = auth.uid() AND status = 'approved'
    )
  );

CREATE POLICY "academy_instructors: owner updates own"
  ON public.academy_instructors FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "academy_instructors: admins manage all"
  ON public.academy_instructors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER academy_instructors_updated_at
  BEFORE UPDATE ON public.academy_instructors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_academy_instructors_user ON public.academy_instructors(user_id);

COMMENT ON TABLE public.academy_instructors IS 'Public instructor profiles (staff or approved marketplace applicants).';

-- ============================================================
-- academy_courses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_courses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL DEFAULT '',
  description         TEXT NOT NULL DEFAULT '',
  level               TEXT NOT NULL DEFAULT '',
  subject             TEXT NOT NULL DEFAULT '',
  instructor_id       UUID NOT NULL REFERENCES public.academy_instructors(id) ON DELETE CASCADE,
  cover_image_url     TEXT,
  published           BOOLEAN NOT NULL DEFAULT false,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished','archived')),
  gallery_urls        TEXT[] NOT NULL DEFAULT '{}',
  source              TEXT NOT NULL DEFAULT 'marketplace' CHECK (source IN ('visionex','marketplace','youtube','ai')),
  difficulty          TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  language            TEXT NOT NULL DEFAULT 'العربية',
  trailer_video_url   TEXT,
  youtube_video_id    TEXT,
  category            TEXT NOT NULL DEFAULT '',
  tags                TEXT[] NOT NULL DEFAULT '{}',
  duration_minutes    INTEGER NOT NULL DEFAULT 0,
  is_free             BOOLEAN NOT NULL DEFAULT true,
  price_vx            INTEGER,
  rating_avg          NUMERIC,
  rating_count        INTEGER NOT NULL DEFAULT 0,
  students_count      INTEGER NOT NULL DEFAULT 0,
  learning_outcomes   TEXT[] NOT NULL DEFAULT '{}',
  requirements        TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Helper functions (SECURITY DEFINER — avoid RLS recursion, same pattern
--    as public.has_role from 20260323150121_*.sql). Defined here because
--    they depend on academy_courses/academy_instructors existing. ─────────

CREATE OR REPLACE FUNCTION public.is_academy_course_owner(_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_instructors i ON i.id = c.instructor_id
    WHERE c.id = _course_id AND i.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_academy_course_published(_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academy_courses WHERE id = _course_id AND status = 'published'
  )
$$;

ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_courses: public reads published"
  ON public.academy_courses FOR SELECT
  USING (
    status = 'published'
    OR EXISTS (SELECT 1 FROM public.academy_instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "academy_courses: instructors manage own"
  ON public.academy_courses FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.academy_instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.academy_instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER academy_courses_updated_at
  BEFORE UPDATE ON public.academy_courses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_academy_courses_instructor ON public.academy_courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_status ON public.academy_courses(status);
CREATE INDEX IF NOT EXISTS idx_academy_courses_category ON public.academy_courses(category);

COMMENT ON TABLE public.academy_courses IS 'Academy courses. status=published is the only publicly browsable state.';

-- ============================================================
-- academy_course_modules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_course_modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',
  order_index   INTEGER NOT NULL DEFAULT 0,
  content_url   TEXT
);

ALTER TABLE public.academy_course_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_course_modules: read if course visible"
  ON public.academy_course_modules FOR SELECT
  USING (
    public.is_academy_course_published(course_id)
    OR public.is_academy_course_owner(course_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "academy_course_modules: owner writes"
  ON public.academy_course_modules FOR ALL
  USING (public.is_academy_course_owner(course_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_academy_course_owner(course_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_academy_course_modules_course ON public.academy_course_modules(course_id, order_index);

-- ============================================================
-- academy_enrollments
-- (current_lesson_id FK to academy_lessons is added after that table exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_enrollments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id                UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  progress_percent         NUMERIC NOT NULL DEFAULT 0,
  enrolled_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at             TIMESTAMPTZ,
  current_lesson_id        UUID,
  last_position_seconds    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, course_id)
);

ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_enrollments: student manages own"
  ON public.academy_enrollments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "academy_enrollments: instructor/admin read roster"
  ON public.academy_enrollments FOR SELECT
  USING (public.is_academy_course_owner(course_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_academy_enrollments_user ON public.academy_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_course ON public.academy_enrollments(course_id);

CREATE OR REPLACE FUNCTION public.is_enrolled_in_academy_course(_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academy_enrollments
    WHERE course_id = _course_id AND user_id = auth.uid()
  )
$$;

-- ============================================================
-- academy_lessons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_lessons (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id                   UUID NOT NULL REFERENCES public.academy_course_modules(id) ON DELETE CASCADE,
  course_id                   UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  title                       TEXT NOT NULL DEFAULT '',
  kind                        TEXT NOT NULL DEFAULT 'video' CHECK (kind IN
    ('video','youtube','text','quiz','assignment','project','pdf','presentation','audio',
     'external_link','downloads','live_session','code_example','exercise')),
  order_index                 INTEGER NOT NULL DEFAULT 0,
  duration_seconds            INTEGER NOT NULL DEFAULT 0,
  video_url                   TEXT,
  youtube_video_id            TEXT,
  body_markdown                TEXT,
  file_url                    TEXT,
  live_session_scheduled_at   TIMESTAMPTZ,
  attachments                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  external_links              JSONB NOT NULL DEFAULT '[]'::jsonb,
  code_snippets                JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_preview                  BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_lessons: read preview/enrolled/owner/admin"
  ON public.academy_lessons FOR SELECT
  USING (
    (is_preview = true AND public.is_academy_course_published(course_id))
    OR public.is_enrolled_in_academy_course(course_id)
    OR public.is_academy_course_owner(course_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "academy_lessons: owner writes"
  ON public.academy_lessons FOR ALL
  USING (public.is_academy_course_owner(course_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_academy_course_owner(course_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER academy_lessons_updated_at
  BEFORE UPDATE ON public.academy_lessons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_academy_lessons_course ON public.academy_lessons(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_academy_lessons_module ON public.academy_lessons(module_id, order_index);

ALTER TABLE public.academy_enrollments
  ADD CONSTRAINT academy_enrollments_current_lesson_fkey
  FOREIGN KEY (current_lesson_id) REFERENCES public.academy_lessons(id) ON DELETE SET NULL;

-- ============================================================
-- academy_lesson_progress
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_lesson_progress (
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id                UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  course_id                UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  completed                BOOLEAN NOT NULL DEFAULT false,
  last_position_seconds    INTEGER NOT NULL DEFAULT 0,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

ALTER TABLE public.academy_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_lesson_progress: student manages own"
  ON public.academy_lesson_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "academy_lesson_progress: instructor/admin read"
  ON public.academy_lesson_progress FOR SELECT
  USING (public.is_academy_course_owner(course_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_academy_lesson_progress_course ON public.academy_lesson_progress(course_id);

-- ============================================================
-- academy_lesson_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_lesson_notes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id            UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  timestamp_seconds    INTEGER,
  content              TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.academy_lesson_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_lesson_notes: student manages own"
  ON public.academy_lesson_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_academy_lesson_notes_user ON public.academy_lesson_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academy_lesson_notes_lesson ON public.academy_lesson_notes(lesson_id);

-- ============================================================
-- academy_lesson_bookmarks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_lesson_bookmarks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id            UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  timestamp_seconds    INTEGER,
  label                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.academy_lesson_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_lesson_bookmarks: student manages own"
  ON public.academy_lesson_bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_academy_lesson_bookmarks_user ON public.academy_lesson_bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academy_lesson_bookmarks_lesson ON public.academy_lesson_bookmarks(lesson_id);

-- ============================================================
-- academy_course_reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_course_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

ALTER TABLE public.academy_course_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_course_reviews: public read"
  ON public.academy_course_reviews FOR SELECT
  USING (true);

CREATE POLICY "academy_course_reviews: enrolled student creates own"
  ON public.academy_course_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_enrolled_in_academy_course(course_id));

CREATE POLICY "academy_course_reviews: owner updates own"
  ON public.academy_course_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "academy_course_reviews: owner/admin deletes"
  ON public.academy_course_reviews FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_academy_course_reviews_course ON public.academy_course_reviews(course_id);

-- ============================================================
-- academy_learning_tracks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_learning_tracks (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                          TEXT NOT NULL DEFAULT '',
  description                    TEXT NOT NULL DEFAULT '',
  difficulty                     TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  course_ids                     UUID[] NOT NULL DEFAULT '{}',
  estimated_duration_minutes     INTEGER NOT NULL DEFAULT 0,
  skills                         TEXT[] NOT NULL DEFAULT '{}',
  certificate_id                 UUID,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.academy_learning_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_learning_tracks: public read"
  ON public.academy_learning_tracks FOR SELECT
  USING (true);

CREATE POLICY "academy_learning_tracks: admins manage"
  ON public.academy_learning_tracks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- academy_learning_track_progress
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_learning_track_progress (
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id                 UUID NOT NULL REFERENCES public.academy_learning_tracks(id) ON DELETE CASCADE,
  completed_course_ids     UUID[] NOT NULL DEFAULT '{}',
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

ALTER TABLE public.academy_learning_track_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_learning_track_progress: student manages own"
  ON public.academy_learning_track_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
