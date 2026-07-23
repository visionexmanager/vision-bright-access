// ─── Library — Knowledge Graph Service (Phase 11, widened Phase 14
// Knowledge & Research Platform with more entity types, non-book content
// links, semantic entity matching, knowledge maps, and trending topics) ────
// Client wrapper for library-build-knowledge-graph + reads of the
// persistent, cross-book entity graph it populates.

import { supabase } from "@/integrations/supabase/client";

export type LibraryKgEntityType =
  | "author" | "topic" | "character" | "historical_event" | "scientific_concept" | "location" | "organization" | "person"
  | "technology" | "language" | "skill" | "publisher";

export interface LibraryKgEntityRow {
  id: string;
  entity_type: LibraryKgEntityType;
  name: string;
  slug: string;
  description: string | null;
}

export interface LibraryKgConnectedEntity extends LibraryKgEntityRow {
  relation_type: string;
}

export interface LibraryKgConnectedBook {
  id: string;
  title: string;
  slug: string;
  cover_image_url: string | null;
  author_name: string;
}

export async function buildKnowledgeGraphForBook(bookId: string): Promise<{ entitiesAdded: number; relationsAdded: number }> {
  const { data, error } = await supabase.functions.invoke("library-build-knowledge-graph", { body: { book_id: bookId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { entitiesAdded: data.entities_added, relationsAdded: data.relations_added };
}

export async function fetchEntityBySlug(slug: string): Promise<LibraryKgEntityRow | null> {
  const { data, error } = await supabase.from("library_kg_entities").select("id, entity_type, name, slug, description").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryKgEntityRow | null;
}

export async function fetchConnectedEntities(entityId: string): Promise<LibraryKgConnectedEntity[]> {
  const [{ data: asA }, { data: asB }] = await Promise.all([
    supabase.from("library_kg_entity_relations").select("relation_type, entity:library_kg_entities!entity_id_b(id, entity_type, name, slug, description)").eq("entity_id_a", entityId),
    supabase.from("library_kg_entity_relations").select("relation_type, entity:library_kg_entities!entity_id_a(id, entity_type, name, slug, description)").eq("entity_id_b", entityId),
  ]);

  const rows = [...(asA ?? []), ...(asB ?? [])] as unknown as Array<{ relation_type: string; entity: LibraryKgEntityRow | null }>;
  return rows.filter((r) => r.entity).map((r) => ({ ...r.entity!, relation_type: r.relation_type }));
}

export async function fetchBooksForEntity(entityId: string): Promise<LibraryKgConnectedBook[]> {
  const { data, error } = await supabase
    .from("library_kg_book_entities")
    .select("library_books(id, title, slug, cover_image_url, library_authors(name))")
    .eq("entity_id", entityId);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<{ library_books: { id: string; title: string; slug: string; cover_image_url: string | null; library_authors: { name: string } | null } | null }>)
    .filter((row) => row.library_books)
    .map((row) => ({
      id: row.library_books!.id,
      title: row.library_books!.title,
      slug: row.library_books!.slug,
      cover_image_url: row.library_books!.cover_image_url,
      author_name: row.library_books!.library_authors?.name ?? "",
    }));
}

export async function searchEntities(query: string, limit = 10): Promise<LibraryKgEntityRow[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase
    .from("library_kg_entities")
    .select("id, entity_type, name, slug, description")
    .ilike("name", `%${query.trim()}%`)
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryKgEntityRow[];
}

export async function fetchEntitiesForBook(bookId: string): Promise<LibraryKgEntityRow[]> {
  const { data, error } = await supabase
    .from("library_kg_book_entities")
    .select("library_kg_entities(id, entity_type, name, slug, description)")
    .eq("book_id", bookId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ library_kg_entities: LibraryKgEntityRow | null }>)
    .filter((row) => row.library_kg_entities)
    .map((row) => row.library_kg_entities!);
}

export interface LibraryKgContentLink {
  contentType: "audiobook" | "academy_course";
  contentId: string;
  context: string | null;
}

/** Audiobooks/Academy courses linked to a concept — books use the older,
 *  dedicated library_kg_book_entities join; other content types share this
 *  one polymorphic table since only books needed their own bespoke shape. */
export async function fetchContentLinksForEntity(entityId: string): Promise<LibraryKgContentLink[]> {
  const { data, error } = await supabase
    .from("library_kg_content_links")
    .select("content_type, content_id, context")
    .eq("entity_id", entityId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ contentType: r.content_type, contentId: r.content_id, context: r.context }));
}

export interface LibraryKnowledgeMapNode {
  entity_id: string;
  name: string;
  entity_type: LibraryKgEntityType;
  depth: number;
  relation_type: string | null;
  is_unlocked: boolean;
  slug: string;
}

// The RPC returns entity_id, not slug — resolve slugs client-side so each
// node can link to /library/knowledge-graph/:slug (the entity page's real route).
export async function fetchKnowledgeMap(rootEntityId: string, maxDepth = 2): Promise<LibraryKnowledgeMapNode[]> {
  const { data, error } = await supabase.rpc("get_library_knowledge_map", { _root_entity_id: rootEntityId, _max_depth: maxDepth });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<LibraryKnowledgeMapNode, "slug">[];
  if (rows.length === 0) return [];
  const { data: entities } = await supabase.from("library_kg_entities").select("id, slug").in("id", rows.map((r) => r.entity_id));
  const slugById = new Map((entities ?? []).map((e) => [e.id, e.slug]));
  return rows.map((r) => ({ ...r, slug: slugById.get(r.entity_id) ?? "" }));
}

export interface LibraryTrendingTopic {
  entity_id: string;
  name: string;
  entity_type: LibraryKgEntityType;
  recent_mentions: number;
  growth_ratio: number;
  slug: string;
}

// The RPC returns entity_id, not slug (it's a pure aggregate query) — resolve
// slugs client-side so the AI Insights dashboard can link straight to each
// entity's Concept Explorer page.
export async function fetchTrendingTopics(limit = 10): Promise<LibraryTrendingTopic[]> {
  const { data, error } = await supabase.rpc("get_library_trending_topics", { _limit: limit });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<LibraryTrendingTopic, "slug">[];
  if (rows.length === 0) return [];
  const { data: entities } = await supabase.from("library_kg_entities").select("id, slug").in("id", rows.map((r) => r.entity_id));
  const slugById = new Map((entities ?? []).map((e) => [e.id, e.slug]));
  return rows.map((r) => ({ ...r, slug: slugById.get(r.entity_id) ?? "" }));
}
