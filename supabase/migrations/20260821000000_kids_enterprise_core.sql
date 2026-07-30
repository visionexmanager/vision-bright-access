-- ============================================================
-- Migration: VisionKids Enterprise & School Ecosystem (Phase 15) — the
-- multi-tenant foundation.
--
-- CORE PROPERTY — data isolation between organizations. Every org-scoped table
-- carries an `org_id` and is gated by membership helper functions. Those
-- helpers are SECURITY DEFINER, so they read kids_org_members WITHOUT invoking
-- RLS — which both enforces isolation and avoids policy recursion. A user can
-- only ever see data for organizations they belong to; roles inside an org
-- (owner/admin/teacher/parent/student/staff) gate writes.
-- ============================================================

-- ============================================================
-- kids_organizations — a tenant. Owns its own branding, settings, storage
-- quota, and (optionally) a custom domain. Created via create_kids_org (which
-- also makes the caller its owner) — see the RPC migration.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'school' CHECK (kind IN ('school','nursery','center','library','nonprofit')),
  domain        TEXT,
  logo_url      TEXT,
  branding      JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_quota_mb INTEGER NOT NULL DEFAULT 1024,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- kids_org_members — membership + role, the heart of isolation. One row per
-- (org, user). `role` drives all write permissions inside the org.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_org_members (
  org_id      UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('owner','admin','teacher','parent','student','staff')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended')),
  display_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

ALTER TABLE public.kids_org_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_org_members_user ON public.kids_org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_kids_org_members_org ON public.kids_org_members(org_id, role);

-- ── Isolation helpers (SECURITY DEFINER → bypass RLS, no recursion) ──────────
CREATE OR REPLACE FUNCTION public.is_kids_org_member(_org UUID, _uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.kids_org_members
    WHERE org_id = _org AND user_id = _uid AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.kids_org_role(_org UUID, _uid UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.kids_org_members
    WHERE org_id = _org AND user_id = _uid AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_kids_org_admin(_org UUID, _uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.kids_org_members
    WHERE org_id = _org AND user_id = _uid AND status = 'active' AND role IN ('owner','admin'))
    OR public.has_role(_uid, 'admin');
$$;

-- Staff = can manage classroom-level data (admins + teachers + staff).
CREATE OR REPLACE FUNCTION public.is_kids_org_staff(_org UUID, _uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.kids_org_members
    WHERE org_id = _org AND user_id = _uid AND status = 'active' AND role IN ('owner','admin','teacher','staff'))
    OR public.has_role(_uid, 'admin');
$$;

-- ── Organizations RLS ────────────────────────────────────────────────────────
CREATE POLICY "kids_organizations: members read" ON public.kids_organizations FOR SELECT
  USING (public.is_kids_org_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_organizations: admins update" ON public.kids_organizations FOR UPDATE
  USING (public.is_kids_org_admin(id, auth.uid())) WITH CHECK (public.is_kids_org_admin(id, auth.uid()));
-- INSERT via create_kids_org RPC (SECURITY DEFINER).

-- ── Members RLS ──────────────────────────────────────────────────────────────
CREATE POLICY "kids_org_members: self or co-member reads" ON public.kids_org_members FOR SELECT
  USING (auth.uid() = user_id OR public.is_kids_org_member(org_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_org_members: admins manage" ON public.kids_org_members FOR ALL
  USING (public.is_kids_org_admin(org_id, auth.uid())) WITH CHECK (public.is_kids_org_admin(org_id, auth.uid()));

-- ============================================================
-- kids_schools — an org can run several schools/sites. Org-scoped.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_schools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'school',
  address     TEXT,
  logo_url    TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_schools ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_schools_org ON public.kids_schools(org_id, order_index);
CREATE POLICY "kids_schools: members read" ON public.kids_schools FOR SELECT
  USING (public.is_kids_org_member(org_id, auth.uid()));
CREATE POLICY "kids_schools: admins manage" ON public.kids_schools FOR ALL
  USING (public.is_kids_org_admin(org_id, auth.uid())) WITH CHECK (public.is_kids_org_admin(org_id, auth.uid()));

-- ============================================================
-- kids_classes — a classroom, owned by a school (and thus an org). `teacher_id`
-- is the lead teacher's user id.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  school_id   UUID REFERENCES public.kids_schools(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  grade       TEXT,
  subject     TEXT,
  teacher_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_classes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_classes_org ON public.kids_classes(org_id);
CREATE INDEX IF NOT EXISTS idx_kids_classes_school ON public.kids_classes(school_id);
CREATE POLICY "kids_classes: members read" ON public.kids_classes FOR SELECT
  USING (public.is_kids_org_member(org_id, auth.uid()));
CREATE POLICY "kids_classes: staff manage" ON public.kids_classes FOR ALL
  USING (public.is_kids_org_staff(org_id, auth.uid())) WITH CHECK (public.is_kids_org_staff(org_id, auth.uid()));

-- ============================================================
-- kids_class_students — class roster. Org-scoped (denormalized org_id for RLS).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_class_students (
  class_id    UUID NOT NULL REFERENCES public.kids_classes(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);

ALTER TABLE public.kids_class_students ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_class_students_org ON public.kids_class_students(org_id);
CREATE INDEX IF NOT EXISTS idx_kids_class_students_student ON public.kids_class_students(student_id);
-- A student sees their own membership; staff see the whole roster; all within the org.
CREATE POLICY "kids_class_students: member reads" ON public.kids_class_students FOR SELECT
  USING (auth.uid() = student_id OR public.is_kids_org_staff(org_id, auth.uid()));
CREATE POLICY "kids_class_students: staff manage" ON public.kids_class_students FOR ALL
  USING (public.is_kids_org_staff(org_id, auth.uid())) WITH CHECK (public.is_kids_org_staff(org_id, auth.uid()));
