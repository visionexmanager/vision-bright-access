/**
 * library-generate-quotes — extract candidate quotes from a chapter's text
 * using the shared structuredCompletion() layer (same helper
 * document-generate already uses). Non-admin callers must own the book
 * (is_library_book_owner); their quotes are inserted with is_approved =
 * false and stay invisible to the public until an admin approves them —
 * admins get is_approved = true immediately.
 *
 * Auth: user-jwt required
 * Input: JSON { chapter_id }
 * Returns: JSON { ok, quotes }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const MAX_CHARS = 20_000;
const MAX_QUOTES = 5;

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    quotes: {
      type: "array",
      description: `Up to ${MAX_QUOTES} short, standalone, quotable passages copied VERBATIM from the source text — no paraphrasing.`,
      items: { type: "string" },
      maxItems: MAX_QUOTES,
    },
  },
  required: ["quotes"],
  additionalProperties: false,
} as const;

interface RequestBody {
  chapter_id: string;
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

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-generate-quotes" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.chapter_id) return json({ error: "chapter_id is required" }, 400, cors);

  try {
    // RLS on library_chapters already restricts SELECT to
    // free-preview/accessible/owner/admin — a non-owner, non-purchaser
    // simply gets no row back here, which doubles as the authorization check.
    const { data: chapter, error: chapterErr } = await userClient
      .from("library_chapters")
      .select("id, book_id, content_text")
      .eq("id", body.chapter_id)
      .maybeSingle();

    if (chapterErr) throw chapterErr;
    if (!chapter) return json({ error: "Chapter not found or not accessible" }, 404, cors);
    if (!chapter.content_text?.trim()) return json({ error: "Chapter has no text content to extract quotes from" }, 400, cors);

    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    const text = chapter.content_text.length > MAX_CHARS ? chapter.content_text.slice(0, MAX_CHARS) : chapter.content_text;

    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system:
        "You extract short, quotable passages from book chapters for a reading app's Quotes feature. Copy passages VERBATIM from the source — never paraphrase or invent text. Prefer passages that stand alone without context.",
      userText: text,
      schema: RESULT_SCHEMA as unknown as Record<string, unknown>,
      toolName: "quote_extraction",
      maxTokens: 800,
    });

    const quoteTexts = ((result as { quotes?: string[] })?.quotes ?? []).slice(0, MAX_QUOTES).filter((q) => q?.trim());
    if (quoteTexts.length === 0) return json({ ok: true, quotes: [] }, 200, cors);

    const rows = quoteTexts.map((text) => ({
      book_id: chapter.book_id,
      text,
      submitted_by: user.id,
      is_approved: isAdmin,
    }));

    const { data: inserted, error: insertErr } = await userClient.from("library_quotes").insert(rows).select();
    if (insertErr) throw insertErr;

    return json({ ok: true, quotes: inserted }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError
      ? (err.status === 429 ? "Rate limit exceeded. Please try again shortly." : err.message)
      : (err instanceof Error ? err.message : String(err));
    console.error("library-generate-quotes error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
