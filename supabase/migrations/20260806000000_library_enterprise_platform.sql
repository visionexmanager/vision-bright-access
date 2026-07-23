-- ─── Library — Enterprise & Organization Platform ──────────────────────────
-- Multi-tenant organizations (schools/universities/companies/government/NGOs/
-- public & private libraries/research centers/medical institutions) with
-- their own members, groups, private resources, granular permissions,
-- licenses, and learning-management assignments.
--
-- No existing "organization with members" concept exists anywhere in this
-- app (confirmed via research: Career Center's `companies` table is
-- single-owner with no real seats/roster). This mirrors library_clubs'
-- proven owner/members(role,status) + SECURITY DEFINER helper-function shape
-- instead, since that pattern already avoids the classic RLS self-recursion
-- trap for "am I a member of this thing" checks.

-- ============================================================================
-- 1. ORGANIZATIONS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.organization_type AS ENUM (
    'school', 'university', 'training_center', 'company', 'government',
    'ngo', 'public_library', 'private_library', 'research_center', 'medical_institution'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  org_type     public.organization_type NOT NULL,
  description  TEXT,
  logo_url     TEXT,
  website      TEXT,
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_count INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  -- SSO-readiness fields: intentionally just a config surface, not a working
  -- integration — actual SAML/OIDC federation requires enabling Supabase's
  -- SSO feature (paid tier) via the Supabase dashboard, not application code.
  -- See the Security settings UI for the explicit disclosure shown to admins.
  sso_domain   TEXT,
  sso_enabled  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 2. MEMBERS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.organization_member_role AS ENUM (
    'owner', 'admin', 'manager', 'teacher', 'student', 'employee', 'researcher', 'guest', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.organization_member_status AS ENUM ('invited', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role             public.organization_member_role NOT NULL DEFAULT 'guest',
  custom_role_label TEXT,
  department_id    UUID,  -- FK added after organization_groups exists (below)
  status           public.organization_member_status NOT NULL DEFAULT 'invited',
  invited_email    TEXT,
  invited_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);

-- A user can only have ONE membership row per org once user_id is known;
-- invited-but-unclaimed rows (user_id NULL) are keyed by email instead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_members_org_user
  ON public.organization_members(organization_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_members_org_email
  ON public.organization_members(organization_id, invited_email) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members(user_id);

CREATE OR REPLACE FUNCTION public.is_organization_member(_organization_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _organization_id AND user_id = auth.uid() AND status = 'active')
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = _organization_id AND owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_organization_admin(_organization_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = _organization_id AND user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin', 'manager')
    )
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = _organization_id AND owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
$$;

-- Now that is_organization_member/admin exist, the organizations table's
-- own RLS policies can reference them.
CREATE POLICY "organizations: member reads"
  ON public.organizations FOR SELECT
  USING (public.is_organization_member(id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "organizations: authenticated creates own"
  ON public.organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "organizations: admin updates"
  ON public.organizations FOR UPDATE
  USING (public.is_organization_admin(id));

CREATE POLICY "organizations: owner deletes"
  ON public.organizations FOR DELETE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.trg_organization_auto_owner_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'active', now())
  ON CONFLICT (organization_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_auto_owner
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_organization_auto_owner_member();

CREATE OR REPLACE FUNCTION public.trg_bump_organization_member_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      UPDATE public.organizations SET member_count = member_count + 1 WHERE id = NEW.organization_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'active' THEN
      UPDATE public.organizations SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.organization_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'active' AND NEW.status = 'active' THEN
      UPDATE public.organizations SET member_count = member_count + 1 WHERE id = NEW.organization_id;
    ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
      UPDATE public.organizations SET member_count = GREATEST(member_count - 1, 0) WHERE id = NEW.organization_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_organization_members_count
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_organization_member_count();

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_members: member reads own org roster"
  ON public.organization_members FOR SELECT
  USING (public.is_organization_member(organization_id));

CREATE POLICY "organization_members: admin manages"
  ON public.organization_members FOR ALL
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE POLICY "organization_members: invited user claims own row"
  ON public.organization_members FOR UPDATE
  USING (invited_email = auth.email() AND user_id IS NULL)
  WITH CHECK (invited_email = auth.email() AND user_id = auth.uid());

-- ============================================================================
-- 3. GROUPS (departments/classes/teams/projects/research groups/book clubs/
-- learning groups)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.organization_group_type AS ENUM (
    'department', 'class', 'team', 'project', 'research_group', 'book_club', 'learning_group'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organization_groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_type       public.organization_group_type NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  parent_group_id  UUID REFERENCES public.organization_groups(id) ON DELETE SET NULL,
  -- Optional bridge to the existing Reading Community club system, so a
  -- book_club/learning_group org-group can BE a real library_clubs row
  -- (discussions/live events/etc.) rather than a shallow duplicate concept.
  linked_club_id   UUID REFERENCES public.library_clubs(id) ON DELETE SET NULL,
  created_by       UUID NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_groups_org ON public.organization_groups(organization_id, group_type);

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.organization_groups(id) ON DELETE SET NULL;

CREATE TRIGGER organization_groups_updated_at
  BEFORE UPDATE ON public.organization_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.organization_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_groups: member reads"
  ON public.organization_groups FOR SELECT
  USING (public.is_organization_member(organization_id));

CREATE POLICY "organization_groups: admin manages"
  ON public.organization_groups FOR ALL
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE TABLE IF NOT EXISTS public.organization_group_members (
  group_id   UUID NOT NULL REFERENCES public.organization_groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE public.organization_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_group_members: org member reads"
  ON public.organization_group_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.organization_groups g WHERE g.id = group_id AND public.is_organization_member(g.organization_id)));

CREATE POLICY "organization_group_members: org admin manages"
  ON public.organization_group_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_groups g WHERE g.id = group_id AND public.is_organization_admin(g.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_groups g WHERE g.id = group_id AND public.is_organization_admin(g.organization_id)));

-- ============================================================================
-- 4. GRANULAR PERMISSIONS — per-role permission matrix, configurable per org
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.organization_permission AS ENUM (
    'view', 'download', 'print', 'share', 'edit', 'publish', 'delete', 'approve', 'audit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organization_role_permissions (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role            public.organization_member_role NOT NULL,
  permission      public.organization_permission NOT NULL,
  PRIMARY KEY (organization_id, role, permission)
);

ALTER TABLE public.organization_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_role_permissions: member reads"
  ON public.organization_role_permissions FOR SELECT
  USING (public.is_organization_member(organization_id));

CREATE POLICY "organization_role_permissions: admin manages"
  ON public.organization_role_permissions FOR ALL
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

-- Seeds a sensible default permission matrix for a newly-created org so
-- admins don't start from a blank (all-denied) grid.
CREATE OR REPLACE FUNCTION public.trg_organization_seed_default_permissions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_role_permissions (organization_id, role, permission)
  SELECT NEW.id, r.role, p.permission
  FROM unnest(enum_range(NULL::public.organization_member_role)) AS r(role)
  CROSS JOIN unnest(enum_range(NULL::public.organization_permission)) AS p(permission)
  WHERE
    (r.role IN ('owner', 'admin') )
    OR (r.role = 'manager' AND p.permission IN ('view', 'download', 'print', 'share', 'edit', 'publish', 'approve'))
    OR (r.role IN ('teacher', 'researcher') AND p.permission IN ('view', 'download', 'print', 'share', 'edit'))
    OR (r.role IN ('student', 'employee') AND p.permission IN ('view', 'download'))
    OR (r.role = 'guest' AND p.permission = 'view')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_seed_permissions
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_organization_seed_default_permissions();

CREATE OR REPLACE FUNCTION public.organization_member_has_permission(_organization_id UUID, _permission public.organization_permission)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    JOIN public.organization_role_permissions p
      ON p.organization_id = m.organization_id AND p.role = m.role AND p.permission = _permission
    WHERE m.organization_id = _organization_id AND m.user_id = auth.uid() AND m.status = 'active'
  ) OR public.is_organization_admin(_organization_id)
$$;

GRANT EXECUTE ON FUNCTION public.organization_member_has_permission(UUID, public.organization_permission) TO authenticated;
