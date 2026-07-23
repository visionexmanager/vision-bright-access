import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBundlesForBook } from "@/services/library/pricing";

export function useBundlesForBook(bookId: string | undefined) {
  const { data: bundles = [], isLoading } = useQuery({
    queryKey: queryKeys.library.bundlesForBook(bookId ?? ""),
    queryFn: () => fetchBundlesForBook(bookId!),
    enabled: !!bookId,
  });
  return { bundles, isLoading };
}
