// ─── Library — Semantic Search Service (Phase 10) ─────────────────────────
// Client wrapper for the library-semantic-search edge function.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookRow } from "@/lib/types/library-book";
import { fetchBooksByIds } from "@/services/library/catalog";

export async function runSemanticSearch(query: string, limit = 20): Promise<LibraryBookRow[]> {
  const { data, error } = await supabase.functions.invoke("library-semantic-search", { body: { query, limit } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  const results = (data?.results ?? []) as Array<{ id: string; similarity: number }>;
  return fetchBooksByIds(results.map((r) => r.id));
}
