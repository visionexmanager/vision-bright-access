import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchPublishedLearningPaths, fetchMyCreatedLearningPaths, createLearningPath,
  type LearningPathInput,
} from "@/services/library/learningPaths";

export function useLearningPaths(scope: "published" | "mine" = "published") {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const { data: paths = [], isLoading } = useQuery({
    queryKey: queryKeys.library.learningHubPaths(scope === "mine" ? `mine-${uid ?? ""}` : "published"),
    queryFn: () => (scope === "mine" ? fetchMyCreatedLearningPaths(uid!) : fetchPublishedLearningPaths()),
    enabled: scope === "published" || !!uid,
    staleTime: 5 * 60 * 1000,
  });

  const create = async (input: LearningPathInput) => {
    if (!uid) return null;
    try {
      const path = await createLearningPath(uid, input);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.learningHubPaths("published") });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.learningHubPaths(`mine-${uid}`) });
      return path;
    } catch (err) {
      toast({ title: "Couldn't create learning path", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    }
  };

  return { paths, isLoading, create };
}
