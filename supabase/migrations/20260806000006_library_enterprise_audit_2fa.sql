-- ─── Library — Enterprise Platform: Audit Log Access + 2FA Support ─────────
-- audit_logs' existing SELECT policy is gated to the site-wide `admin` role
-- only (public.has_role) — an organization admin who is NOT also a
-- platform-wide admin could never read their own org's audit trail. RLS
-- policies are OR'd together, so this ADDS a second, additive read path
-- rather than touching the existing site-admin policy.

CREATE POLICY "audit_logs: organization admin reads own org entries"
  ON public.audit_logs FOR SELECT
  USING (entity_type = 'organization' AND entity_id IS NOT NULL AND public.is_organization_admin(entity_id));

-- Two-Factor Authentication uses Supabase Auth's real built-in MFA (TOTP)
-- API (supabase.auth.mfa.enroll/challenge/verify/unenroll) directly from the
-- client — no new table needed, Supabase manages factors internally. This
-- table only tracks which organizations REQUIRE members to have 2FA
-- enabled, for the Security settings UI to enforce/display.
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN NOT NULL DEFAULT false;
