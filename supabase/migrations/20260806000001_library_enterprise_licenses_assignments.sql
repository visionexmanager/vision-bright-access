-- ─── Library — Enterprise Platform: Licenses, Sessions, Assignments ────────
-- Organization-scoped licensing is a genuinely different shape from the
-- existing book-scoped library_licenses (Marketplace phase, purchaser_id +
-- book_id) — an org license is about "how many of our members can use the
-- platform," not "how many people may read this one book." A new table,
-- not an ALTER of the existing one, keeps the two concepts honest.

-- ============================================================================
-- 1. ORGANIZATION LICENSES
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.organization_license_type AS ENUM (
    'seat', 'concurrent', 'subscription', 'time_limited', 'department', 'educational', 'corporate'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organization_licenses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  license_type     public.organization_license_type NOT NULL,
  seat_count       INTEGER CHECK (seat_count IS NULL OR seat_count > 0),
  concurrent_limit INTEGER CHECK (concurrent_limit IS NULL OR concurrent_limit > 0),
  department_id    UUID REFERENCES public.organization_groups(id) ON DELETE SET NULL,
  starts_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_licenses_org ON public.organization_licenses(organization_id, is_active);

ALTER TABLE public.organization_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_licenses: member reads"
  ON public.organization_licenses FOR SELECT
  USING (public.is_organization_member(organization_id));

CREATE POLICY "organization_licenses: admin manages"
  ON public.organization_licenses FOR ALL
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE TABLE IF NOT EXISTS public.organization_license_assignments (
  license_id  UUID NOT NULL REFERENCES public.organization_licenses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (license_id, user_id)
);

ALTER TABLE public.organization_license_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_license_assignments: member reads own org"
  ON public.organization_license_assignments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.organization_licenses l WHERE l.id = license_id AND public.is_organization_member(l.organization_id)));

CREATE POLICY "organization_license_assignments: admin manages"
  ON public.organization_license_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_licenses l WHERE l.id = license_id AND public.is_organization_admin(l.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_licenses l WHERE l.id = license_id AND public.is_organization_admin(l.organization_id)));

CREATE OR REPLACE FUNCTION public.get_organization_seat_usage(_organization_id UUID)
RETURNS TABLE (license_id UUID, license_type public.organization_license_type, seat_count INTEGER, seats_used BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.license_type, l.seat_count, count(a.user_id)
  FROM public.organization_licenses l
  LEFT JOIN public.organization_license_assignments a ON a.license_id = l.id
  WHERE l.organization_id = _organization_id AND l.is_active = true
  GROUP BY l.id, l.license_type, l.seat_count
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_seat_usage(UUID) TO authenticated;

-- ============================================================================
-- 2. SESSIONS — concurrent-user tracking + admin session management
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organization_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS idx_organization_sessions_org_active ON public.organization_sessions(organization_id, last_seen_at) WHERE ended_at IS NULL;

ALTER TABLE public.organization_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_sessions: admin reads"
  ON public.organization_sessions FOR SELECT
  USING (public.is_organization_admin(organization_id) OR user_id = auth.uid());

CREATE POLICY "organization_sessions: user manages own"
  ON public.organization_sessions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Heartbeat RPC — a client with an active org session calls this every few
-- minutes; "concurrent users" = sessions with a recent heartbeat and no
-- ended_at.
CREATE OR REPLACE FUNCTION public.touch_organization_session(_organization_id UUID, _user_agent TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _session_id UUID;
  _last_seen_at TIMESTAMPTZ;
BEGIN
  IF NOT public.is_organization_member(_organization_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  SELECT id, last_seen_at INTO _session_id, _last_seen_at FROM public.organization_sessions
  WHERE organization_id = _organization_id AND user_id = auth.uid() AND ended_at IS NULL
  ORDER BY last_seen_at DESC LIMIT 1;

  IF _session_id IS NOT NULL AND _last_seen_at > now() - INTERVAL '10 minutes' THEN
    UPDATE public.organization_sessions SET last_seen_at = now() WHERE id = _session_id;
    RETURN _session_id;
  END IF;

  INSERT INTO public.organization_sessions (organization_id, user_id, user_agent)
  VALUES (_organization_id, auth.uid(), _user_agent)
  RETURNING id INTO _session_id;
  RETURN _session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_organization_session(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_organization_concurrent_count(_organization_id UUID)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM public.organization_sessions
  WHERE organization_id = _organization_id AND ended_at IS NULL AND last_seen_at > now() - INTERVAL '5 minutes'
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_concurrent_count(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.end_organization_session(_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_sessions s
    WHERE s.id = _session_id AND (s.user_id = auth.uid() OR public.is_organization_admin(s.organization_id))
  ) THEN
    RAISE EXCEPTION 'Not authorized to end this session';
  END IF;
  UPDATE public.organization_sessions SET ended_at = now() WHERE id = _session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_organization_session(UUID) TO authenticated;

-- ============================================================================
-- 3. LEARNING MANAGEMENT — ASSIGNMENTS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.organization_assignment_type AS ENUM (
    'book', 'audiobook', 'course', 'reading_list', 'quiz', 'assignment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organization_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assignment_type     public.organization_assignment_type NOT NULL,
  entity_id           UUID,  -- polymorphic: book/audiobook/course/reading_list/quiz id; NULL for a freeform 'assignment'
  title               TEXT NOT NULL,
  description         TEXT,
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to_group_id UUID REFERENCES public.organization_groups(id) ON DELETE CASCADE,
  due_date            TIMESTAMPTZ,
  created_by          UUID NOT NULL REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (assigned_to_user_id IS NOT NULL OR assigned_to_group_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_organization_assignments_org ON public.organization_assignments(organization_id, due_date);
CREATE INDEX IF NOT EXISTS idx_organization_assignments_user ON public.organization_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_organization_assignments_group ON public.organization_assignments(assigned_to_group_id);

ALTER TABLE public.organization_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_assignments: member reads own org"
  ON public.organization_assignments FOR SELECT
  USING (public.is_organization_member(organization_id));

CREATE POLICY "organization_assignments: admin manages"
  ON public.organization_assignments FOR ALL
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE TABLE IF NOT EXISTS public.organization_assignment_completions (
  assignment_id UUID NOT NULL REFERENCES public.organization_assignments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  score_percent NUMERIC,
  PRIMARY KEY (assignment_id, user_id)
);

ALTER TABLE public.organization_assignment_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_assignment_completions: user manages own"
  ON public.organization_assignment_completions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "organization_assignment_completions: admin reads all in org"
  ON public.organization_assignment_completions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.organization_assignments a
    WHERE a.id = assignment_id AND public.is_organization_admin(a.organization_id)
  ));

-- Widen library_certificates so an org-assigned course/quiz completion can
-- issue a real certificate through the existing library-issue-certificate
-- function, instead of a parallel certificate concept.
ALTER TABLE public.library_certificates DROP CONSTRAINT IF EXISTS library_certificates_certificate_type_check;
ALTER TABLE public.library_certificates ADD CONSTRAINT library_certificates_certificate_type_check
  CHECK (certificate_type IN ('learning_path', 'course', 'exam', 'reading_challenge', 'skill_mastery', 'organization_assignment'));
