// ─── Library — Community Moderation (Phase 12: Reading Community) ─────────
// AI toxic-content pre-check (reuses the existing generic moderate-content
// function) + the admin reports queue + warnings/mutes/bans.

import { supabase } from "@/integrations/supabase/client";

/** Returns true if the text was flagged and should be blocked. Fails open
 *  (never blocks) on any error, matching moderate-content's own fail-open
 *  behavior for provider outages. */
export async function isContentFlagged(text: string): Promise<{ flagged: boolean; categories: string[] }> {
  try {
    const { data, error } = await supabase.functions.invoke("moderate-content", { body: { text } });
    if (error) throw error;
    return { flagged: !!data?.flagged, categories: data?.categories ?? [] };
  } catch (err) {
    console.warn("Content moderation check failed, allowing by default:", err);
    return { flagged: false, categories: [] };
  }
}

export interface LibraryContentReportRow {
  id: string;
  reporter_id: string;
  content_type: string;
  content_id: string;
  reason: string;
  details: string | null;
  status: "pending" | "reviewed" | "dismissed" | "actioned";
  created_at: string;
}

/** Resolves the author/user_id behind a reported piece of content, for the
 *  admin dashboard's "take action against this user" shortcut. Returns null
 *  for content types with no single clear author (e.g. a book, which has
 *  no single "user" to act against the same way). */
export async function resolveContentAuthor(contentType: string, contentId: string): Promise<string | null> {
  const table = {
    library_discussion_topic: "library_discussion_topics",
    library_discussion_reply: "library_discussion_replies",
    library_review: "library_reviews",
    library_reader_profile: null,
  }[contentType];
  if (contentType === "library_reader_profile") return contentId;
  if (!table) return null;

  const column = contentType === "library_review" ? "user_id" : "author_id";
  const { data, error } = await supabase.from(table).select(column).eq("id", contentId).maybeSingle();
  if (error || !data) return null;
  return (data as Record<string, string>)[column] ?? null;
}

export async function fetchPendingReports(): Promise<LibraryContentReportRow[]> {
  const { data, error } = await supabase.from("content_reports").select("*").eq("status", "pending").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryContentReportRow[];
}

export async function resolveReport(reportId: string, reviewerId: string, status: "reviewed" | "dismissed" | "actioned"): Promise<void> {
  const { error } = await supabase.from("content_reports").update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() }).eq("id", reportId);
  if (error) throw new Error(error.message);
}

export type LibraryModerationAction = "warning" | "mute" | "ban";

export interface LibraryUserModerationRow {
  id: string;
  user_id: string;
  club_id: string | null;
  action: LibraryModerationAction;
  reason: string;
  moderator_id: string;
  expires_at: string | null;
  created_at: string;
}

export async function issueModerationAction(
  userId: string, moderatorId: string, action: LibraryModerationAction, reason: string, clubId: string | null, expiresAt: string | null
): Promise<void> {
  const { error } = await supabase.from("library_user_moderation").insert({ user_id: userId, moderator_id: moderatorId, action, reason, club_id: clubId, expires_at: expiresAt });
  if (error) throw new Error(error.message);
}

export async function fetchUserModerationHistory(userId: string, clubId?: string): Promise<LibraryUserModerationRow[]> {
  let q = supabase.from("library_user_moderation").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (clubId) q = q.eq("club_id", clubId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryUserModerationRow[];
}
