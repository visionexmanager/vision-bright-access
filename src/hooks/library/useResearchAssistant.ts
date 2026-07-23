import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  runResearchAssistant, fetchResearchAnalyses, deleteResearchAnalysis,
  type LibraryResearchMode, type LibraryResearchResult,
} from "@/services/library/researchAssistant";

export function useResearchAssistant() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<LibraryResearchMode>("compare_books");
  const [result, setResult] = useState<LibraryResearchResult | null>(null);

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: queryKeys.library.researchAnalyses(user?.id ?? ""),
    queryFn: () => fetchResearchAnalyses(user!.id),
    enabled: !!user,
  });

  const run = async (params: { bookIds?: string[]; authorIds?: string[]; topic?: string; title?: string }) => {
    setIsRunning(true);
    setResult(null);
    try {
      const response = await runResearchAssistant({
        mode, book_ids: params.bookIds, author_ids: params.authorIds, topic: params.topic, title: params.title,
      });
      setResult(response.result);
      if (response.analysis_id && user) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.library.researchAnalyses(user.id) });
      }
      return response.result;
    } catch (err) {
      toast({ title: "Analysis failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsRunning(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteResearchAnalysis(id);
      if (user) void queryClient.invalidateQueries({ queryKey: queryKeys.library.researchAnalyses(user.id) });
    } catch (err) {
      toast({ title: "Couldn't delete", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { mode, setMode, isRunning, result, setResult, run, analyses, isLoadingAnalyses: isLoading, remove };
}
