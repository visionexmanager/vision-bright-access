-- VisionEx Career Center — security hardening (Phase 11).
-- Additive only: extends the existing career_role/has_career_role RBAC
-- (20260705020000_career_center_roles.sql) with fine-grained permissions,
-- plus audit logging, device tracking, and brute-force primitives. Nothing
-- here is wired into a login flow automatically — Career Center has no
-- custom login endpoint (auth goes through Supabase Auth directly from the
-- frontend), so these are ready-to-adopt building blocks for whichever
-- future endpoint needs them, not retrofitted into existing code.

-- ── Fine-grained permissions (layered on top of career_role) ────────────
CREATE TABLE public.career_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permission catalog is publicly viewable"
  ON public.career_permissions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage the permission catalog"
  ON public.career_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.career_role_permissions (
  role public.career_role NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.career_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

ALTER TABLE public.career_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role-permission mapping is publicly viewable"
  ON public.career_role_permissions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage role-permission mapping"
  ON public.career_role_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Mirrors the has_career_role() convention: SECURITY DEFINER + STABLE so it
-- can be used inside RLS policies without a recursive-permission check.
CREATE OR REPLACE FUNCTION public.has_career_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.career_user_roles cur
    JOIN public.career_role_permissions crp ON crp.role = cur.role
    JOIN public.career_permissions cp ON cp.id = crp.permission_id
    WHERE cur.user_id = _user_id AND cp.key = _permission_key
  );
$$;

-- Seed a starter catalog — additive, safe to extend later without a new migration.
INSERT INTO public.career_permissions (key, description) VALUES
  ('jobs.delete', 'Delete a job posting'),
  ('candidates.export', 'Export candidate data'),
  ('billing.manage', 'Manage subscription and payment details'),
  ('team.manage', 'Invite/remove team members on a company account');

INSERT INTO public.career_role_permissions (role, permission_id)
SELECT 'employer', id FROM public.career_permissions
WHERE key IN ('jobs.delete', 'candidates.export', 'billing.manage', 'team.manage');

-- ── Per-user security settings ───────────────────────────────────────────
CREATE TABLE public.career_security_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mfa_enforced boolean NOT NULL DEFAULT false,
  session_timeout_minutes integer NOT NULL DEFAULT 1440,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their own security settings"
  ON public.career_security_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all security settings"
  ON public.career_security_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_career_security_settings_updated_at BEFORE UPDATE ON public.career_security_settings
  FOR EACH ROW EXECUTE FUNCTION public.career_set_updated_at();

-- ── Security event audit log ─────────────────────────────────────────────
-- login / failed_login / password_change / mfa_enabled / new_device /
-- permission_denied / suspicious_activity, etc. IP is stored hashed, never
-- raw, so this table can't itself become a PII liability.
CREATE TABLE public.career_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip_hash text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own security events"
  ON public.career_security_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all security events"
  ON public.career_security_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Any request can record a security event for its own user"
  ON public.career_security_events FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE INDEX idx_career_security_events_user ON public.career_security_events(user_id);
CREATE INDEX idx_career_security_events_type ON public.career_security_events(event_type);
CREATE INDEX idx_career_security_events_created_at ON public.career_security_events(created_at DESC);

CREATE OR REPLACE FUNCTION public.log_career_security_event(
  _user_id uuid,
  _event_type text,
  _ip_hash text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.career_security_events (user_id, event_type, ip_hash, user_agent, metadata)
  VALUES (_user_id, _event_type, _ip_hash, _user_agent, _metadata)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- ── Known device tracking ────────────────────────────────────────────────
CREATE TABLE public.career_known_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  user_agent text,
  ip_hash text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_fingerprint)
);

ALTER TABLE public.career_known_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their own known devices"
  ON public.career_known_devices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all known devices"
  ON public.career_known_devices FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_career_known_devices_user ON public.career_known_devices(user_id);

-- ── Brute-force protection primitives ────────────────────────────────────
-- Backend-only (no client policies — same locked-by-default pattern as
-- ai_response_cache/queue_jobs): only a service-role Edge Function can
-- read or write attempt history.
CREATE TABLE public.career_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  success boolean NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_career_login_attempts_identifier ON public.career_login_attempts(identifier, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_career_login_attempt(_identifier text, _success boolean, _ip_hash text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.career_login_attempts (identifier, success, ip_hash)
  VALUES (_identifier, _success, _ip_hash);
END;
$$;

-- Blocks after 5 failed attempts for the same identifier within 15 minutes.
CREATE OR REPLACE FUNCTION public.is_career_login_blocked(_identifier text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) >= 5
  FROM public.career_login_attempts
  WHERE identifier = _identifier
    AND success = false
    AND created_at > now() - interval '15 minutes';
$$;
