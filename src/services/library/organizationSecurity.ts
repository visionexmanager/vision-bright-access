// ─── Library — Enterprise Platform: Security ───────────────────────────────
// Audit log (reuses the app-wide audit_logs table, widened with an
// organization-admin read policy — see the migration). Two-Factor
// Authentication uses Supabase Auth's REAL built-in MFA API directly
// (supabase.auth.mfa.*) — Supabase manages factors/challenges itself, no
// custom table needed. SSO is NOT implemented here: real SAML/OIDC
// federation requires enabling Supabase's SSO feature (a paid-tier,
// dashboard-configured feature) — organizations.sso_enabled/sso_domain are
// just a config surface for that future step, disclosed plainly in the UI,
// not a working integration.

import { supabase } from "@/integrations/supabase/client";

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_display_name?: string | null;
}

export async function fetchOrganizationAuditLog(orgId: string, limit = 100): Promise<AuditLogRow[]> {
  const { data: rows, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_type", "organization")
    .eq("entity_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_id).filter((id): id is string => !!id))];
  if (actorIds.length === 0) return (rows ?? []) as AuditLogRow[];
  const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", actorIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
  return (rows ?? []).map((r) => ({ ...r, actor_display_name: r.actor_id ? nameById.get(r.actor_id) ?? null : null })) as AuditLogRow[];
}

export async function setOrganizationRequire2fa(orgId: string, require2fa: boolean): Promise<void> {
  const { error } = await supabase.from("organizations").update({ require_2fa: require2fa }).eq("id", orgId);
  if (error) throw new Error(error.message);
}

// ── Real Supabase Auth MFA (TOTP) ──────────────────────────────────────────

export interface MfaFactor {
  id: string;
  factor_type: string;
  status: string;
}

export async function listMfaFactors(): Promise<MfaFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  return (data?.totp ?? []) as MfaFactor[];
}

export interface MfaEnrollResult {
  factorId: string;
  qrCode: string;
  secret: string;
}

export async function enrollMfa(): Promise<MfaEnrollResult> {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error) throw new Error(error.message);
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyMfaEnrollment(factorId: string, code: string): Promise<void> {
  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeErr) throw new Error(challengeErr.message);
  const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (verifyErr) throw new Error(verifyErr.message);
}

export async function unenrollMfa(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message);
}
