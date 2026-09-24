// Career AI Suite chat — streams from the career-ai Edge Function's `chat`
// action. fetch()es directly (supabase.functions.invoke cannot stream) and
// hands the Response to the shared SSE parser, the same technique the
// Library chat uses (src/services/library/aiChat.ts).
import { supabase } from "@/integrations/supabase/client";
import { parseSSEResponse } from "@/lib/api/useSSEStream";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/career-ai`;

export interface CareerChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Streams one assistant reply for the conversation so far; resolves with the full text. */
export async function streamCareerChat(
  messages: CareerChatTurn[],
  onToken: (accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("NOT_SIGNED_IN");

  const response = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify({ action: "chat", messages }),
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Career chat failed (${response.status})`);
  }
  return parseSSEResponse(response, (_token, accumulated) => onToken(accumulated), signal);
}
