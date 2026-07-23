import { useCallback, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { runSemanticSearch } from "@/services/library/semanticSearch";
import type { LibraryBookRow } from "@/lib/types/library-book";

export function useSemanticSearch() {
  const [results, setResults] = useState<LibraryBookRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const books = await runSemanticSearch(query);
      setResults(books);
    } catch (err) {
      toast({ title: "Semantic search failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  }, []);

  return { results, isSearching, search };
}
