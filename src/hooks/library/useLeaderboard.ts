import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchLeaderboard, type LibraryLeaderboardMetric, type LibraryLeaderboardPeriod } from "@/services/library/leaderboard";

export function useLeaderboard(metric: LibraryLeaderboardMetric, period: LibraryLeaderboardPeriod) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: queryKeys.library.leaderboard(metric, period),
    queryFn: () => fetchLeaderboard(metric, period),
    staleTime: 5 * 60 * 1000,
  });
  return { entries, isLoading };
}
