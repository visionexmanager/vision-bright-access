/**
 * library-translate-comment — stateless AI translation of a single
 * discussion reply/comment into one of the app's 11 supported languages.
 * Unlike library-translate-book-metadata, nothing is persisted (a comment
 * translation is only useful in the moment a reader wants it, and doesn't
 * need to survive a page reload as a cached row) — the translated text is
 * returned directly and rendered client-side, discarded otherwise.
 *
 * Auth: user-jwt required.
 * Input: JSON { text, target_language }
 * Returns: JSON { ok, translated_text }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  text: string;
  target_language: string;
}

const SUPPORTED_LANGUAGES = ["en", "ar", "es", "de", "pt", "zh", "tr", "fr", "ru", "ur", "hi"];

const TRANSLATE_SCHEMA = {
  type: "object",
  properties: { translated_text: { type: "string" } },
  required: ["translated_text"],
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

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-translate-comment" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.text?.trim()) return json({ error: "text is required" }, 400, cors);
  if (!SUPPORTED_LANGUAGES.includes(body.target_language)) return json({ error: "Unsupported target_language" }, 400, cors);

  try {
    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: `Translate the given text into the language with ISO code "${body.target_language}". Preserve tone and meaning; do not add commentary.`,
      userText: body.text.trim().slice(0, 2000),
      schema: TRANSLATE_SCHEMA,
      toolName: "translate_comment",
      maxTokens: 800,
    }) as { translated_text: string };

    return json({ ok: true, ...result }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-translate-comment error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
