import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchSummaries, generateSummary, type LibrarySummaryPeriod } from "@/services/library/librarianSummaries";

export function useLibrarianSummaries(period: LibrarySummaryPeriod) {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: queryKeys.library.librarianSummaries(uid, period),
    queryFn: () => fetchSummaries(uid, period),
    enabled: !!user,
  });

  const generate = async () => {
    setIsGenerating(true);
    try {
      await generateSummary(period);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.librarianSummaries(uid, period) });
    } catch (err) {
      toast({ title: "Couldn't generate summary", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return { summaries, isLoading, isGenerating, generate };
}
