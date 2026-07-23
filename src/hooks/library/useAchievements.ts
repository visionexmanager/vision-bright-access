import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchAllAchievements, fetchMyEarnedAchievementIds } from "@/services/library/achievements";

export function useAchievements() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data: achievements = [], isLoading: isLoadingAchievements } = useQuery({
    queryKey: queryKeys.library.achievements(),
    queryFn: fetchAllAchievements,
  });

  const { data: earnedIds = new Set<string>(), isLoading: isLoadingEarned } = useQuery({
    queryKey: queryKeys.library.myAchievements(uid ?? ""),
    queryFn: () => fetchMyEarnedAchievementIds(uid!),
    enabled: !!uid,
  });

  return {
    achievements,
    earnedIds,
    isEarned: (achievementId: string) => earnedIds.has(achievementId),
    isLoading: isLoadingAchievements || isLoadingEarned,
  };
}
