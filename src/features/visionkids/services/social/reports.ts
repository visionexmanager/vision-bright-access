import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { ContentReport, ReportContentType } from "@/features/visionkids/types/social.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

/** Reuses the site-wide content_reports table (admin panel, 20260422000000)
 *  instead of a kids-specific one — see the 20260813010000 migration's
 *  header comment for why. */
export async function fileReport(contentType: ReportContentType, contentId: string, reason: string, details?: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb
    .from("content_reports")
    .insert({ reporter_id: userId, content_type: contentType, content_id: contentId, reason, details: details ?? null });
  if (error) throw error;
}

export async function fetchMyReports(): Promise<ContentReport[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("content_reports").select("*").eq("reporter_id", userId).order("created_at", { ascending: false })
    .returns<ContentReport[]>();
  if (error) throw error;
  return data ?? [];
}

/** For a linked parent viewing reports their child has filed — RLS policy
 *  "kids: linked parent views own child filed reports" scopes this. */
export async function fetchChildReports(childUserId: string): Promise<ContentReport[]> {
  const { data, error } = await kidsDb
    .from("content_reports").select("*").eq("reporter_id", childUserId).order("created_at", { ascending: false })
    .returns<ContentReport[]>();
  if (error) throw error;
  return data ?? [];
}
