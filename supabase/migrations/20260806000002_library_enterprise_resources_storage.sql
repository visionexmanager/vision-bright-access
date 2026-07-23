-- ─── Library — Enterprise Platform: Private Libraries & Resources ─────────
-- Unlike every other Library storage bucket so far (all `public: true`,
-- gated only by "can you guess the URL" plus row RLS), organization
-- resources genuinely need a PRIVATE bucket — "Confidential Resources" and
-- "Policies"/"Employee Handbooks" must not be fetchable by a bare URL guess.
-- Storage RLS checks organization membership directly via the folder path
-- (`{organization_id}/...`), and downloads go through signed URLs.

-- ============================================================================
-- 1. ORGANIZATION RESOURCES
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.organization_resource_type AS ENUM (
    'collection', 'internal_document', 'training_manual', 'policy',
    'employee_handbook', 'course_library', 'confidential_resource'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organization_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_type   public.organization_resource_type NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  storage_path    TEXT,  -- path within the private organization-resources bucket
  book_id         UUID REFERENCES public.library_books(id) ON DELETE SET NULL,  -- course_library items can link an existing catalog book instead of uploading a file
  group_id        UUID REFERENCES public.organization_groups(id) ON DELETE SET NULL,  -- optional department/team-scoped visibility
  is_confidential BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (storage_path IS NOT NULL OR book_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_organization_resources_org ON public.organization_resources(organization_id, resource_type);

CREATE TRIGGER organization_resources_updated_at
  BEFORE UPDATE ON public.organization_resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.organization_resources ENABLE ROW LEVEL SECURITY;

-- Confidential resources and group-scoped resources are only visible to
-- members of that specific group (or org admins); everything else is
-- visible to any active org member with 'view' permission.
CREATE POLICY "organization_resources: scoped member reads"
  ON public.organization_resources FOR SELECT
  USING (
    public.is_organization_admin(organization_id)
    OR (
      public.organization_member_has_permission(organization_id, 'view')
      AND (NOT is_confidential OR EXISTS (
        SELECT 1 FROM public.organization_members m WHERE m.organization_id = organization_resources.organization_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin', 'manager')
      ))
      AND (group_id IS NULL OR EXISTS (SELECT 1 FROM public.organization_group_members gm WHERE gm.group_id = organization_resources.group_id AND gm.user_id = auth.uid()))
    )
  );

CREATE POLICY "organization_resources: permitted members manage"
  ON public.organization_resources FOR INSERT
  WITH CHECK (public.organization_member_has_permission(organization_id, 'publish') AND created_by = auth.uid());

CREATE POLICY "organization_resources: permitted members update"
  ON public.organization_resources FOR UPDATE
  USING (public.organization_member_has_permission(organization_id, 'edit'));

CREATE POLICY "organization_resources: permitted members delete"
  ON public.organization_resources FOR DELETE
  USING (public.organization_member_has_permission(organization_id, 'delete'));

-- ============================================================================
-- 2. PRIVATE STORAGE BUCKET
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-resources', 'organization-resources', false,
  104857600, -- 100 MB
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- Folder convention: {organization_id}/{resource_id}/{filename} — the first
-- path segment is the org id, checked directly against membership.
DO $$ BEGIN
  CREATE POLICY "organization_resources_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'organization-resources'
      AND public.organization_member_has_permission(((storage.foldername(name))[1])::uuid, 'publish')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "organization_resources_read"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'organization-resources'
      AND public.is_organization_member(((storage.foldername(name))[1])::uuid)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "organization_resources_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'organization-resources'
      AND public.organization_member_has_permission(((storage.foldername(name))[1])::uuid, 'delete')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 3. BULK INVITATIONS — tracks a CSV bulk-import batch of member invites
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.organization_invitation_status AS ENUM ('pending', 'accepted', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            public.organization_member_role NOT NULL DEFAULT 'guest',
  custom_role_label TEXT,
  department_id   UUID REFERENCES public.organization_groups(id) ON DELETE SET NULL,
  status          public.organization_invitation_status NOT NULL DEFAULT 'pending',
  invited_by      UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_invitations: admin manages"
  ON public.organization_invitations FOR ALL
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

-- Bulk-invite RPC: inserts an organization_invitations row + a matching
-- organization_members row in one call, per email — the edge function
-- driving CSV import calls this once per parsed row rather than building
-- raw INSERTs client-side (keeps the "who can invite" check server-side).
CREATE OR REPLACE FUNCTION public.bulk_invite_organization_member(
  _organization_id UUID, _email TEXT, _role public.organization_member_role DEFAULT 'guest',
  _custom_role_label TEXT DEFAULT NULL, _department_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invitation_id UUID;
  _existing_user_id UUID;
BEGIN
  IF NOT public.is_organization_admin(_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to invite members to this organization';
  END IF;

  INSERT INTO public.organization_invitations (organization_id, email, role, custom_role_label, department_id, invited_by)
  VALUES (_organization_id, _email, _role, _custom_role_label, _department_id, auth.uid())
  ON CONFLICT (organization_id, email) DO UPDATE SET role = EXCLUDED.role, custom_role_label = EXCLUDED.custom_role_label, department_id = EXCLUDED.department_id
  RETURNING id INTO _invitation_id;

  SELECT id INTO _existing_user_id FROM auth.users WHERE email = _email;

  IF _existing_user_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, custom_role_label, department_id, status, invited_email, invited_by, joined_at)
    VALUES (_organization_id, _existing_user_id, _role, _custom_role_label, _department_id, 'active', _email, auth.uid(), now())
    ON CONFLICT (organization_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;
  ELSE
    INSERT INTO public.organization_members (organization_id, user_id, role, custom_role_label, department_id, status, invited_email, invited_by)
    VALUES (_organization_id, NULL, _role, _custom_role_label, _department_id, 'invited', _email, auth.uid())
    ON CONFLICT (organization_id, invited_email) WHERE user_id IS NULL DO NOTHING;
  END IF;

  UPDATE public.organization_invitations SET status = CASE WHEN _existing_user_id IS NOT NULL THEN 'accepted' ELSE 'pending' END WHERE id = _invitation_id;

  RETURN _invitation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_invite_organization_member(UUID, TEXT, public.organization_member_role, TEXT, UUID) TO authenticated;

-- ============================================================================
-- 4. CALENDAR — widen library_events with an optional organization scope
-- ============================================================================

ALTER TABLE public.library_events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_library_events_organization ON public.library_events(organization_id) WHERE organization_id IS NOT NULL;

-- The existing SELECT policy's `club_id IS NULL` clause makes any
-- non-club event publicly readable — an org-hosted event (organization_id
-- set, club_id NULL) would otherwise be visible to everyone, not just org
-- members. Replace the policy so org-scoped events additionally require
-- organization membership, while every other existing case (public events,
-- club events, site admin) is unchanged.
DROP POLICY IF EXISTS "library_events: read public or member/admin" ON public.library_events;
CREATE POLICY "library_events: read public or member/admin"
  ON public.library_events FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_organization_member(organization_id))
    OR (organization_id IS NULL AND (club_id IS NULL OR public.is_library_club_member(club_id)))
    OR public.has_role(auth.uid(), 'admin')
  );

-- Likewise, the existing INSERT policy only checks host_id/club-moderator —
-- it never validated organization_id at all, so any signed-in user could
-- otherwise plant an event on an org's calendar they don't belong to.
-- Require organization-admin standing to attach an event to an org.
DROP POLICY IF EXISTS "library_events: host creates" ON public.library_events;
CREATE POLICY "library_events: host creates"
  ON public.library_events FOR INSERT
  WITH CHECK (
    auth.uid() = host_id
    AND (club_id IS NULL OR public.is_library_club_moderator(club_id))
    AND (organization_id IS NULL OR public.is_organization_admin(organization_id))
  );

-- Same reasoning applies to UPDATE: without an explicit WITH CHECK,
-- Postgres reuses the USING clause for the new row too, which never
-- constrained organization_id — a host could otherwise reassign their
-- event onto an org's calendar they don't belong to.
DROP POLICY IF EXISTS "library_events: host/moderator/admin updates" ON public.library_events;
CREATE POLICY "library_events: host/moderator/admin updates"
  ON public.library_events FOR UPDATE
  USING (
    auth.uid() = host_id
    OR public.has_role(auth.uid(), 'admin')
    OR (club_id IS NOT NULL AND public.is_library_club_moderator(club_id))
  )
  WITH CHECK (
    organization_id IS NULL OR public.is_organization_admin(organization_id) OR public.has_role(auth.uid(), 'admin')
  );
