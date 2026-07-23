/**
 * library-librarian-chat — the AI Personal Librarian's cross-book persistent
 * chat ("book discussions", "learning discussions", "research discussions"
 * that aren't scoped to one specific book). Mirrors library-ai-chat's
 * streaming + persistence plumbing exactly, but:
 *   - has no book_id / RAG retrieval — its context comes from the caller's
 *     own profile (recent reading, favorite genres/authors, active goals,
 *     streak) instead of book excerpts
 *   - persists into the SAME library_ai_chat_sessions table used by
 *     library-ai-chat, with book_id NULL and session_type='librarian_chat'
 *     (the widened schema's CHECK constraint enforces this pairing)
 *
 * Auth: user-jwt required.
 * Input: JSON { session_id, message, title? }
 * Returns: text/event-stream (OpenAI-shaped SSE)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { streamChatCompletion, ProviderError } from "../_shared/aiProvider.ts";

const HISTORY_LIMIT = 20;

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  session_id: string;
  message: string;
  title?: string;
}

/** Identical technique to library-ai-chat's createPersistingStream — passes
 *  the SSE stream through unchanged while accumulating the plain text so
 *  the full reply can be persisted once the stream ends. */
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
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-librarian-chat" });
  if (allowed === false) return json({ error: "Daily limit reached (60 messages/day). Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.session_id || !body.message?.trim()) {
    return json({ error: "session_id and message are required" }, 400, cors);
  }

  try {
    const [{ data: continueReading }, { data: profile }, { data: goals }, { data: streak }] = await Promise.all([
      userClient.from("library_reading_progress").select("book_id, library_books(title)").eq("user_id", user.id).is("completed_at", null).order("last_read_at", { ascending: false }).limit(3),
      userClient.from("library_reader_profiles").select("favorite_genres, favorite_authors").eq("user_id", user.id).maybeSingle(),
      userClient.from("library_reading_goals").select("goal_type, target, custom_label").eq("is_active", true),
      userClient.rpc("get_library_reading_streak", { _user_id: user.id }),
    ]);

    const currentlyReading = ((continueReading ?? []) as unknown as Array<{ library_books: { title: string } | null }>)
      .map((r) => r.library_books?.title).filter(Boolean);

    let genreNames: string[] = [];
    let authorNames: string[] = [];
    if (profile?.favorite_genres?.length) {
      const { data: cats } = await serviceClient.from("library_categories").select("name").in("id", profile.favorite_genres);
      genreNames = (cats ?? []).map((c: { name: string }) => c.name);
    }
    if (profile?.favorite_authors?.length) {
      const { data: auths } = await serviceClient.from("library_authors").select("name").in("id", profile.favorite_authors);
      authorNames = (auths ?? []).map((a: { name: string }) => a.name);
    }

    const contextBlock = [
      currentlyReading.length > 0 ? `Currently reading: ${currentlyReading.join(", ")}.` : "Not currently reading anything.",
      genreNames.length > 0 ? `Favorite genres: ${genreNames.join(", ")}.` : "",
      authorNames.length > 0 ? `Favorite authors: ${authorNames.join(", ")}.` : "",
      goals && goals.length > 0
        ? `Active goals: ${goals.map((g: { goal_type: string; target: number; custom_label: string | null }) => g.goal_type === "custom" ? g.custom_label : `${g.goal_type} (target ${g.target})`).join(", ")}.`
        : "",
      `Current reading streak: ${streak ?? 0} days.`,
    ].filter(Boolean).join("\n");

    const { data: historyRows, error: historyErr } = await userClient
      .from("library_ai_chat_sessions")
      .select("role, content")
      .eq("session_type", "librarian_chat")
      .eq("session_id", body.session_id)
      .order("created_at", { ascending: true })
      .limit(HISTORY_LIMIT);
    if (historyErr) throw historyErr;

    const isNewSession = (historyRows ?? []).length === 0;

    const { error: insertUserErr } = await serviceClient.from("library_ai_chat_sessions").insert({
      user_id: user.id, book_id: null, session_type: "librarian_chat", session_id: body.session_id,
      title: isNewSession ? (body.title || body.message.slice(0, 60)) : undefined,
      role: "user", content: body.message,
    });
    if (insertUserErr) throw insertUserErr;

    const systemPrompt = `You are the Visionex AI Personal Librarian — a warm, knowledgeable companion for a reader's whole library life: book discussions, learning discussions, and research discussions, not limited to a single book. Use the reader's own context below to personalize your answers, but you are not restricted to discussing only these books — help with any reading, learning, or research question they bring. Be encouraging and concise. Respond in the same language the reader writes in.\n\nREADER CONTEXT:\n${contextBlock}`;

    const messages = [
      ...(historyRows ?? []).map((m: { role: string; content: string }) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user", content: m.content })),
      { role: "user" as const, content: body.message },
    ];

    const stream = await streamChatCompletion({ provider: "openai", model: "gpt-4o-mini", system: systemPrompt, messages, maxTokens: 1200 });

    const persistingStream = createPersistingStream(stream, (fullText) => {
      if (!fullText.trim()) return;
      void serviceClient.from("library_ai_chat_sessions").insert({
        user_id: user.id, book_id: null, session_type: "librarian_chat", session_id: body.session_id, role: "assistant", content: fullText,
      }).then(({ error }: { error: unknown }) => {
        if (error) console.error("library-librarian-chat: failed to persist assistant reply:", error);
      });
    });

    return new Response(persistingStream, { headers: { ...cors, "Content-Type": "text/event-stream" } });
  } catch (err) {
    if (err instanceof ProviderError) {
      const status = err.status === 429 ? 429 : 500;
      return json({ error: err.status === 429 ? "Rate limit exceeded. Please try again shortly." : "AI service temporarily unavailable" }, status, cors);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-librarian-chat error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
