import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchReadingGoals, createReadingGoal, deactivateReadingGoal, fetchReadingStreak,
  type LibraryGoalType,
} from "@/services/library/readingGoals";

export function useReadingGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const { data: goals = [], isLoading } = useQuery({
    queryKey: queryKeys.library.readingGoals(uid ?? ""),
    queryFn: () => fetchReadingGoals(uid!),
    enabled: !!uid,
  });

  const { data: streak = 0 } = useQuery({
    queryKey: queryKeys.library.readingStreak(uid ?? ""),
    queryFn: () => fetchReadingStreak(uid!),
    enabled: !!uid,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.readingGoals(uid ?? "") });

  const addGoal = async (goalType: LibraryGoalType, target: number, customLabel: string | null) => {
    if (!uid) return;
    try {
      await createReadingGoal(uid, goalType, target, customLabel);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't add goal", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeGoal = async (goalId: string) => {
    try {
      await deactivateReadingGoal(goalId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't remove goal", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { goals, streak, isLoading, addGoal, removeGoal };
}
