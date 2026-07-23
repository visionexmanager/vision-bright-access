// ─── Library — Enterprise Platform: Analytics ──────────────────────────────
// Deterministic SQL RPCs (get_organization_*), not an edge function — no LLM
// call is needed for real aggregates, matching this app's established
// precedent (get_library_trending_topics, get_library_reading_coach_stats).
// All RPCs are admin-only server-side (see the migration).

import { supabase } from "@/integrations/supabase/client";

export interface OrganizationReadingStats {
  total_reading_hours: number;
  total_books_completed: number;
  active_member_count: number;
  avg_completion_rate: number;
}

export async function fetchOrganizationReadingStats(orgId: string): Promise<OrganizationReadingStats | null> {
  const { data, error } = await supabase.rpc("get_organization_reading_stats", { _organization_id: orgId });
  if (error) throw new Error(error.message);
  return (data ?? [])[0] ?? null;
}

export interface OrganizationPopularBook {
  book_id: string;
  title: string;
  reader_count: number;
}

export async function fetchOrganizationPopularBooks(orgId: string, limit = 10): Promise<OrganizationPopularBook[]> {
  const { data, error } = await supabase.rpc("get_organization_popular_books", { _organization_id: orgId, _limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationPopularBook[];
}

export interface OrganizationDepartmentActivity {
  department_id: string;
  department_name: string;
  member_count: number;
  total_reading_minutes: number;
}

export async function fetchOrganizationDepartmentActivity(orgId: string): Promise<OrganizationDepartmentActivity[]> {
  const { data, error } = await supabase.rpc("get_organization_department_activity", { _organization_id: orgId });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationDepartmentActivity[];
}

export interface OrganizationMemberEngagement {
  user_id: string;
  books_completed: number;
  reading_minutes: number;
  assignments_completed: number;
  last_active_at: string | null;
  display_name?: string | null;
}

export async function fetchOrganizationMemberEngagement(orgId: string, limit = 50): Promise<OrganizationMemberEngagement[]> {
  const { data, error } = await supabase.rpc("get_organization_member_engagement", { _organization_id: orgId, _limit: limit });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as OrganizationMemberEngagement[];
  const userIds = rows.map((r) => r.user_id);
  if (userIds.length === 0) return rows;
  const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
  return rows.map((r) => ({ ...r, display_name: nameById.get(r.user_id) ?? null }));
}

export interface OrganizationTrainingCompletion {
  assignment_id: string;
  title: string;
  assignment_type: string;
  assigned_count: number;
  completed_count: number;
}

export async function fetchOrganizationTrainingCompletion(orgId: string): Promise<OrganizationTrainingCompletion[]> {
  const { data, error } = await supabase.rpc("get_organization_training_completion", { _organization_id: orgId });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationTrainingCompletion[];
}

export async function fetchOrganizationCertificatesEarned(orgId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_organization_certificates_earned", { _organization_id: orgId });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}
