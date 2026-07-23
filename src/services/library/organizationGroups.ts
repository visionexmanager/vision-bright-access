// ─── Library — Enterprise Platform: Groups (departments/classes/teams/etc.) ─

import { supabase } from "@/integrations/supabase/client";

export type OrganizationGroupType = "department" | "class" | "team" | "project" | "research_group" | "book_club" | "learning_group";

export interface OrganizationGroupRow {
  id: string;
  organization_id: string;
  group_type: OrganizationGroupType;
  name: string;
  description: string | null;
  parent_group_id: string | null;
  linked_club_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function fetchOrganizationGroups(orgId: string): Promise<OrganizationGroupRow[]> {
  const { data, error } = await supabase
    .from("organization_groups").select("*").eq("organization_id", orgId).order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationGroupRow[];
}

export interface CreateGroupInput {
  groupType: OrganizationGroupType;
  name: string;
  description?: string;
  parentGroupId?: string;
}

export async function createOrganizationGroup(orgId: string, createdBy: string, input: CreateGroupInput): Promise<OrganizationGroupRow> {
  const { data, error } = await supabase
    .from("organization_groups")
    .insert({
      organization_id: orgId, group_type: input.groupType, name: input.name,
      description: input.description || null, parent_group_id: input.parentGroupId || null, created_by: createdBy,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as OrganizationGroupRow;
}

export async function updateOrganizationGroup(groupId: string, patch: Partial<CreateGroupInput>): Promise<void> {
  const { error } = await supabase.from("organization_groups").update({
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.parentGroupId !== undefined && { parent_group_id: patch.parentGroupId }),
  }).eq("id", groupId);
  if (error) throw new Error(error.message);
}

export async function deleteOrganizationGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from("organization_groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message);
}

export interface OrganizationGroupMemberRow {
  group_id: string;
  user_id: string;
  role: "lead" | "member";
  joined_at: string;
  display_name: string | null;
}

export async function fetchGroupMembers(groupId: string): Promise<OrganizationGroupMemberRow[]> {
  const { data: rows, error } = await supabase.from("organization_group_members").select("*").eq("group_id", groupId);
  if (error) throw new Error(error.message);
  const userIds = (rows ?? []).map((r) => r.user_id);
  if (userIds.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
  return (rows ?? []).map((r) => ({ ...r, display_name: nameById.get(r.user_id) ?? null })) as OrganizationGroupMemberRow[];
}

export async function addGroupMember(groupId: string, userId: string, role: "lead" | "member" = "member"): Promise<void> {
  const { error } = await supabase.from("organization_group_members").insert({ group_id: groupId, user_id: userId, role });
  if (error) throw new Error(error.message);
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("organization_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
