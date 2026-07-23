/**
 * useMostListenedAudiobooks — "most listened" rail: ranks book ids via the
 * 30-day rolling get_library_most_listened_books() RPC, then hydrates the
 * matching audiobook rows for display, preserving rank order.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchAudiobooksByBookIds } from "@/services/library/audiobooks";

export function useMostListenedAudiobooks(limit = 12) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.mostListenedAudiobooks(limit),
    queryFn: async () => {
      const { data: ranked, error } = await supabase.rpc("get_library_most_listened_books", { _limit: limit });
      if (error) throw new Error(error.message);
      const bookIds = (ranked ?? []).map((r: { book_id: string }) => r.book_id);
      return fetchAudiobooksByBookIds(bookIds);
    },
    staleTime: 15 * 60 * 1000,
  });
  return { audiobooks: data ?? [], isLoading };
}
