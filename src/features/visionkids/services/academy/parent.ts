import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { ParentChildLink } from "@/features/visionkids/types/academy.types";
import type { KidsFamily } from "@/features/visionkids/types/social.types";

/** Get-or-create the calling parent's family row (Phase 7 — Family
 *  Accounts). Safe to call repeatedly; idempotent server-side. */
export async function ensureMyFamily(): Promise<string> {
  const { data, error } = await kidsDb.rpc("ensure_kids_family");
  if (error) throw error;
  return data as string;
}

export async function fetchMyFamily(): Promise<KidsFamily | null> {
  const { data: authData } = await kidsDb.auth.getUser();
  const myId = authData.user?.id;
  if (!myId) return null;
  const { data, error } = await kidsDb.from("kids_families").select("*").eq("parent_user_id", myId).maybeSingle().returns<KidsFamily>();
  if (error) throw error;
  return data ?? null;
}

export async function renameMyFamily(familyName: string): Promise<void> {
  const { data: authData } = await kidsDb.auth.getUser();
  const myId = authData.user?.id;
  if (!myId) throw new Error("Must be signed in");
  const { error } = await kidsDb.from("kids_families").update({ family_name: familyName }).eq("parent_user_id", myId);
  if (error) throw error;
}

export async function generateParentLinkCode(): Promise<string> {
  const { data, error } = await kidsDb.rpc("generate_kids_parent_link_code");
  if (error) throw error;
  return data as string;
}

export async function redeemParentLinkCode(code: string): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("redeem_kids_parent_link_code", { _code: code });
  if (error) throw error;
  return !!data;
}

export async function fetchMyChildren(): Promise<ParentChildLink[]> {
  const { data, error } = await kidsDb.from("kids_parent_child_links").select("*").returns<ParentChildLink[]>();
  if (error) throw error;
  return data ?? [];
}

/** Same table, child's-eye view — RLS already scopes rows to ones where
 *  the caller is either parent_user_id or child_user_id, so a non-empty
 *  result here just means "I have at least one parent linked". Used by
 *  the Creative Studio's parental-approval gate. */
export async function fetchMyLinkedParents(): Promise<ParentChildLink[]> {
  const { data: authData } = await kidsDb.auth.getUser();
  const myId = authData.user?.id;
  if (!myId) return [];
  const { data, error } = await kidsDb.from("kids_parent_child_links").select("*").eq("child_user_id", myId).returns<ParentChildLink[]>();
  if (error) throw error;
  return data ?? [];
}

export async function unlinkChild(linkId: string): Promise<void> {
  const { error } = await kidsDb.from("kids_parent_child_links").delete().eq("id", linkId);
  if (error) throw error;
}

export interface ChildWeeklySummary {
  lessonsCompleted: number;
  totalMinutes: number;
  averageScore: number | null;
  achievementsEarned: number;
}

/** Real aggregation over kids_lesson_progress + kids_user_achievements for
 *  the last 7 days — no separate "weekly report" table, computed on read. */
export async function fetchChildWeeklySummary(childUserId: string): Promise<ChildWeeklySummary> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: progressRows } = await kidsDb
    .from("kids_lesson_progress")
    .select("status, score, time_spent_seconds, completed_at")
    .eq("user_id", childUserId)
    .gte("last_accessed_at", since.toISOString());

  const rows = progressRows ?? [];
  const completed = rows.filter((r: { status: string }) => r.status === "completed");
  const scores = completed.map((r: { score: number | null }) => r.score).filter((s: number | null): s is number => s !== null);
  const totalSeconds = rows.reduce((sum: number, r: { time_spent_seconds: number }) => sum + (r.time_spent_seconds ?? 0), 0);

  const { count: achievementsCount } = await kidsDb
    .from("kids_user_achievements")
    .select("*", { count: "exact", head: true })
    .eq("user_id", childUserId)
    .gte("earned_at", since.toISOString());

  return {
    lessonsCompleted: completed.length,
    totalMinutes: Math.round(totalSeconds / 60),
    averageScore: scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null,
    achievementsEarned: achievementsCount ?? 0,
  };
}
