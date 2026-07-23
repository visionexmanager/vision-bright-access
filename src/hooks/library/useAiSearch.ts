import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  runAiSearch, fetchSavedSearches, saveSearch, deleteSavedSearch, fetchSearchHistory, fetchSearchSuggestions,
  type LibraryAiSearchResult,
} from "@/services/library/aiSearch";
import { fetchBooksByIds } from "@/services/library/catalog";
import { searchEntities } from "@/services/library/knowledgeGraph";
import type { LibraryBookRow } from "@/lib/types/library-book";
import type { LibraryKgEntityRow } from "@/services/library/knowledgeGraph";

export function useAiSearch() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [raw, setRaw] = useState<LibraryAiSearchResult | null>(null);
  const [books, setBooks] = useState<LibraryBookRow[]>([]);
  const [entities, setEntities] = useState<LibraryKgEntityRow[]>([]);

  const search = async (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    setIsSearching(true);
    try {
      const result = await runAiSearch(q);
      setRaw(result);
      const [bookRows, allEntities] = await Promise.all([
        result.books.length > 0 ? fetchBooksByIds(result.books.map((b) => b.id)) : Promise.resolve([]),
        result.entities.length > 0 ? searchEntities(q, 20) : Promise.resolve([]),
      ]);
      setBooks(bookRows);
      setEntities(allEntities.filter((e) => result.entities.some((r) => r.id === e.id)));
    } catch (err) {
      toast({ title: "Search failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  return { query, isSearching, intent: raw?.intent ?? null, synonyms: raw?.synonyms ?? [], books, entities, search };
}

export function useSavedSearches() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: savedSearches = [] } = useQuery({
    queryKey: queryKeys.library.savedSearches(user?.id ?? ""),
    queryFn: () => fetchSavedSearches(user!.id),
    enabled: !!user,
  });

  const save = async (name: string, query: string) => {
    if (!user) return;
    try {
      await saveSearch(user.id, name, query);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.savedSearches(user.id) });
      toast({ title: "Search saved" });
    } catch (err) {
      toast({ title: "Couldn't save search", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteSavedSearch(id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.savedSearches(user?.id ?? "") });
    } catch (err) {
      toast({ title: "Couldn't remove search", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { savedSearches, save, remove };
}

export function useSearchHistory() {
  const { user } = useAuth();
  const { data: history = [] } = useQuery({
    queryKey: queryKeys.library.searchHistory(user?.id ?? ""),
    queryFn: () => fetchSearchHistory(user!.id),
    enabled: !!user,
  });
  return { history };
}

export function useSearchSuggestions(prefix: string) {
  const { data: suggestions = [] } = useQuery({
    queryKey: queryKeys.library.searchSuggestions(prefix),
    queryFn: () => fetchSearchSuggestions(prefix),
    enabled: prefix.trim().length >= 2,
  });
  return { suggestions };
}
