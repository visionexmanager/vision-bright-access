-- ============================================================
-- Migration: VisionKids Enterprise (Phase 15) — academic + operational tables.
--
-- Every table is org-scoped and isolated by the Phase 15 core helpers
-- (is_kids_org_member / _staff / _admin). Private per-student records
-- (attendance, submissions, exam results) are readable only by the student
-- themselves or org staff; shared operational data (timetable, resources,
-- announcements) is readable by any org member. Writes are staff-gated.
-- ============================================================

-- ── Attendance ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.kids_classes(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  status      TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','excused')),
  note        TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id, date)
);
ALTER TABLE public.kids_attendance ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_attendance_class ON public.kids_attendance(class_id, date);
CREATE POLICY "kids_attendance: student or staff read" ON public.kids_attendance FOR SELECT
  USING (auth.uid() = student_id OR public.is_kids_org_staff(org_id, auth.uid()));
CREATE POLICY "kids_attendance: staff manage" ON public.kids_attendance FOR ALL
  USING (public.is_kids_org_staff(org_id, auth.uid())) WITH CHECK (public.is_kids_org_staff(org_id, auth.uid()));

-- ── Assignments + submissions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.kids_classes(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    DATE,
  points      INTEGER NOT NULL DEFAULT 100,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_assignments_class ON public.kids_assignments(class_id, due_date);
CREATE POLICY "kids_assignments: members read" ON public.kids_assignments FOR SELECT
  USING (public.is_kids_org_member(org_id, auth.uid()));
CREATE POLICY "kids_assignments: staff manage" ON public.kids_assignments FOR ALL
  USING (public.is_kids_org_staff(org_id, auth.uid())) WITH CHECK (public.is_kids_org_staff(org_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.kids_assignment_submissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  assignment_id  UUID NOT NULL REFERENCES public.kids_assignments(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content        TEXT,
  file_url       TEXT,
  grade          INTEGER,
  status         TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','graded','returned')),
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);
ALTER TABLE public.kids_assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_submissions_assignment ON public.kids_assignment_submissions(assignment_id);
CREATE POLICY "kids_submissions: student or staff read" ON public.kids_assignment_submissions FOR SELECT
  USING (auth.uid() = student_id OR public.is_kids_org_staff(org_id, auth.uid()));
CREATE POLICY "kids_submissions: student submits" ON public.kids_assignment_submissions FOR INSERT
  WITH CHECK (auth.uid() = student_id AND public.is_kids_org_member(org_id, auth.uid()));
CREATE POLICY "kids_submissions: student edits own" ON public.kids_assignment_submissions FOR UPDATE
  USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
CREATE POLICY "kids_submissions: staff grade" ON public.kids_assignment_submissions FOR ALL
  USING (public.is_kids_org_staff(org_id, auth.uid())) WITH CHECK (public.is_kids_org_staff(org_id, auth.uid()));

-- ── Timetable ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_timetable (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  class_id     UUID NOT NULL REFERENCES public.kids_classes(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period       INTEGER NOT NULL DEFAULT 1,
  subject      TEXT NOT NULL,
  start_time   TEXT,
  end_time     TEXT,
  teacher_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recurring    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_timetable ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_timetable_class ON public.kids_timetable(class_id, day_of_week, period);
CREATE POLICY "kids_timetable: members read" ON public.kids_timetable FOR SELECT
  USING (public.is_kids_org_member(org_id, auth.uid()));
CREATE POLICY "kids_timetable: staff manage" ON public.kids_timetable FOR ALL
  USING (public.is_kids_org_staff(org_id, auth.uid())) WITH CHECK (public.is_kids_org_staff(org_id, auth.uid()));

-- ── Exams + results ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_exams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.kids_classes(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  subject     TEXT,
  exam_date   DATE,
  total_marks INTEGER NOT NULL DEFAULT 100,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_exams ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_exams_class ON public.kids_exams(class_id, exam_date);
CREATE POLICY "kids_exams: members read" ON public.kids_exams FOR SELECT
  USING (public.is_kids_org_member(org_id, auth.uid()));
CREATE POLICY "kids_exams: staff manage" ON public.kids_exams FOR ALL
  USING (public.is_kids_org_staff(org_id, auth.uid())) WITH CHECK (public.is_kids_org_staff(org_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.kids_exam_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  exam_id     UUID NOT NULL REFERENCES public.kids_exams(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marks       INTEGER NOT NULL DEFAULT 0,
  grade       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id)
);
ALTER TABLE public.kids_exam_results ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_exam_results_exam ON public.kids_exam_results(exam_id);
CREATE POLICY "kids_exam_results: student or staff read" ON public.kids_exam_results FOR SELECT
  USING (auth.uid() = student_id OR public.is_kids_org_staff(org_id, auth.uid()));
CREATE POLICY "kids_exam_results: staff manage" ON public.kids_exam_results FOR ALL
  USING (public.is_kids_org_staff(org_id, auth.uid())) WITH CHECK (public.is_kids_org_staff(org_id, auth.uid()));

-- ── Resource / Library Center ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_org_resources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'file' CHECK (type IN ('book','file','video','activity','exam','link')),
  title       TEXT NOT NULL,
  description TEXT,
  url         TEXT,
  emoji       TEXT NOT NULL DEFAULT '📄',
  category    TEXT,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_org_resources ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_org_resources_org ON public.kids_org_resources(org_id, type);
CREATE POLICY "kids_org_resources: members read" ON public.kids_org_resources FOR SELECT
  USING (public.is_kids_org_member(org_id, auth.uid()));
CREATE POLICY "kids_org_resources: staff manage" ON public.kids_org_resources FOR ALL
  USING (public.is_kids_org_staff(org_id, auth.uid())) WITH CHECK (public.is_kids_org_staff(org_id, auth.uid()));

-- ── Communication Center — announcements ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_org_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'announcement' CHECK (kind IN ('announcement','meeting','survey')),
  title       TEXT NOT NULL,
  body        TEXT,
  audience    TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','teachers','parents','students')),
  meeting_at  TIMESTAMPTZ,
  link        TEXT,
  author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_org_announcements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_org_announcements_org ON public.kids_org_announcements(org_id, created_at DESC);
CREATE POLICY "kids_org_announcements: members read" ON public.kids_org_announcements FOR SELECT
  USING (public.is_kids_org_member(org_id, auth.uid()));
CREATE POLICY "kids_org_announcements: staff manage" ON public.kids_org_announcements FOR ALL
  USING (public.is_kids_org_staff(org_id, auth.uid())) WITH CHECK (public.is_kids_org_staff(org_id, auth.uid()));

-- ── Certificates (QR-verifiable) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_org_certificates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  verify_code  TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  signature    TEXT,
  issued_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','revoked'))
);
ALTER TABLE public.kids_org_certificates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_org_certificates_org ON public.kids_org_certificates(org_id, issued_at DESC);
CREATE POLICY "kids_org_certificates: student or staff read" ON public.kids_org_certificates FOR SELECT
  USING (auth.uid() = student_id OR public.is_kids_org_staff(org_id, auth.uid()));
CREATE POLICY "kids_org_certificates: staff manage" ON public.kids_org_certificates FOR ALL
  USING (public.is_kids_org_staff(org_id, auth.uid())) WITH CHECK (public.is_kids_org_staff(org_id, auth.uid()));

-- ── Enterprise audit log (org-scoped) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_enterprise_audit (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      UUID REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_enterprise_audit ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_enterprise_audit_org ON public.kids_enterprise_audit(org_id, created_at DESC);
CREATE POLICY "kids_enterprise_audit: admins read" ON public.kids_enterprise_audit FOR SELECT
  USING (public.is_kids_org_admin(org_id, auth.uid()));
