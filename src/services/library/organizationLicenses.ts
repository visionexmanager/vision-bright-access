// ─── Library — Enterprise Platform: License Management ────────────────────

import { supabase } from "@/integrations/supabase/client";

export type OrganizationLicenseType = "seat" | "concurrent" | "subscription" | "time_limited" | "department" | "educational" | "corporate";

export interface OrganizationLicenseRow {
  id: string;
  organization_id: string;
  license_type: OrganizationLicenseType;
  seat_count: number | null;
  concurrent_limit: number | null;
  department_id: string | null;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export async function fetchOrganizationLicenses(orgId: string): Promise<OrganizationLicenseRow[]> {
  const { data, error } = await supabase
    .from("organization_licenses").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationLicenseRow[];
}

export interface CreateLicenseInput {
  licenseType: OrganizationLicenseType;
  seatCount?: number;
  concurrentLimit?: number;
  departmentId?: string;
  expiresAt?: string;
}

export async function createOrganizationLicense(orgId: string, input: CreateLicenseInput): Promise<OrganizationLicenseRow> {
  const { data, error } = await supabase
    .from("organization_licenses")
    .insert({
      organization_id: orgId, license_type: input.licenseType, seat_count: input.seatCount ?? null,
      concurrent_limit: input.concurrentLimit ?? null, department_id: input.departmentId ?? null, expires_at: input.expiresAt ?? null,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as OrganizationLicenseRow;
}

export async function deactivateOrganizationLicense(licenseId: string): Promise<void> {
  const { error } = await supabase.from("organization_licenses").update({ is_active: false }).eq("id", licenseId);
  if (error) throw new Error(error.message);
}

export interface SeatUsageRow {
  license_id: string;
  license_type: OrganizationLicenseType;
  seat_count: number | null;
  seats_used: number;
}

export async function fetchSeatUsage(orgId: string): Promise<SeatUsageRow[]> {
  const { data, error } = await supabase.rpc("get_organization_seat_usage", { _organization_id: orgId });
  if (error) throw new Error(error.message);
  return (data ?? []) as SeatUsageRow[];
}

export async function assignLicenseSeat(licenseId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("organization_license_assignments").insert({ license_id: licenseId, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function revokeLicenseSeat(licenseId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("organization_license_assignments").delete().eq("license_id", licenseId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function fetchConcurrentUserCount(orgId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_organization_concurrent_count", { _organization_id: orgId });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function touchOrganizationSession(orgId: string): Promise<string> {
  const { data, error } = await supabase.rpc("touch_organization_session", { _organization_id: orgId, _user_agent: navigator.userAgent });
  if (error) throw new Error(error.message);
  return data as string;
}

export interface OrganizationSessionRow {
  id: string;
  organization_id: string;
  user_id: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  user_agent: string | null;
  display_name: string | null;
}

export async function fetchActiveSessions(orgId: string): Promise<OrganizationSessionRow[]> {
  const { data: sessions, error } = await supabase
    .from("organization_sessions").select("*").eq("organization_id", orgId).is("ended_at", null).order("last_seen_at", { ascending: false });
  if (error) throw new Error(error.message);
  const userIds = [...new Set((sessions ?? []).map((s) => s.user_id))];
  if (userIds.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
  return (sessions ?? []).map((s) => ({ ...s, display_name: nameById.get(s.user_id) ?? null })) as OrganizationSessionRow[];
}

export async function endOrganizationSession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("end_organization_session", { _session_id: sessionId });
  if (error) throw new Error(error.message);
}
