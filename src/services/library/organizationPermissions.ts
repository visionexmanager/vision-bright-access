// ─── Library — Enterprise Platform: Granular Permissions ───────────────────

import { supabase } from "@/integrations/supabase/client";
import type { OrganizationMemberRole } from "@/services/library/organizations";

export type OrganizationPermission = "view" | "download" | "print" | "share" | "edit" | "publish" | "delete" | "approve" | "audit";

export const ORGANIZATION_PERMISSIONS: OrganizationPermission[] = [
  "view", "download", "print", "share", "edit", "publish", "delete", "approve", "audit",
];

export const ORGANIZATION_ROLES: OrganizationMemberRole[] = [
  "owner", "admin", "manager", "teacher", "student", "employee", "researcher", "guest", "custom",
];

export interface OrganizationRolePermissionRow {
  organization_id: string;
  role: OrganizationMemberRole;
  permission: OrganizationPermission;
}

export async function fetchRolePermissions(orgId: string): Promise<OrganizationRolePermissionRow[]> {
  const { data, error } = await supabase.from("organization_role_permissions").select("*").eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationRolePermissionRow[];
}

export async function grantRolePermission(orgId: string, role: OrganizationMemberRole, permission: OrganizationPermission): Promise<void> {
  const { error } = await supabase.from("organization_role_permissions").insert({ organization_id: orgId, role, permission });
  if (error) throw new Error(error.message);
  await supabase.rpc("log_library_audit_event", { _action: "organization_permission_granted", _entity_type: "organization", _entity_id: orgId, _metadata: { role, permission } });
}

export async function revokeRolePermission(orgId: string, role: OrganizationMemberRole, permission: OrganizationPermission): Promise<void> {
  const { error } = await supabase.from("organization_role_permissions").delete().eq("organization_id", orgId).eq("role", role).eq("permission", permission);
  if (error) throw new Error(error.message);
  await supabase.rpc("log_library_audit_event", { _action: "organization_permission_revoked", _entity_type: "organization", _entity_id: orgId, _metadata: { role, permission } });
}
