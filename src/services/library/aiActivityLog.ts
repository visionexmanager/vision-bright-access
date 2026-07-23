// ─── Library — AI Activity Log Service (Phase 8) ──────────────────────────
// Wraps library_ai_activity_log (20260727000000_library_ai_assistant_v2.sql)
// — per-user history of summary/translation/explain-selection AI actions.
// Chat history is fetched separately via fetchChatSessions
// (services/library/aiChat.ts) and merged client-side — see
// useLibraryAiHistory.

import { supabase } from "@/integrations/supabase/client";
import type { AiActivityLogRow } from "@/lib/types/library-ai";

export async function fetchAiActivityLog(userId: string, bookId?: string, limit = 30): Promise<AiActivityLogRow[]> {
  let query = supabase
    .from("library_ai_activity_log")
    .select("id, user_id, book_id, activity_type, title, snippet, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (bookId) query = query.eq("book_id", bookId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AiActivityLogRow[];
}
