import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBookEditions, createBookEdition } from "@/services/library/bookEditions";

export function useBookEditions(bookId: string | undefined) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const { data: editions = [], isLoading } = useQuery({
    queryKey: queryKeys.library.bookEditions(bookId ?? ""),
    queryFn: () => fetchBookEditions(bookId!),
    enabled: !!bookId,
  });

  const createEdition = useCallback(async (label: string, summary: string) => {
    if (!bookId || !label.trim()) return;
    setIsCreating(true);
    try {
      await createBookEdition(bookId, label.trim(), summary.trim() || null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.bookEditions(bookId) });
      toast({ title: "Edition archived" });
    } catch (err) {
      toast({ title: "Couldn't create edition", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  }, [bookId, queryClient]);

  return { editions, isLoading, createEdition, isCreating };
}
