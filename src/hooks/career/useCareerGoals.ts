// ─── useCareerGoals — the signed-in user's career roadmap goals (Phase 1) ─────

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyCareerGoals, createCareerGoal, updateCareerGoalProgress, deleteCareerGoal, type NewCareerGoal } from "@/services/career/goals";

export function useCareerGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.career.goals(user?.id ?? ""),
    queryFn: () => fetchMyCareerGoals(user!.id),
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.career.goals(user?.id ?? "") });

  const { mutateAsync: createGoal, isPending: isCreating } = useMutation({
    mutationFn: (goal: NewCareerGoal) => createCareerGoal(user!.id, goal),
    onSuccess: invalidate,
  });

  const { mutateAsync: updateProgress, isPending: isUpdating } = useMutation({
    mutationFn: (args: { goalId: string; progress: number }) => updateCareerGoalProgress(args.goalId, args.progress),
    onSuccess: invalidate,
  });

  const { mutateAsync: removeGoal, isPending: isRemoving } = useMutation({
    mutationFn: (goalId: string) => deleteCareerGoal(goalId),
    onSuccess: invalidate,
  });

  return {
    goals: data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
    createGoal,
    isCreating,
    updateProgress,
    isUpdating,
    removeGoal,
    isRemoving,
  };
}
