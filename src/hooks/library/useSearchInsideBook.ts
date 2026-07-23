import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { searchInsideBook } from "@/services/library/inBookSearch";

export function useSearchInsideBook(bookId: string | undefined) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: queryKeys.library.searchInsideBook(bookId ?? "", debounced),
    queryFn: () => searchInsideBook(bookId!, debounced),
    enabled: !!bookId && debounced.length >= 2,
  });

  return { query, setQuery, results, isLoading, isSearching: debounced.length >= 2 };
}
