/**
 * useReaderAnalytics — the signed-in viewer's own reading stats for one
 * book, via get_library_reader_analytics_summary() (Phase 6 migration) —
 * needed because library_analytics_events SELECT is admin-only.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/api/queryKeys";

export interface LibraryReaderAnalyticsSummary {
  reading_time_seconds: number;
  pages_read: number;
  sessions_count: number;
  last_activity_at: string | null;
}

export function useReaderAnalytics(bookId: string | undefined) {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.readerAnalytics(bookId ?? "", uid),
    queryFn: async (): Promise<LibraryReaderAnalyticsSummary | null> => {
      const { data, error } = await supabase.rpc("get_library_reader_analytics_summary", { _book_id: bookId });
      if (error) throw new Error(error.message);
      return (data ?? [])[0] ?? null;
    },
    enabled: !!bookId && !!user,
  });

  return { summary: data ?? null, isLoading };
}
