import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchLearningPathById, fetchLearningPathItems, fetchMyLearningPathEnrollment,
  enrollInLearningPath, fetchLearningPathProgress, completeLearningPathItem,
  addLearningPathItem, removeLearningPathItem, type LearningPathItemInput,
} from "@/services/library/learningPaths";

export function useLearningPath(pathId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const { data: path, isLoading: isLoadingPath } = useQuery({
    queryKey: queryKeys.library.learningHubPath(pathId ?? ""),
    queryFn: () => fetchLearningPathById(pathId!),
    enabled: !!pathId,
  });

  const { data: items = [], isLoading: isLoadingItems } = useQuery({
    queryKey: queryKeys.library.learningHubPathItems(pathId ?? ""),
    queryFn: () => fetchLearningPathItems(pathId!),
    enabled: !!pathId,
  });

  const { data: enrollment } = useQuery({
    queryKey: queryKeys.library.learningHubEnrollment(uid ?? "", pathId ?? ""),
    queryFn: () => fetchMyLearningPathEnrollment(uid!, pathId!),
    enabled: !!uid && !!pathId,
  });

  const { data: progress = [], refetch: refetchProgress } = useQuery({
    queryKey: queryKeys.library.learningHubPathProgress(pathId ?? ""),
    queryFn: () => fetchLearningPathProgress(pathId!),
    enabled: !!uid && !!pathId && !!enrollment,
  });

  const invalidateEnrollment = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.learningHubEnrollment(uid ?? "", pathId ?? "") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.learningHubEnrollments(uid ?? "") });
  };

  const enroll = async () => {
    if (!pathId) return;
    try {
      await enrollInLearningPath(pathId);
      invalidateEnrollment();
      toast({ title: "Enrolled!", description: "You're now enrolled in this learning path." });
    } catch (err) {
      toast({ title: "Couldn't enroll", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const completeItem = async (itemId: string, scorePercent?: number | null) => {
    try {
      await completeLearningPathItem(itemId, scorePercent);
      await refetchProgress();
      invalidateEnrollment();
    } catch (err) {
      toast({ title: "Couldn't update progress", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const addItem = async (input: LearningPathItemInput) => {
    if (!pathId) return;
    try {
      await addLearningPathItem(pathId, input);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.learningHubPathItems(pathId) });
    } catch (err) {
      toast({ title: "Couldn't add item", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeItem = async (itemId: string) => {
    if (!pathId) return;
    try {
      await removeLearningPathItem(itemId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.learningHubPathItems(pathId) });
    } catch (err) {
      toast({ title: "Couldn't remove item", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return {
    path, items, enrollment, progress,
    isLoading: isLoadingPath || isLoadingItems,
    enroll, completeItem, addItem, removeItem,
  };
}
