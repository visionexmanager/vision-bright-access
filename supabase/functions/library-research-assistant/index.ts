/**
 * library-research-assistant — the genuinely-new "Research Assistant" +
 * "Multi-Source Analysis" capability: every mode here spans MORE THAN ONE
 * book/author, which library-ai-assistant's BOOK_RAG_MODES never do (each
 * of those takes exactly one book_id). Results are persisted into
 * library_research_analyses (unlike Learning Hub's ephemeral single-book
 * timeline/flashcards, a multi-book comparison is expensive enough, and
 * valuable enough to revisit, to be worth saving).
 *
 * Modes:
 *   summarize_multiple   — book_ids[] -> one synthesized summary across sources
 *   compare_books         — book_ids[] (>=2) -> themes/contradictions/agreements
 *   compare_authors       — author_ids[] (>=2) -> style/themes comparison
 *   literature_review     — book_ids[] -> structured literature-review draft
 *   research_outline      — topic (free text) -> a research outline
 *   suggest_references    — topic -> real catalog matches via semantic search (never hallucinated)
 *   knowledge_gaps        — book_ids[] and/or topic -> gaps not covered by the given sources
 *
 * Auth: user-jwt required. Access to every book_id is checked via
 * can_access_library_book_content() (same paywall rule as reading it).
 * Input: JSON { mode, book_ids?, author_ids?, topic?, title? }
 * Returns: JSON { ok, analysis_id, result }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, createEmbedding, ProviderError } from "../_shared/aiProvider.ts";
import { ensureBookIndexed, retrieveChunks, formatChunksAsContext } from "../_shared/libraryRag.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

type Mode = "summarize_multiple" | "compare_books" | "compare_authors" | "literature_review" | "research_outline" | "suggest_references" | "knowledge_gaps";

interface RequestBody {
  mode?: Mode;
  book_ids?: string[];
  author_ids?: string[];
  topic?: string;
  title?: string;
}

const SCHEMAS: Record<string, { toolName: string; system: string; schema: Record<string, unknown> }> = {
  summarize_multiple: {
    toolName: "summarize_multiple_sources",
    system: "You synthesize a single coherent summary across excerpts from MULTIPLE books, clearly attributing which book each point comes from. Note where sources agree or diverge.",
    schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        per_source_highlights: { type: "array", items: { type: "object", properties: { book_title: { type: "string" }, highlight: { type: "string" } }, required: ["book_title", "highlight"], additionalProperties: false } },
      },
      required: ["summary", "per_source_highlights"],
      additionalProperties: false,
    },
  },
  compare_books: {
    toolName: "compare_books",
    system: "You compare excerpts from multiple books faithfully. Identify common themes, points of agreement, and direct contradictions between the sources. Never invent claims not present in the text.",
    schema: {
      type: "object",
      properties: {
        common_themes: { type: "array", items: { type: "string" } },
        agreements: { type: "array", items: { type: "string" } },
        contradictions: { type: "array", items: { type: "string" } },
        overall_comparison: { type: "string" },
      },
      required: ["common_themes", "agreements", "contradictions", "overall_comparison"],
      additionalProperties: false,
    },
  },
  compare_authors: {
    toolName: "compare_authors",
    system: "You compare the writing style, recurring themes, and perspective of different authors based on excerpts from their books.",
    schema: {
      type: "object",
      properties: {
        authors: { type: "array", items: { type: "object", properties: { author_name: { type: "string" }, style_summary: { type: "string" }, recurring_themes: { type: "array", items: { type: "string" } } }, required: ["author_name", "style_summary", "recurring_themes"], additionalProperties: false } },
        overall_comparison: { type: "string" },
      },
      required: ["authors", "overall_comparison"],
      additionalProperties: false,
    },
  },
  literature_review: {
    toolName: "generate_literature_review",
    system: "You write a structured literature-review draft synthesizing excerpts from multiple books on a related topic: an introduction, thematic sections summarizing what each source contributes, and a conclusion noting open questions.",
    schema: {
      type: "object",
      properties: {
        introduction: { type: "string" },
        thematic_sections: { type: "array", items: { type: "object", properties: { heading: { type: "string" }, content: { type: "string" } }, required: ["heading", "content"], additionalProperties: false } },
        conclusion: { type: "string" },
      },
      required: ["introduction", "thematic_sections", "conclusion"],
      additionalProperties: false,
    },
  },
  research_outline: {
    toolName: "create_research_outline",
    system: "You create a structured research outline for a given topic: a working title, and a hierarchy of sections and sub-points to investigate.",
    schema: {
      type: "object",
      properties: {
        working_title: { type: "string" },
        sections: { type: "array", items: { type: "object", properties: { heading: { type: "string" }, sub_points: { type: "array", items: { type: "string" } } }, required: ["heading", "sub_points"], additionalProperties: false } },
      },
      required: ["working_title", "sections"],
      additionalProperties: false,
    },
  },
  knowledge_gaps: {
    toolName: "identify_knowledge_gaps",
    system: "Given excerpts from a set of books (and/or a stated research topic), identify what important sub-topics or questions are NOT well covered by these sources — genuine gaps a researcher should look elsewhere for.",
    schema: {
      type: "object",
      properties: {
        covered_topics: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "object", properties: { gap: { type: "string" }, why_it_matters: { type: "string" } }, required: ["gap", "why_it_matters"], additionalProperties: false } },
      },
      required: ["covered_topics", "gaps"],
      additionalProperties: false,
    },
  },
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

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.mode) return json({ error: "mode is required" }, 400, cors);

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-research-assistant" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  try {
    if (body.mode === "suggest_references") {
      if (!body.topic?.trim()) return json({ error: "topic is required" }, 400, cors);
      const [embedding] = await createEmbedding([body.topic.slice(0, 2000)]);
      const { data: matches, error } = await userClient.rpc("match_library_books_semantic", { _query_embedding: embedding, _match_count: 8 });
      if (error) throw error;
      const bookIds = (matches ?? []).map((m: { book_id: string }) => m.book_id);
      const { data: books } = await userClient.from("library_books").select("id, title, author_id, published_date, library_authors(name)").in("id", bookIds);
      const result = { references: books ?? [] };

      // suggest_references has no matching analysis_type in the CHECK constraint by design —
      // it's a lightweight catalog lookup, not a deep analysis worth persisting/revisiting.
      return json({ ok: true, analysis_id: null, result }, 200, cors);
    }

    if (body.mode === "research_outline") {
      if (!body.topic?.trim()) return json({ error: "topic is required" }, 400, cors);
      const cfg = SCHEMAS.research_outline;
      const result = await structuredCompletion({
        provider: "openai", model: "gpt-4o-mini", system: cfg.system, userText: body.topic,
        schema: cfg.schema, toolName: cfg.toolName, maxTokens: 1200,
      });
      const { data: saved, error: saveErr } = await userClient
        .from("library_research_analyses")
        .insert({ user_id: user.id, analysis_type: "research_outline", title: body.title || (result as { working_title: string }).working_title, topic: body.topic, result })
        .select("id").single();
      if (saveErr) throw saveErr;
      return json({ ok: true, analysis_id: saved.id, result }, 200, cors);
    }

    if (body.mode === "compare_authors") {
      const authorIds = body.author_ids ?? [];
      if (authorIds.length < 2) return json({ error: "At least 2 author_ids are required" }, 400, cors);

      const { data: authors, error: authorsErr } = await userClient.from("library_authors").select("id, name").in("id", authorIds);
      if (authorsErr) throw authorsErr;

      const sections: string[] = [];
      for (const author of authors ?? []) {
        const { data: authorBooks } = await userClient.from("library_books").select("id").eq("author_id", author.id).eq("publish_status", "published").limit(3);
        let authorText = "";
        for (const b of authorBooks ?? []) {
          await ensureBookIndexed(serviceClient, b.id);
          const chunks = await retrieveChunks(userClient, b.id, "writing style, recurring themes, perspective", { matchCount: 4 });
          authorText += formatChunksAsContext(chunks) + "\n";
        }
        sections.push(`Author: ${author.name}\n${authorText.slice(0, 4000)}`);
      }

      const cfg = SCHEMAS.compare_authors;
      const result = await structuredCompletion({
        provider: "openai", model: "gpt-4o-mini", system: cfg.system, userText: sections.join("\n\n---\n\n"),
        schema: cfg.schema, toolName: cfg.toolName, maxTokens: 1500,
      });
      const { data: saved, error: saveErr } = await userClient
        .from("library_research_analyses")
        .insert({ user_id: user.id, analysis_type: "compare_authors", title: body.title || `Comparing ${(authors ?? []).map((a) => a.name).join(" vs. ")}`, author_ids: authorIds, result })
        .select("id").single();
      if (saveErr) throw saveErr;
      return json({ ok: true, analysis_id: saved.id, result }, 200, cors);
    }

    // summarize_multiple, compare_books, literature_review, knowledge_gaps — all book_ids[]-driven.
    const bookIds = body.book_ids ?? [];
    if (bookIds.length === 0) return json({ error: "book_ids is required" }, 400, cors);
    if ((body.mode === "compare_books") && bookIds.length < 2) {
      return json({ error: "At least 2 book_ids are required to compare" }, 400, cors);
    }

    for (const bookId of bookIds) {
      const { data: canAccess } = await userClient.rpc("can_access_library_book_content", { _book_id: bookId });
      if (!canAccess) return json({ error: "You don't have access to one or more of these books" }, 403, cors);
    }

    const { data: books } = await userClient.from("library_books").select("id, title").in("id", bookIds);
    const bookTitleById = new Map((books ?? []).map((b) => [b.id, b.title]));

    let combinedText = "";
    for (const bookId of bookIds) {
      await ensureBookIndexed(serviceClient, bookId);
      const chunks = await retrieveChunks(userClient, bookId, body.topic || "key ideas, themes, and arguments", { matchCount: 8 });
      combinedText += `\n\n=== ${bookTitleById.get(bookId) ?? bookId} ===\n${formatChunksAsContext(chunks)}`;
    }
    combinedText = combinedText.slice(0, 20000);

    const cfg = SCHEMAS[body.mode as string];
    if (!cfg) return json({ error: "Invalid mode" }, 400, cors);

    const result = await structuredCompletion({
      provider: "openai", model: "gpt-4o-mini", system: cfg.system, userText: combinedText,
      schema: cfg.schema, toolName: cfg.toolName, maxTokens: 2000,
    });

    const { data: saved, error: saveErr } = await userClient
      .from("library_research_analyses")
      .insert({
        user_id: user.id, analysis_type: body.mode, book_ids: bookIds, topic: body.topic ?? null,
        title: body.title || `${body.mode.replace(/_/g, " ")}: ${[...bookTitleById.values()].join(", ")}`,
        result,
      })
      .select("id").single();
    if (saveErr) throw saveErr;

    return json({ ok: true, analysis_id: saved.id, result }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-research-assistant error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
