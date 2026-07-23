/**
 * useReadingCoach — stats-derived reading pace/goals (get_library_reading_
 * coach_stats RPC, no LLM call) plus an optional one-shot "tips" generative
 * call layered on top. See the Phase 6.5 plan: reading speed/estimate/goal
 * progress are arithmetic on real data, not model-guessed.
 */

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/api/queryKeys";
import { runLibraryAiAssistant } from "@/services/library/aiAssistant";
import type { ReadingCoachStats } from "@/lib/types/library-ai";

export function useReadingCoach(bookId: string | undefined) {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const [tips, setTips] = useState<string[] | null>(null);
  const [isLoadingTips, setIsLoadingTips] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.library.readingCoach(bookId ?? "", uid),
    queryFn: async (): Promise<ReadingCoachStats | null> => {
      const { data, error } = await supabase.rpc("get_library_reading_coach_stats", { _book_id: bookId });
      if (error) throw new Error(error.message);
      return (data ?? [])[0] ?? null;
    },
    enabled: !!bookId && !!user,
  });

  const generateTips = useCallback(async () => {
    if (!bookId) return;
    setIsLoadingTips(true);
    try {
      const res = await runLibraryAiAssistant({ mode: "reading-coach-tips", book_id: bookId });
      if (res.mode === "reading-coach-tips") setTips(res.result.tips);
    } catch (err) {
      toast({ title: "Couldn't get reading tips", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsLoadingTips(false);
    }
  }, [bookId]);

  return { stats: stats ?? null, isLoading, tips, isLoadingTips, generateTips };
}
