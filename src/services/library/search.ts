// ─── Library — Search History Service (Phase 3) ────────────────────────────────
// Per-user search history (own rows only, RLS "user manages own"). Distinct
// from stats.ts's fetchPopularSearches(), which aggregates ACROSS all users
// via a SECURITY DEFINER RPC — this file only ever touches the calling
// user's own rows, no RPC needed.

import { supabase } from "@/integrations/supabase/client";

export async function fetchRecentSearches(userId: string, limit = 5): Promise<string[]> {
  const { data, error } = await supabase
    .from("library_search_history")
    .select("query")
    .eq("user_id", userId)
    .order("searched_at", { ascending: false })
    .limit(limit * 3); // over-fetch, then dedupe below
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of data ?? []) {
    const q = row.query.trim();
    if (!q || seen.has(q)) continue;
    seen.add(q);
    result.push(q);
    if (result.length >= limit) break;
  }
  return result;
}

export async function logSearch(userId: string, query: string, resultsCount: number): Promise<void> {
  const { error } = await supabase.from("library_search_history").insert({ user_id: userId, query, results_count: resultsCount });
  if (error) console.error("Failed to log search history:", error.message);
}
