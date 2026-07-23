// ─── Library — Enterprise & Organization Platform: Organizations ──────────

import { supabase } from "@/integrations/supabase/client";

export type OrganizationType =
  | "school" | "university" | "training_center" | "company" | "government"
  | "ngo" | "public_library" | "private_library" | "research_center" | "medical_institution";

export type OrganizationMemberRole =
  | "owner" | "admin" | "manager" | "teacher" | "student" | "employee" | "researcher" | "guest" | "custom";

export type OrganizationMemberStatus = "invited" | "active" | "suspended";

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  org_type: OrganizationType;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  owner_id: string;
  member_count: number;
  is_active: boolean;
  sso_domain: string | null;
  sso_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchMyOrganizations(userId: string): Promise<OrganizationRow[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*, organization_members!inner(user_id)")
    .eq("organization_members.user_id", userId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OrganizationRow[];
}

export async function fetchOrganization(orgId: string): Promise<OrganizationRow | null> {
  const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as OrganizationRow | null;
}

export async function fetchOrganizationBySlug(slug: string): Promise<OrganizationRow | null> {
  const { data, error } = await supabase.from("organizations").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data as OrganizationRow | null;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  orgType: OrganizationType;
  description?: string;
  website?: string;
}

export async function createOrganization(ownerId: string, input: CreateOrganizationInput): Promise<OrganizationRow> {
  const { data, error } = await supabase
    .from("organizations")
    .insert({ owner_id: ownerId, name: input.name, slug: input.slug, org_type: input.orgType, description: input.description || null, website: input.website || null })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as OrganizationRow;
}

export async function updateOrganization(orgId: string, patch: Partial<CreateOrganizationInput & { logoUrl: string; isActive: boolean }>): Promise<void> {
  const { error } = await supabase.from("organizations").update({
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.website !== undefined && { website: patch.website }),
    ...(patch.logoUrl !== undefined && { logo_url: patch.logoUrl }),
    ...(patch.isActive !== undefined && { is_active: patch.isActive }),
  }).eq("id", orgId);
  if (error) throw new Error(error.message);
}

export interface OrganizationMemberRow {
  organization_id: string;
  user_id: string | null;
  role: OrganizationMemberRole;
  custom_role_label: string | null;
  department_id: string | null;
  status: OrganizationMemberStatus;
  invited_email: string | null;
  joined_at: string | null;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

// organization_members.user_id FKs auth.users, not public.profiles (sibling
// table) — fetch + merge, same technique as the Research Workspace's member list.
export async function fetchOrganizationMembers(orgId: string): Promise<OrganizationMemberRow[]> {
  const { data: members, error } = await supabase
    .from("organization_members").select("*").eq("organization_id", orgId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const userIds = (members ?? []).map((m) => m.user_id).filter((id): id is string => !!id);
  const profileById = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
    for (const p of profiles ?? []) profileById.set(p.user_id, p);
  }
  return (members ?? []).map((m) => ({
    ...m,
    display_name: m.user_id ? profileById.get(m.user_id)?.display_name ?? null : null,
    avatar_url: m.user_id ? profileById.get(m.user_id)?.avatar_url ?? null : null,
  })) as OrganizationMemberRow[];
}

export async function inviteOrganizationMember(
  orgId: string, email: string, role: OrganizationMemberRole, customRoleLabel?: string, departmentId?: string
): Promise<void> {
  const { error } = await supabase.rpc("bulk_invite_organization_member", {
    _organization_id: orgId, _email: email, _role: role,
    _custom_role_label: customRoleLabel ?? null, _department_id: departmentId ?? null,
  });
  if (error) throw new Error(error.message);
}

// A signed-in user accepting their own pending invite — routes through
// claim_organization_invite() (SECURITY DEFINER) rather than a raw
// organization_members update, since the RPC hardcodes exactly which
// columns change (user_id/status only, never role) so an invited member
// can never grant themselves elevated permissions while claiming a seat.
export async function claimOrganizationInvite(orgId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_organization_invite", { _organization_id: orgId });
  if (error) throw new Error(error.message);
  return data as boolean;
}

export interface BulkInviteResult {
  email: string;
  ok: boolean;
  error?: string;
}

export async function bulkInviteOrganizationMembers(
  orgId: string, rows: { email: string; role: OrganizationMemberRole; customRoleLabel?: string }[]
): Promise<BulkInviteResult[]> {
  const results: BulkInviteResult[] = [];
  for (const row of rows) {
    try {
      await inviteOrganizationMember(orgId, row.email, row.role, row.customRoleLabel);
      results.push({ email: row.email, ok: true });
    } catch (err) {
      results.push({ email: row.email, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

export async function updateOrganizationMember(orgId: string, userId: string, patch: { role?: OrganizationMemberRole; customRoleLabel?: string; status?: OrganizationMemberStatus; departmentId?: string | null }): Promise<void> {
  const { error } = await supabase.from("organization_members").update({
    ...(patch.role !== undefined && { role: patch.role }),
    ...(patch.customRoleLabel !== undefined && { custom_role_label: patch.customRoleLabel }),
    ...(patch.status !== undefined && { status: patch.status }),
    ...(patch.departmentId !== undefined && { department_id: patch.departmentId }),
  }).eq("organization_id", orgId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (patch.role !== undefined) {
    await supabase.rpc("log_library_audit_event", { _action: "organization_member_role_changed", _entity_type: "organization", _entity_id: orgId, _metadata: { user_id: userId, new_role: patch.role } });
  }
}

export async function removeOrganizationMember(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("organization_members").delete().eq("organization_id", orgId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  await supabase.rpc("log_library_audit_event", { _action: "organization_member_removed", _entity_type: "organization", _entity_id: orgId, _metadata: { user_id: userId } });
}

export function exportMembersToCsv(members: OrganizationMemberRow[]): string {
  const header = ["email", "display_name", "role", "custom_role_label", "status", "joined_at"];
  const rows = members.map((m) => [
    m.invited_email ?? "", m.display_name ?? "", m.role, m.custom_role_label ?? "", m.status, m.joined_at ?? "",
  ]);
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export function parseMembersCsv(csvText: string): { email: string; role: OrganizationMemberRole; customRoleLabel?: string }[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const emailIdx = header.indexOf("email");
  const roleIdx = header.indexOf("role");
  const labelIdx = header.indexOf("custom_role_label");
  if (emailIdx === -1) throw new Error("CSV must have an 'email' column");

  const validRoles: OrganizationMemberRole[] = ["owner", "admin", "manager", "teacher", "student", "employee", "researcher", "guest", "custom"];
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const email = cols[emailIdx];
    const roleRaw = roleIdx !== -1 ? cols[roleIdx]?.toLowerCase() : "guest";
    const role: OrganizationMemberRole = validRoles.includes(roleRaw as OrganizationMemberRole) ? (roleRaw as OrganizationMemberRole) : "guest";
    return { email, role, customRoleLabel: labelIdx !== -1 ? cols[labelIdx] : undefined };
  }).filter((r) => r.email);
}
