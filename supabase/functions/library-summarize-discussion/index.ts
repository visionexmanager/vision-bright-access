/**
 * library-summarize-discussion — AI summary of a discussion topic + its
 * replies, for long threads. Read-only (no DB write) — the summary is
 * returned to the caller and shown in the UI, not persisted, since a
 * discussion keeps changing and a stale cached summary would be actively
 * misleading.
 *
 * Auth: user-jwt required, caller must be able to access the topic
 * (mirrors can_access_library_discussion_topic()'s book/club visibility
 * rule via the RPC of the same name).
 * Input: JSON { topic_id }
 * Returns: JSON { ok, summary, key_points }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  topic_id: string;
}

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    key_points: { type: "array", maxItems: 6, items: { type: "string" } },
  },
  required: ["summary", "key_points"],
  additionalProperties: false,
};

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

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-summarize-discussion" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.topic_id) return json({ error: "topic_id is required" }, 400, cors);

  const { data: canAccess } = await userClient.rpc("can_access_library_discussion_topic", { _topic_id: body.topic_id });
  if (!canAccess) return json({ error: "You don't have access to this discussion" }, 403, cors);

  try {
    const { data: topic, error: topicErr } = await userClient
      .from("library_discussion_topics")
      .select("title, body")
      .eq("id", body.topic_id)
      .maybeSingle();
    if (topicErr) throw topicErr;
    if (!topic) return json({ error: "Discussion not found" }, 404, cors);

    const { data: replies, error: repliesErr } = await userClient
      .from("library_discussion_replies")
      .select("body, created_at")
      .eq("topic_id", body.topic_id)
      .order("created_at")
      .limit(100);
    if (repliesErr) throw repliesErr;

    if (!replies || replies.length < 3) {
      return json({ error: "This discussion is too short to summarize yet" }, 400, cors);
    }

    const userText = [
      `Topic: ${topic.title}`,
      topic.body ? `Opening post: ${topic.body}` : "",
      "Replies:",
      ...replies.map((r, i) => `${i + 1}. ${r.body}`),
    ].filter(Boolean).join("\n").slice(0, 10000);

    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: "You summarize online book-discussion threads for someone who hasn't read them. Be neutral and factual — describe what was discussed and any conclusions/disagreements, never take a side. Do not invent claims not present in the text.",
      userText,
      schema: SUMMARY_SCHEMA,
      toolName: "summarize_discussion",
      maxTokens: 500,
    }) as { summary: string; key_points: string[] };

    return json({ ok: true, ...result }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-summarize-discussion error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
