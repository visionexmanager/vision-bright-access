/**
 * library-build-knowledge-graph — extracts persistent, cross-book entities
 * (characters/historical events/scientific concepts/locations/
 * organizations/people/topics) and their relationships from a book's
 * indexed content, writing them into library_kg_entities/
 * library_kg_book_entities/library_kg_entity_relations. Distinct from
 * library-ai-assistant's character-explorer/concepts-explorer/timeline
 * modes, which generate fresh text per request and store nothing — this
 * function is what actually populates a navigable graph other books can
 * share entities with (e.g. two books both mentioning "World War II" or
 * "Marie Curie" become linked through that shared entity).
 *
 * Entities are deduplicated by (entity_type, name) — an exact-name match,
 * not fuzzy; two books calling the same historical figure by slightly
 * different names will create two entities rather than a false merge,
 * which is the safer failure mode for a knowledge graph.
 *
 * Auth: user-jwt required, caller must be able to edit the book (author-
 * invoked, same authorization shape as library-ai-classify-book).
 * Input: JSON { book_id }
 * Returns: JSON { ok, entities_added, relations_added }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";
import { ensureBookIndexed, retrieveChunks, formatChunksAsContext } from "../_shared/libraryRag.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  book_id: string;
}

const ENTITY_TYPES = ["character", "historical_event", "scientific_concept", "location", "organization", "person", "topic"];

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || crypto.randomUUID().slice(0, 8);
}

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    entities: {
      type: "array", maxItems: 20,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          entity_type: { type: "string", enum: ENTITY_TYPES },
          description: { type: "string" },
        },
        required: ["name", "entity_type", "description"], additionalProperties: false,
      },
    },
    relations: {
      type: "array", maxItems: 20,
      items: {
        type: "object",
        properties: {
          entity_a: { type: "string" },
          entity_b: { type: "string" },
          relation_type: { type: "string" },
        },
        required: ["entity_a", "entity_b", "relation_type"], additionalProperties: false,
      },
    },
  },
  required: ["entities", "relations"], additionalProperties: false,
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

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-build-knowledge-graph" });
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
      .select("id, title, description, author_id, library_authors(name)")
      .eq("id", body.book_id)
      .maybeSingle();
    if (bookErr) throw bookErr;
    if (!book) return json({ error: "Book not found" }, 404, cors);

    await ensureBookIndexed(serviceClient, body.book_id);
    const chunks = await retrieveChunks(userClient, body.book_id, `${book.title}. ${book.description ?? ""}`, { matchCount: 12 });
    const context = formatChunksAsContext(chunks);
    if (!context.trim()) return json({ error: "This book has no indexed content yet to extract from" }, 400, cors);

    const extraction = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: "You extract named entities (characters, historical events, scientific concepts, locations, organizations, real people, and key topics) and the relationships between them from book excerpts, for a cross-book knowledge graph. Only extract entities that are clearly, substantively present — not passing mentions. Use each entity's most complete, canonical name (e.g. 'World War II' not 'the war'). relation_type should be a short phrase (e.g. 'fought in', 'founded', 'located in', 'influenced'). Respond in English regardless of the excerpt language, since entity names must stay consistent across the whole catalog.",
      userText: context.slice(0, 8000),
      schema: EXTRACTION_SCHEMA,
      toolName: "extract_knowledge_graph",
      maxTokens: 2000,
    }) as { entities: Array<{ name: string; entity_type: string; description: string }>; relations: Array<{ entity_a: string; entity_b: string; relation_type: string }> };

    const authorName = (book as unknown as { library_authors: { name: string } | null }).library_authors?.name;
    const allEntities = [...extraction.entities];
    if (authorName) allEntities.push({ name: authorName, entity_type: "author", description: "" });

    const nameToId = new Map<string, string>();
    let entitiesAdded = 0;
    for (const entity of allEntities) {
      const { data: existing } = await serviceClient
        .from("library_kg_entities")
        .select("id")
        .eq("entity_type", entity.entity_type)
        .eq("name", entity.name)
        .maybeSingle();

      let entityId = existing?.id as string | undefined;
      if (!entityId) {
        const { data: inserted, error: insertErr } = await serviceClient
          .from("library_kg_entities")
          .insert({ entity_type: entity.entity_type, name: entity.name, slug: slugify(`${entity.entity_type}-${entity.name}`), description: entity.description || null })
          .select("id")
          .single();
        if (insertErr) continue; // likely a race on the (entity_type, name) unique constraint — safe to skip
        entityId = inserted.id;
        entitiesAdded++;
      }
      nameToId.set(entity.name, entityId);

      await serviceClient.from("library_kg_book_entities").upsert(
        { book_id: body.book_id, entity_id: entityId, context: entity.description || null },
        { onConflict: "book_id,entity_id" }
      );
    }

    let relationsAdded = 0;
    for (const relation of extraction.relations) {
      const idA = nameToId.get(relation.entity_a);
      const idB = nameToId.get(relation.entity_b);
      if (!idA || !idB || idA === idB) continue;
      const { error: relErr } = await serviceClient
        .from("library_kg_entity_relations")
        .upsert({ entity_id_a: idA, entity_id_b: idB, relation_type: relation.relation_type }, { onConflict: "entity_id_a,entity_id_b,relation_type" });
      if (!relErr) relationsAdded++;
    }

    return json({ ok: true, entities_added: entitiesAdded, relations_added: relationsAdded }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-build-knowledge-graph error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
