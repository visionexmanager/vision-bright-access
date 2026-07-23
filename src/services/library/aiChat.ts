// ─── Library — AI Chat Service (Phase 6.5) ────────────────────────────────
// Streaming "chat with the book" — fetch()s library-ai-chat directly (not
// supabase.functions.invoke, which can't stream) and hands the raw Response
// to the existing shared SSE parser (src/lib/api/useSSEStream.ts), same
// technique every other streaming feature in this app already uses.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryChatMessage, LibraryCitation } from "@/lib/types/library-ai";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/library-ai-chat`;

export interface SendLibraryChatMessageResult {
  response: Response;
  getCitations: () => LibraryCitation[];
}

/** Sends one chat turn and returns the raw streaming Response plus a
 *  citations accessor (reads the X-Library-Citations header, decoded) —
 *  callers hand `response` straight to useSSEStream()/parseSSEResponse(). */
export async function sendLibraryChatMessage(bookId: string, sessionId: string, message: string, chapterId?: string, readingMode?: string): Promise<SendLibraryChatMessageResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You must be signed in to chat with this book.");

  const response = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify({ book_id: bookId, session_id: sessionId, message, chapter_id: chapterId, readingMode }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Chat request failed (${response.status})`);
  }

  return {
    response,
    getCitations: () => {
      const header = response.headers.get("X-Library-Citations");
      if (!header) return [];
      try {
        return JSON.parse(atob(header)) as LibraryCitation[];
      } catch {
        return [];
      }
    },
  };
}

export async function fetchChatHistory(bookId: string, sessionId: string): Promise<LibraryChatMessage[]> {
  const { data, error } = await supabase
    .from("library_ai_chat_sessions")
    .select("id, role, content, created_at")
    .eq("book_id", bookId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryChatMessage[];
}

export interface LibraryChatSessionSummary {
  session_id: string;
  last_message: string;
  last_message_at: string;
}

/** One row per distinct session_id for this book, most recent message
 *  first — powers a "past conversations" list. Computed client-side from
 *  the full message list (a user's own chat history for one book is a
 *  small, bounded dataset — no need for a dedicated aggregate query). */
export async function fetchChatSessions(bookId: string): Promise<LibraryChatSessionSummary[]> {
  const { data, error } = await supabase
    .from("library_ai_chat_sessions")
    .select("session_id, content, created_at")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const seen = new Map<string, LibraryChatSessionSummary>();
  for (const row of data ?? []) {
    if (!seen.has(row.session_id)) {
      seen.set(row.session_id, { session_id: row.session_id, last_message: row.content, last_message_at: row.created_at });
    }
  }
  return Array.from(seen.values());
}
