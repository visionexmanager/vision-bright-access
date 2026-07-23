import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchLibrarianGoals, createLibrarianGoal, updateLibrarianGoalStatus, deleteLibrarianGoal,
  type LibraryLibrarianGoalCategory, type LibraryLibrarianGoalStatus,
} from "@/services/library/librarianGoals";

export function useLibrarianGoals() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: queryKeys.library.librarianGoals(uid),
    queryFn: () => fetchLibrarianGoals(uid),
    enabled: !!user,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.librarianGoals(uid) });

  const addGoal = async (category: LibraryLibrarianGoalCategory, title: string, description?: string, targetDate?: string) => {
    if (!user || !title.trim()) return;
    try {
      await createLibrarianGoal(user.id, category, title.trim(), description, targetDate);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't add goal", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const setStatus = async (goalId: string, status: LibraryLibrarianGoalStatus) => {
    try {
      await updateLibrarianGoalStatus(goalId, status);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't update goal", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeGoal = async (goalId: string) => {
    try {
      await deleteLibrarianGoal(goalId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't remove goal", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { goals, isLoading, addGoal, setStatus, removeGoal };
}
