// A saved library answer is served before anything that costs money.
//
// `library-ai-assistant` used to ask the subscription gate, then the daily
// limit, and only then look in `library_ai_summaries` / `library_ai_content_cache`
// — so an account without a paid plan was refused even for an answer Visionex
// already held, and a paid account spent one of its 40 daily units reading a
// row. This module is the lookup that now runs FIRST:
//
//   request -> identify -> saved answer? -> (hit: return it, nothing else runs)
//                                        -> (miss: gate -> limit -> provider)
//
// A hit never reaches the gate, the rate limit, the VX meter or a provider, and
// nothing here can: the only thing this file talks to is the caller's own
// database session. It is read through that session (not the service role), so
// the tables' row-level security still decides what the caller may see.
//
// Pure: no `Deno`, no npm client. The caller passes its client and, for the
// explain modes, the instruction table, so the suite drives every branch with a
// stub that records which tables were touched.

/** The few fields of the request body the lookup needs. */
export interface SavedLookupBody {
  mode: string;
  book_id?: string;
  chapter_id?: string;
  scope?: string;
  length?: string;
  text?: string;
  targetLanguage?: string;
  instruction?: string;
}

/** Just enough of a PostgREST client to read two tables. */
// deno-lint-ignore no-explicit-any
export type SavedLookupClient = { from(table: string): any };

/** Matches MAX_DIRECT_CHARS in library-ai-assistant. */
export const MAX_DIRECT_CHARS = 24_000;

export const SAVED_TEXT_MODES = ["translate-paragraph", "explain-paragraph"] as const;

/** sha-256 of the normalised key parts; the same function writes and reads the cache. */
export async function hashCacheKey(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join("|"));
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The text a translate/explain request sends to the model, or null when the
 * request is not valid. The ONE construction: the cache key is computed from it
 * both when a stored answer is looked up and when a new one is written, so the
 * two can never drift apart.
 */
export function textModeInput(body: SavedLookupBody, explainInstructions: Record<string, string>): string | null {
  if (!body.text?.trim()) return null;
  const text = body.text.length > MAX_DIRECT_CHARS ? body.text.slice(0, MAX_DIRECT_CHARS) : body.text;
  if (body.mode === "translate-paragraph") {
    if (!body.targetLanguage) return null;
    return `Translate the following into ${body.targetLanguage}:\n\n${text}`;
  }
  if (body.mode === "explain-paragraph") {
    const instruction = explainInstructions[body.instruction ?? "explain"] ?? explainInstructions.explain;
    return `${instruction}:\n\n${text}`;
  }
  return text;
}

export async function textModeCacheKey(
  body: SavedLookupBody,
  readingMode: string,
  explainInstructions: Record<string, string>,
): Promise<string | null> {
  if (!(SAVED_TEXT_MODES as readonly string[]).includes(body.mode)) return null;
  const input = textModeInput(body, explainInstructions);
  if (input === null) return null;
  return await hashCacheKey([
    body.mode,
    body.mode === "translate-paragraph" ? (body.targetLanguage ?? "") : (body.instruction ?? "explain"),
    readingMode,
    input,
  ]);
}

export type SavedResponse =
  | { kind: "summary"; result: { summary: string; cached: true; source: "saved"; saved_at: string | null }; summary: string; scope: string; length: string }
  | { kind: "text"; result: Record<string, unknown>; saved_at: string | null };

/**
 * Look for a stored answer. Returns null for any miss, any other mode and any
 * database error — a failed lookup means "go on to the gate", never "answer
 * without one": the gate still decides whether a provider may run.
 */
export async function findSavedResponse(
  client: SavedLookupClient,
  body: SavedLookupBody,
  readingMode: string,
  explainInstructions: Record<string, string>,
): Promise<SavedResponse | null> {
  try {
    if (body.mode === "smart-summary") {
      if (!body.book_id) return null;
      const scope = body.scope ?? "book";
      const length = body.length ?? "medium";
      if (scope !== "book" && !body.chapter_id) return null;
      let query = client
        .from("library_ai_summaries")
        .select("content, created_at")
        .eq("book_id", body.book_id)
        .eq("scope", scope)
        .eq("length", length);
      query = scope === "book" ? query.is("chapter_id", null) : query.eq("chapter_id", body.chapter_id);
      const { data } = await query.maybeSingle();
      if (!data || typeof data.content !== "string") return null;
      const savedAt = typeof data.created_at === "string" ? data.created_at : null;
      return { kind: "summary", summary: data.content, scope, length, result: { summary: data.content, cached: true, source: "saved", saved_at: savedAt } };
    }

    const key = await textModeCacheKey(body, readingMode, explainInstructions);
    if (!key) return null;
    const { data } = await client
      .from("library_ai_content_cache")
      .select("result_text, created_at")
      .eq("content_hash", key)
      .maybeSingle();
    if (!data || typeof data.result_text !== "string") return null;
    const savedAt = typeof data.created_at === "string" ? data.created_at : null;
    const result = body.mode === "translate-paragraph"
      ? { translated_text: data.result_text, source: "saved", saved_at: savedAt }
      : { explanation: data.result_text, source: "saved", saved_at: savedAt };
    return { kind: "text", result, saved_at: savedAt };
  } catch {
    return null;
  }
}
