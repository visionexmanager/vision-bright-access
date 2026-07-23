// ─── Library — Knowledge & Research Platform: AI Semantic Search ───────────

import { supabase } from "@/integrations/supabase/client";

export interface LibraryAiSearchResult {
  intent: "book_search" | "question" | "entity_lookup" | null;
  synonyms: string[];
  books: { id: string; similarity: number }[];
  entities: { id: string; similarity: number }[];
}

export async function runAiSearch(query: string, limit = 10): Promise<LibraryAiSearchResult> {
  const { data, error } = await supabase.functions.invoke("library-ai-search", { body: { query, limit } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return { intent: data.intent, synonyms: data.synonyms ?? [], books: data.books ?? [], entities: data.entities ?? [] };
}

export interface LibrarySavedSearchRow {
  id: string;
  user_id: string;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  created_at: string;
}

export async function fetchSavedSearches(userId: string): Promise<LibrarySavedSearchRow[]> {
  const { data, error } = await supabase.from("library_saved_searches").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibrarySavedSearchRow[];
}

export async function saveSearch(userId: string, name: string, query: string, filters: Record<string, unknown> = {}): Promise<void> {
  const { error } = await supabase.from("library_saved_searches").insert({ user_id: userId, name, query, filters });
  if (error) throw new Error(error.message);
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await supabase.from("library_saved_searches").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface LibrarySearchHistoryRow {
  id: string;
  query: string;
  results_count: number | null;
  searched_at: string;
}

export async function fetchSearchHistory(userId: string, limit = 10): Promise<LibrarySearchHistoryRow[]> {
  const { data, error } = await supabase
    .from("library_search_history").select("id, query, results_count, searched_at")
    .eq("user_id", userId).order("searched_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibrarySearchHistoryRow[];
}

export async function fetchSearchSuggestions(prefix: string): Promise<{ suggestion: string; suggestion_type: string }[]> {
  if (!prefix.trim()) return [];
  const { data, error } = await supabase.rpc("get_library_search_suggestions", { _prefix: prefix.trim() });
  if (error) throw new Error(error.message);
  return (data ?? []) as { suggestion: string; suggestion_type: string }[];
}
