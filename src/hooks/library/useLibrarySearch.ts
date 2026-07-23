/**
 * useLibrarySearch — thin wrapper around lib/library/globalSearch.ts.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { runLibrarySearch } from "@/lib/library/globalSearch";

export function useLibrarySearch(query: string) {
  const q = query.trim();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.search(q),
    queryFn: () => runLibrarySearch(q),
    enabled: !!q,
  });
  return { results: data ?? { books: [], authors: [], audiobooks: [], isFuzzyMatch: false }, isLoading };
}
