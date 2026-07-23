/**
 * library-ai-classify-book — AI auto-organization for the Global Digital
 * Library (Phase 11): generates topics/subtopics/keywords/difficulty_level/
 * reading_level for a book from its description + opening chapters, then
 * (re)computes its embedding if missing and caches its top related books
 * (library_related_books) via the existing match_library_books_semantic()
 * RPC — no new similarity logic, just reuses Phase 10's semantic search.
 *
 * This directly WRITES the classification (the caller invoked "AI
 * classify" with the intent to apply it) rather than returning a proposal
 * for a separate confirm step — unlike library-detect-series, misclassifying
 * a topic/keyword is low-risk and easily re-run, unlike wrongly merging two
 * books into the same series.
 *
 * Auth: user-jwt required, caller must be able to edit the book (author/
 * collaborator/admin) — mirrors library-ai-writing-assistant's authorization
 * shape exactly.
 * Input: JSON { book_id }
 * Returns: JSON { ok, topics, subtopics, keywords, difficulty_level, reading_level, related_book_ids }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, createEmbedding, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  book_id: string;
}

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    topics: { type: "array", maxItems: 6, items: { type: "string" } },
    subtopics: { type: "array", maxItems: 10, items: { type: "string" } },
    keywords: { type: "array", maxItems: 15, items: { type: "string" } },
    difficulty_level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    reading_level: { type: "string", enum: ["early_reader", "middle_grade", "young_adult", "adult", "graduate"] },
  },
  required: ["topics", "subtopics", "keywords", "difficulty_level", "reading_level"],
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

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-ai-classify-book" });
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
      .select("id, title, description, description_long, embedding")
      .eq("id", body.book_id)
      .maybeSingle();
    if (bookErr) throw bookErr;
    if (!book) return json({ error: "Book not found" }, 404, cors);

    const { data: chapters } = await userClient
      .from("library_chapters")
      .select("content_text")
      .eq("book_id", body.book_id)
      .order("order_index", { ascending: true })
      .limit(3);
    const chapterExcerpt = (chapters ?? [])
      .map((c: { content_text: string | null }) => (c.content_text ?? "").slice(0, 1500))
      .join("\n\n");

    const userText = [
      `Title: ${book.title}`,
      book.description ? `Description: ${book.description}` : "",
      book.description_long ? `Long description: ${book.description_long}` : "",
      chapterExcerpt ? `Opening content excerpt:\n${chapterExcerpt}` : "",
    ].filter(Boolean).join("\n\n").slice(0, 8000);

    const classification = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: "You classify a book's subject matter for a digital library catalog. Generate broad topics (high-level subjects), narrower subtopics, searchable keywords, a skill difficulty level, and an age/grade reading level. Base this only on the given text — never invent plot details or facts not implied by it.",
      userText,
      schema: CLASSIFY_SCHEMA,
      toolName: "classify_book",
      maxTokens: 800,
    }) as { topics: string[]; subtopics: string[]; keywords: string[]; difficulty_level: string; reading_level: string };

    const { error: updateErr } = await userClient
      .from("library_books")
      .update({
        topics: classification.topics,
        subtopics: classification.subtopics,
        keywords: classification.keywords,
        difficulty_level: classification.difficulty_level,
        reading_level: classification.reading_level,
        auto_classified_at: new Date().toISOString(),
      })
      .eq("id", body.book_id);
    if (updateErr) throw updateErr;

    // Ensure an embedding exists, then cache related books — reuses Phase
    // 10's match_library_books_semantic() rather than a new similarity path.
    let embedding = book.embedding as number[] | null;
    if (!embedding) {
      [embedding] = await createEmbedding([`${book.title}\n${book.description ?? ""}`.slice(0, 2000)]);
      await userClient.from("library_books").update({ embedding }).eq("id", body.book_id);
    }

    let relatedIds: string[] = [];
    if (embedding) {
      const { data: matches } = await serviceClient.rpc("match_library_books_semantic", { _query_embedding: embedding, _match_count: 11 });
      const related = ((matches ?? []) as Array<{ book_id: string; similarity: number }>)
        .filter((m) => m.book_id !== body.book_id)
        .slice(0, 10);
      if (related.length > 0) {
        await serviceClient.from("library_related_books").delete().eq("book_id", body.book_id);
        await serviceClient.from("library_related_books").insert(
          related.map((m) => ({ book_id: body.book_id, related_book_id: m.book_id, similarity: m.similarity }))
        );
        relatedIds = related.map((m) => m.book_id);
      }
    }

    return json({ ok: true, ...classification, related_book_ids: relatedIds }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-ai-classify-book error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
