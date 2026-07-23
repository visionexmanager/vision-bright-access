/**
 * library-ai-chat — "chat with the book," streaming, RAG-grounded, with
 * persisted history. Mirrors ai-chat/index.ts's exact shape (JWT required,
 * check_ai_rate_limit, streamChatCompletion → text/event-stream) but the
 * system prompt is built from retrieved book excerpts (_shared/libraryRag.ts)
 * instead of a static/registry prompt, and both the user's message and the
 * assistant's full reply are persisted to library_ai_chat_sessions.
 *
 * Security: retrieval goes through the CALLING USER's own JWT-scoped
 * client (retrieveChunks → match_library_chapter_chunks), so a
 * non-purchaser can never receive excerpts from a paid book's non-preview
 * chapters — the model only ever sees what the reader is actually entitled
 * to read. The system prompt explicitly instructs the model to answer only
 * from the given excerpts and admit when something isn't in them.
 *
 * Auth: user-jwt required (unlike ai-chat, no anonymous path — chat history
 * is inherently per-user).
 * Input: JSON { book_id, session_id, message, chapter_id?, readingMode? }
 * Returns: text/event-stream (OpenAI-shaped SSE), with an
 * X-Library-Citations response header (base64 JSON array of
 * {chapterId, chapterTitle} the answer was grounded in).
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { streamChatCompletion, ProviderError } from "../_shared/aiProvider.ts";
import { ensureBookIndexed, retrieveChunks, formatChunksAsContext, citationsFromChunks } from "../_shared/libraryRag.ts";

const HISTORY_LIMIT = 10;

/** Phase 8 — same reading-level styling as library-ai-assistant's
 *  MODE_STYLE_INSTRUCTIONS, duplicated rather than shared: these two Deno
 *  functions have no shared non-_shared module today (see that file's own
 *  header note), and this is a single small const, not worth a new shared
 *  file for. */
type AiReadingMode = "beginner" | "student" | "professional" | "child" | "simple_language" | "academic";
const MODE_STYLE_INSTRUCTIONS: Record<AiReadingMode, string> = {
  beginner: "Use very simple vocabulary and short sentences, as if explaining to someone completely new to this subject.",
  student: "Use clear, moderately detailed language suitable for a student studying this material.",
  professional: "Use precise, efficient, professional language suitable for an expert audience — avoid over-explaining basics.",
  child: "Use very simple words, short sentences, and a warm, friendly tone suitable for a child aged 8-12. Avoid any mature or frightening content.",
  simple_language: "Use the simplest possible words and very short sentences, avoiding jargon entirely — suitable for a non-native speaker or someone who finds reading difficult.",
  academic: "Use formal, precise academic language and terminology appropriate for scholarly analysis.",
};
function resolveReadingMode(value: string | undefined): AiReadingMode {
  return value && value in MODE_STYLE_INSTRUCTIONS ? (value as AiReadingMode) : "student";
}

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function utf8ToBase64(str: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

interface RequestBody {
  book_id: string;
  session_id: string;
  message: string;
  chapter_id?: string;
  /** Phase 8 — reading-level style applied to the chat's system prompt. */
  readingMode?: string;
}

/** Passes the SSE stream through to the client unchanged while also
 *  accumulating the plain assistant text (parsing the same OpenAI-shaped
 *  `data: {"choices":[{"delta":{"content":"..."}}]}` frames
 *  streamChatCompletion always emits), so the full reply can be persisted
 *  once the stream ends — same parsing technique aiProvider.ts's own
 *  Anthropic-to-OpenAI transform already uses. */
function createPersistingStream(source: ReadableStream<Uint8Array>, onComplete: (fullText: string) => void): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        onComplete(fullText);
        return;
      }
      controller.enqueue(value);

      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          const delta = evt.choices?.[0]?.delta?.content;
          if (typeof delta === "string") fullText += delta;
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-ai-chat" });
  if (allowed === false) return json({ error: "Daily limit reached (60 messages/day). Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.book_id || !body.session_id || !body.message?.trim()) {
    return json({ error: "book_id, session_id, and message are required" }, 400, cors);
  }

  try {
    await ensureBookIndexed(serviceClient, body.book_id);
    const chunks = await retrieveChunks(userClient, body.book_id, body.message, { matchCount: 8, chapterId: body.chapter_id });

    const { data: historyRows, error: historyErr } = await userClient
      .from("library_ai_chat_sessions")
      .select("role, content")
      .eq("book_id", body.book_id)
      .eq("session_id", body.session_id)
      .order("created_at", { ascending: true })
      .limit(HISTORY_LIMIT);
    if (historyErr) throw historyErr;

    const { error: insertUserErr } = await serviceClient.from("library_ai_chat_sessions").insert({
      user_id: user.id, book_id: body.book_id, session_id: body.session_id, role: "user", content: body.message,
    });
    if (insertUserErr) throw insertUserErr;

    const excerptsBlock = chunks.length > 0
      ? formatChunksAsContext(chunks)
      : "(No relevant excerpts were found in this book for this question.)";

    const readingMode = resolveReadingMode(body.readingMode);
    const systemPrompt = `You are the Visionex Reading Assistant, chatting with a reader about the specific book they are currently reading. Answer using ONLY the excerpts below, taken directly from the book. If the excerpts don't contain the answer, say so honestly instead of guessing or using outside knowledge. When useful, mention which chapter an idea came from. Respond in the same language the reader writes in. ${MODE_STYLE_INSTRUCTIONS[readingMode]}\n\nBOOK EXCERPTS:\n${excerptsBlock}`;

    const messages = [
      ...(historyRows ?? []).map((m: { role: string; content: string }) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user", content: m.content })),
      { role: "user" as const, content: body.message },
    ];

    const stream = await streamChatCompletion({ provider: "openai", model: "gpt-4o-mini", system: systemPrompt, messages, maxTokens: 1200 });

    const persistingStream = createPersistingStream(stream, (fullText) => {
      if (!fullText.trim()) return;
      void serviceClient.from("library_ai_chat_sessions").insert({
        user_id: user.id, book_id: body.book_id, session_id: body.session_id, role: "assistant", content: fullText,
      }).then(({ error }: { error: unknown }) => {
        if (error) console.error("library-ai-chat: failed to persist assistant reply:", error);
      });
    });

    const citations = citationsFromChunks(chunks);

    return new Response(persistingStream, {
      headers: {
        ...cors,
        "Content-Type": "text/event-stream",
        "X-Library-Citations": utf8ToBase64(JSON.stringify(citations)),
        // Custom response headers are invisible to browser fetch() callers
        // unless explicitly exposed — cors.ts doesn't set this globally, so
        // it's added here rather than widening every function's CORS policy.
        "Access-Control-Expose-Headers": "X-Library-Citations",
      },
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      const status = err.status === 429 ? 429 : 500;
      return json({ error: err.status === 429 ? "Rate limit exceeded. Please try again shortly." : "AI service temporarily unavailable" }, status, cors);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-ai-chat error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
