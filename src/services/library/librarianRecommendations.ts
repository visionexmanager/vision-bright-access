// ─── Library — AI Personal Librarian: Recommendations Feed ────────────────

import { supabase } from "@/integrations/supabase/client";

export type LibraryLibrarianRecommendationType =
  | "book" | "audiobook" | "article" | "course" | "author"
  | "book_club" | "learning_path" | "challenge" | "event" | "research_topic";

export interface LibraryLibrarianRecommendationRow {
  id: string;
  user_id: string;
  recommendation_type: LibraryLibrarianRecommendationType;
  entity_id: string;
  title: string;
  reason: string | null;
  score: number;
  is_dismissed: boolean;
  created_at: string;
  /** Resolved client-side for types whose real route uses a slug, not the
   *  raw UUID (book_club, research_topic) — entity_id stays a UUID in the
   *  DB column, this is purely a render-time lookup, same technique as
   *  fetchTrendingTopics/fetchKnowledgeMap. */
  slug?: string;
}

export async function fetchRecommendations(userId: string): Promise<LibraryLibrarianRecommendationRow[]> {
  const { data, error } = await supabase
    .from("library_librarian_recommendations")
    .select("*")
    .eq("user_id", userId)
    .eq("is_dismissed", false)
    .order("score", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as LibraryLibrarianRecommendationRow[];

  const clubIds = rows.filter((r) => r.recommendation_type === "book_club").map((r) => r.entity_id);
  const topicIds = rows.filter((r) => r.recommendation_type === "research_topic").map((r) => r.entity_id);
  const [clubs, topics] = await Promise.all([
    clubIds.length > 0 ? supabase.from("library_clubs").select("id, slug").in("id", clubIds) : Promise.resolve({ data: [], error: null }),
    topicIds.length > 0 ? supabase.from("library_kg_entities").select("id, slug").in("id", topicIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const slugById = new Map([...(clubs.data ?? []), ...(topics.data ?? [])].map((r: { id: string; slug: string }) => [r.id, r.slug]));
  return rows.map((r) => (slugById.has(r.entity_id) ? { ...r, slug: slugById.get(r.entity_id) } : r));
}

export async function dismissRecommendation(id: string): Promise<void> {
  const { error } = await supabase.from("library_librarian_recommendations").update({ is_dismissed: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function regenerateRecommendations(): Promise<number> {
  const { data, error } = await supabase.functions.invoke("library-librarian-recommendations", { body: {} });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.generated as number;
}

export function recommendationLinkPath(rec: LibraryLibrarianRecommendationRow): string {
  switch (rec.recommendation_type) {
    case "book":
    case "audiobook":
      return `/library/books/${rec.entity_id}`;
    case "author":
      return `/library/authors/${rec.entity_id}`;
    case "book_club":
      return rec.slug ? `/library/clubs/${rec.slug}` : "/library/clubs";
    case "learning_path":
      return `/library/learning-paths/${rec.entity_id}`;
    case "challenge":
      return `/library/challenges`;
    case "event":
      return `/library/events`;
    case "research_topic":
      return rec.slug ? `/library/knowledge-graph/${rec.slug}` : "/library/knowledge-graph";
    default:
      return "/library";
  }
}
