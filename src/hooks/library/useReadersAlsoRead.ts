/**
 * useReadersAlsoRead — thin useQuery wrapper over
 * services/library/relatedBooks.ts's get_library_readers_also_read() RPC.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchReadersAlsoRead } from "@/services/library/relatedBooks";

export function useReadersAlsoRead(bookId: string | undefined, limit = 8) {
  const { data: books = [], isLoading } = useQuery({
    queryKey: queryKeys.library.readersAlsoRead(bookId ?? ""),
    queryFn: () => fetchReadersAlsoRead(bookId!, limit),
    enabled: !!bookId,
  });
  return { books, isLoading };
}
