/**
 * library-detect-series — proposes series membership for a book; NEVER
 * links it automatically (confirmed choice: AI-suggested, review-gated).
 * Writes one row to library_series_suggestions (status='pending') for the
 * author/admin to approve or reject via the Studio Organization tab —
 * approving is a separate, ordinary authenticated write (see
 * services/library/seriesSuggestions.ts), not something this function does.
 *
 * Compares the book against the author's own existing series and other
 * standalone books by the same author — cross-author series detection is
 * out of scope (an unrelated author's book sharing a similar title is far
 * more likely a false positive than a real companion volume).
 *
 * Auth: user-jwt required, caller must be able to edit the book.
 * Input: JSON { book_id }
 * Returns: JSON { ok, suggestion }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  book_id: string;
}

const SUGGEST_SCHEMA = {
  type: "object",
  properties: {
    belongs_to_series: { type: "boolean" },
    existing_series_title: { type: ["string", "null"], description: "Exact title of the matching existing series, if any." },
    new_series_title: { type: ["string", "null"], description: "A proposed series title, only if this looks like the start of a new series (not just a standalone book)." },
    position: { type: ["number", "null"], description: "This book's volume/position number in the series, if determinable." },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasoning: { type: "string" },
  },
  required: ["belongs_to_series", "existing_series_title", "new_series_title", "position", "confidence", "reasoning"],
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

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-detect-series" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);

  const { data: canEdit } = await userClient.rpc("can_edit_library_book", { _book_id: body.book_id });
  if (!canEdit) return json({ error: "You don't have access to this book" }, 403, cors);

  try {
    const { data: book, error: bookErr } = await userClient
      .from("library_books")
      .select("id, title, subtitle, description, author_id, series_id")
      .eq("id", body.book_id)
      .maybeSingle();
    if (bookErr) throw bookErr;
    if (!book) return json({ error: "Book not found" }, 404, cors);
    if (book.series_id) return json({ error: "This book is already linked to a series" }, 400, cors);

    const [{ data: existingSeries }, { data: otherBooks }] = await Promise.all([
      userClient.from("library_series").select("id, title").eq("author_id", book.author_id),
      userClient.from("library_books").select("id, title, subtitle, series_id, series_position").eq("author_id", book.author_id).neq("id", book.id).limit(50),
    ]);

    const candidateList = [
      ...(existingSeries ?? []).map((s: { title: string }) => `Existing series: "${s.title}"`),
      ...(otherBooks ?? []).map((b: { title: string; subtitle: string | null }) => `Other book by this author: "${b.title}"${b.subtitle ? ` (${b.subtitle})` : ""}`),
    ].join("\n");

    const userText = [
      `Book to evaluate: "${book.title}"${book.subtitle ? ` — ${book.subtitle}` : ""}`,
      book.description ? `Description: ${book.description}` : "",
      candidateList ? `\nOther works by the same author:\n${candidateList}` : "\n(This author has no other catalogued works.)",
    ].filter(Boolean).join("\n").slice(0, 6000);

    const suggestion = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: "You determine whether a book is part of a series, using only its own title/description and a list of the same author's other catalogued works (titles only — you don't have their full text). Be conservative: only propose a series link when the evidence is genuinely strong (explicit volume numbering, a shared subtitle pattern, or an unambiguous sequel cue) — when in doubt, say it does not belong to a series.",
      userText,
      schema: SUGGEST_SCHEMA,
      toolName: "suggest_series",
      maxTokens: 500,
    }) as {
      belongs_to_series: boolean;
      existing_series_title: string | null;
      new_series_title: string | null;
      position: number | null;
      confidence: number;
      reasoning: string;
    };

    if (!suggestion.belongs_to_series) {
      return json({ ok: true, suggestion: null, reasoning: suggestion.reasoning }, 200, cors);
    }

    const matchedSeries = suggestion.existing_series_title
      ? (existingSeries ?? []).find((s: { title: string }) => s.title.toLowerCase() === suggestion.existing_series_title!.toLowerCase())
      : null;

    if (!matchedSeries && !suggestion.new_series_title) {
      // Model said "belongs to a series" but couldn't name one — treat as
      // no actionable suggestion rather than inserting a row that fails the
      // table's CHECK constraint.
      return json({ ok: true, suggestion: null, reasoning: suggestion.reasoning }, 200, cors);
    }

    const { data: row, error: insertErr } = await serviceClient
      .from("library_series_suggestions")
      .insert({
        book_id: book.id,
        suggested_series_id: matchedSeries?.id ?? null,
        suggested_series_title: matchedSeries ? null : suggestion.new_series_title,
        suggested_position: suggestion.position,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning,
      })
      .select("*")
      .single();
    if (insertErr) throw insertErr;

    return json({ ok: true, suggestion: row }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-detect-series error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
