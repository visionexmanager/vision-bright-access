// ─── Library — Enterprise Platform: Learning Management (Assignments) ─────

import { supabase } from "@/integrations/supabase/client";

export type OrganizationAssignmentType = "book" | "audiobook" | "course" | "reading_list" | "quiz" | "assignment";

export interface OrganizationAssignmentRow {
  id: string;
  organization_id: string;
  assignment_type: OrganizationAssignmentType;
  entity_id: string | null;
  title: string;
  description: string | null;
  assigned_to_user_id: string | null;
  assigned_to_group_id: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
}

export async function fetchOrganizationAssignments(orgId: string): Promise<OrganizationAssignmentRow[]> {
  const { data, error } = await supabase
    .from("organization_assignments").select("*").eq("organization_id", orgId).order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationAssignmentRow[];
}

export async function fetchMyAssignments(orgId: string, userId: string): Promise<OrganizationAssignmentRow[]> {
  const { data: groupIds } = await supabase.from("organization_group_members").select("group_id").eq("user_id", userId);
  const myGroupIds = (groupIds ?? []).map((g) => g.group_id);
  let query = supabase.from("organization_assignments").select("*").eq("organization_id", orgId);
  query = myGroupIds.length > 0
    ? query.or(`assigned_to_user_id.eq.${userId},assigned_to_group_id.in.(${myGroupIds.join(",")})`)
    : query.eq("assigned_to_user_id", userId);
  const { data, error } = await query.order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationAssignmentRow[];
}

export interface CreateAssignmentInput {
  assignmentType: OrganizationAssignmentType;
  entityId?: string;
  title: string;
  description?: string;
  assignedToUserId?: string;
  assignedToGroupId?: string;
  dueDate?: string;
}

export async function createOrganizationAssignment(orgId: string, createdBy: string, input: CreateAssignmentInput): Promise<OrganizationAssignmentRow> {
  const { data, error } = await supabase
    .from("organization_assignments")
    .insert({
      organization_id: orgId, assignment_type: input.assignmentType, entity_id: input.entityId ?? null,
      title: input.title, description: input.description || null,
      assigned_to_user_id: input.assignedToUserId ?? null, assigned_to_group_id: input.assignedToGroupId ?? null,
      due_date: input.dueDate ?? null, created_by: createdBy,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as OrganizationAssignmentRow;
}

export async function deleteOrganizationAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase.from("organization_assignments").delete().eq("id", assignmentId);
  if (error) throw new Error(error.message);
}

export interface AssignmentCompletionRow {
  assignment_id: string;
  user_id: string;
  completed_at: string;
  score_percent: number | null;
  display_name: string | null;
}

export async function fetchAssignmentCompletions(assignmentId: string): Promise<AssignmentCompletionRow[]> {
  const { data: completions, error } = await supabase
    .from("organization_assignment_completions").select("*").eq("assignment_id", assignmentId);
  if (error) throw new Error(error.message);
  const userIds = (completions ?? []).map((c) => c.user_id);
  if (userIds.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
  return (completions ?? []).map((c) => ({ ...c, display_name: nameById.get(c.user_id) ?? null })) as AssignmentCompletionRow[];
}

export async function markAssignmentComplete(assignmentId: string, userId: string, scorePercent?: number): Promise<void> {
  const { error } = await supabase
    .from("organization_assignment_completions")
    .upsert({ assignment_id: assignmentId, user_id: userId, score_percent: scorePercent ?? null }, { onConflict: "assignment_id,user_id" });
  if (error) throw new Error(error.message);
}

export async function issueAssignmentCertificate(assignmentId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("library-issue-certificate", {
    body: { certificate_type: "organization_assignment", reference_id: assignmentId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}
