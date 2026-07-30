-- ============================================================
-- Migration: VisionKids Academy — enrollments, lesson progress, activity
-- attempts, homework (+ submissions), student projects, certificates.
--
-- Reused, not redefined: public.touch_updated_at(), public.has_role().
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kids_course_enrollments (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES public.kids_courses(id) ON DELETE CASCADE,
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

ALTER TABLE public.kids_course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_course_enrollments: user manages own"
  ON public.kids_course_enrollments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_course_enrollments: course teacher reads roster"
  ON public.kids_course_enrollments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE INDEX IF NOT EXISTS idx_kids_course_enrollments_course ON public.kids_course_enrollments(course_id);

-- ============================================================
-- kids_parent_child_links — defined here (not in the roles migration)
-- because kids_lesson_progress's RLS below needs it to exist first.
-- Links are created exclusively via redeem_kids_parent_link_code() (see
-- the roles migration), never by direct INSERT, so a parent can't link
-- themselves to an arbitrary child without that child's own code.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_parent_child_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, child_user_id)
);

ALTER TABLE public.kids_parent_child_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_parent_child_links: parent or child reads own link"
  ON public.kids_parent_child_links FOR SELECT
  USING (auth.uid() = parent_user_id OR auth.uid() = child_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_parent_child_links: parent unlinks own"
  ON public.kids_parent_child_links FOR DELETE
  USING (auth.uid() = parent_user_id);

-- No direct INSERT policy — see redeem_kids_parent_link_code() below.

CREATE INDEX IF NOT EXISTS idx_kids_parent_child_links_parent ON public.kids_parent_child_links(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_kids_parent_child_links_child ON public.kids_parent_child_links(child_user_id);

-- ============================================================
-- kids_lesson_progress ("Learning Path" unlocking + "Learning Analytics"
-- both read off this one table — same non-duplication reasoning as
-- kids_reading_progress in Stories).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_lesson_progress (
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id           UUID NOT NULL REFERENCES public.kids_lessons(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  score               NUMERIC(5,2),
  time_spent_seconds  INTEGER NOT NULL DEFAULT 0,
  completed_at        TIMESTAMPTZ,
  last_accessed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

ALTER TABLE public.kids_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_lesson_progress: user manages own"
  ON public.kids_lesson_progress FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_lesson_progress: course teacher and linked parent read"
  ON public.kids_lesson_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
      WHERE l.id = lesson_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
    OR EXISTS (SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = user_id AND pcl.parent_user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_kids_lesson_progress_user ON public.kids_lesson_progress(user_id, last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_lesson_progress_lesson ON public.kids_lesson_progress(lesson_id);

-- ============================================================
-- kids_activity_attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_activity_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id   UUID NOT NULL REFERENCES public.kids_lesson_activities(id) ON DELETE CASCADE,
  answer        JSONB NOT NULL DEFAULT '{}'::jsonb,
  correct       BOOLEAN NOT NULL DEFAULT false,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_activity_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_activity_attempts: user manages own"
  ON public.kids_activity_attempts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_activity_attempts_user ON public.kids_activity_attempts(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_activity_attempts_activity ON public.kids_activity_attempts(activity_id);

-- ============================================================
-- kids_homework / kids_homework_submissions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_homework (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES public.kids_courses(id) ON DELETE CASCADE,
  lesson_id     UUID REFERENCES public.kids_lessons(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  due_note      TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_homework ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_homework: readable if course readable"
  ON public.kids_homework FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE POLICY "kids_homework: course owner or admin manages"
  ON public.kids_homework FOR ALL
  USING (EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE INDEX IF NOT EXISTS idx_kids_homework_course ON public.kids_homework(course_id);

CREATE TABLE IF NOT EXISTS public.kids_homework_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id   UUID NOT NULL REFERENCES public.kids_homework(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text_answer   TEXT,
  file_urls     TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded')),
  grade         INTEGER CHECK (grade BETWEEN 0 AND 100),
  feedback      TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at     TIMESTAMPTZ,
  UNIQUE (homework_id, user_id)
);

ALTER TABLE public.kids_homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_homework_submissions: student manages own"
  ON public.kids_homework_submissions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_homework_submissions: course teacher reads and grades"
  ON public.kids_homework_submissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_homework h JOIN public.kids_courses c ON c.id = h.course_id
    WHERE h.id = homework_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_homework_submissions: course teacher grades"
  ON public.kids_homework_submissions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.kids_homework h JOIN public.kids_courses c ON c.id = h.course_id
    WHERE h.id = homework_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kids_homework h JOIN public.kids_courses c ON c.id = h.course_id
    WHERE h.id = homework_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

-- A student's own UPDATE policy (above) would otherwise let them set their
-- own grade — this trigger locks grade/feedback/status to teacher/admin
-- actors only, regardless of which RLS policy let the UPDATE through.
CREATE OR REPLACE FUNCTION public.kids_lock_submission_grading_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_grader BOOLEAN;
BEGIN
  SELECT (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_homework h JOIN public.kids_courses c ON c.id = h.course_id
    WHERE h.id = NEW.homework_id AND c.teacher_id = auth.uid()
  )) INTO _is_grader;

  IF NOT _is_grader THEN
    NEW.grade := OLD.grade;
    NEW.feedback := OLD.feedback;
    NEW.status := OLD.status;
    NEW.graded_at := OLD.graded_at;
  ELSE
    IF NEW.grade IS DISTINCT FROM OLD.grade OR NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status := 'graded';
      NEW.graded_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER kids_homework_submissions_lock_grading
  BEFORE UPDATE ON public.kids_homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.kids_lock_submission_grading_fields();

CREATE INDEX IF NOT EXISTS idx_kids_homework_submissions_homework ON public.kids_homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_kids_homework_submissions_user ON public.kids_homework_submissions(user_id);

-- ============================================================
-- kids_student_projects (submissions against kids_projects templates) —
-- same grading-lock pattern as homework submissions.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_student_projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.kids_projects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text_content  TEXT,
  file_urls     TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded')),
  grade         INTEGER CHECK (grade BETWEEN 0 AND 100),
  feedback      TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at     TIMESTAMPTZ,
  UNIQUE (project_id, user_id)
);

ALTER TABLE public.kids_student_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_student_projects: student manages own"
  ON public.kids_student_projects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_student_projects: course teacher reads and grades"
  ON public.kids_student_projects FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_projects p JOIN public.kids_courses c ON c.id = p.course_id
    WHERE p.id = project_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "kids_student_projects: course teacher grades"
  ON public.kids_student_projects FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.kids_projects p JOIN public.kids_courses c ON c.id = p.course_id
    WHERE p.id = project_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kids_projects p JOIN public.kids_courses c ON c.id = p.course_id
    WHERE p.id = project_id AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE OR REPLACE FUNCTION public.kids_lock_project_grading_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_grader BOOLEAN;
BEGIN
  SELECT (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_projects p JOIN public.kids_courses c ON c.id = p.course_id
    WHERE p.id = NEW.project_id AND c.teacher_id = auth.uid()
  )) INTO _is_grader;

  IF NOT _is_grader THEN
    NEW.grade := OLD.grade;
    NEW.feedback := OLD.feedback;
    NEW.status := OLD.status;
    NEW.graded_at := OLD.graded_at;
  ELSE
    IF NEW.grade IS DISTINCT FROM OLD.grade OR NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status := 'graded';
      NEW.graded_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER kids_student_projects_lock_grading
  BEFORE UPDATE ON public.kids_student_projects
  FOR EACH ROW EXECUTE FUNCTION public.kids_lock_project_grading_fields();

CREATE INDEX IF NOT EXISTS idx_kids_student_projects_project ON public.kids_student_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_kids_student_projects_user ON public.kids_student_projects(user_id);

-- ============================================================
-- kids_certificates — mirrors public.library_certificates exactly
-- (20260802000000_library_learning_hub.sql): service-role-only issuance
-- with an HMAC signature, public verify-by-number RPC, no direct
-- INSERT/UPDATE policy for anyone.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_certificates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_type      TEXT NOT NULL CHECK (certificate_type IN ('course', 'learning_path')),
  reference_id          UUID NOT NULL,
  title                 TEXT NOT NULL,
  recipient_name        TEXT NOT NULL,
  issuer_name           TEXT NOT NULL DEFAULT 'VisionKids Academy',
  score_percent         NUMERIC,
  certificate_number    TEXT NOT NULL UNIQUE,
  verification_code     TEXT NOT NULL UNIQUE,
  signature_hash        TEXT,
  issued_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_certificates: user reads own"
  ON public.kids_certificates FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Deliberately no INSERT/UPDATE policy — issuance is exclusively the
-- kids-issue-certificate edge function's service-role client, after it
-- verifies course completion and computes the HMAC signature server-side.

CREATE INDEX IF NOT EXISTS idx_kids_certificates_user ON public.kids_certificates(user_id, issued_at DESC);

CREATE OR REPLACE FUNCTION public.verify_kids_certificate(_certificate_number TEXT)
RETURNS TABLE (
  title TEXT, recipient_name TEXT, issuer_name TEXT, certificate_type TEXT,
  score_percent NUMERIC, issued_at TIMESTAMPTZ, verification_code TEXT, signature_hash TEXT, is_valid BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.title, c.recipient_name, c.issuer_name, c.certificate_type,
         c.score_percent, c.issued_at, c.verification_code, c.signature_hash,
         (c.signature_hash IS NOT NULL) AS is_valid
  FROM public.kids_certificates c
  WHERE c.certificate_number = _certificate_number;
$$;

GRANT EXECUTE ON FUNCTION public.verify_kids_certificate(TEXT) TO anon, authenticated;
