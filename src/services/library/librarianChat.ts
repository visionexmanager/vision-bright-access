// ─── Library — AI Personal Librarian: Persistent Cross-Book Chat ──────────
// Streams library-librarian-chat directly (supabase.functions.invoke can't
// stream) and hands the raw Response to the shared SSE parser — identical
// technique to aiChat.ts's per-book chat, just session_type='librarian_chat'
// and no book_id/chapter_id/citations.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryChatMessage } from "@/lib/types/library-ai";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/library-librarian-chat`;

export async function sendLibrarianChatMessage(sessionId: string, message: string, title?: string): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You must be signed in to chat with your Librarian.");

  const response = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify({ session_id: sessionId, message, title }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Chat request failed (${response.status})`);
  }
  return response;
}

export async function fetchLibrarianChatHistory(sessionId: string): Promise<LibraryChatMessage[]> {
  const { data, error } = await supabase
    .from("library_ai_chat_sessions")
    .select("id, role, content, created_at")
    .eq("session_type", "librarian_chat")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryChatMessage[];
}

export interface LibraryLibrarianChatSessionSummary {
  session_id: string;
  title: string;
  last_message: string;
  last_message_at: string;
}

export async function fetchLibrarianChatSessions(userId: string): Promise<LibraryLibrarianChatSessionSummary[]> {
  const { data, error } = await supabase
    .from("library_ai_chat_sessions")
    .select("session_id, title, content, created_at")
    .eq("user_id", userId)
    .eq("session_type", "librarian_chat")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const seen = new Map<string, LibraryLibrarianChatSessionSummary>();
  const titleBySession = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.title && !titleBySession.has(row.session_id)) titleBySession.set(row.session_id, row.title);
  }
  for (const row of data ?? []) {
    if (!seen.has(row.session_id)) {
      seen.set(row.session_id, {
        session_id: row.session_id,
        title: titleBySession.get(row.session_id) ?? row.content.slice(0, 60),
        last_message: row.content,
        last_message_at: row.created_at,
      });
    }
  }
  return Array.from(seen.values());
}
