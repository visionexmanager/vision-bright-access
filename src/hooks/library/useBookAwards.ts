import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBookAwards } from "@/services/library/awards";

export function useBookAwards(bookId: string | undefined) {
  const { data: awards = [], isLoading } = useQuery({
    queryKey: queryKeys.library.bookAwards(bookId ?? ""),
    queryFn: () => fetchBookAwards(bookId!),
    enabled: !!bookId,
  });
  return { awards, isLoading };
}
