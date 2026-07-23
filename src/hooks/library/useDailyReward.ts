import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchTodaysClaim, claimDailyReward } from "@/services/library/dailyReward";

export function useDailyReward() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;
  const [isClaiming, setIsClaiming] = useState(false);

  const { data: todaysClaim, isLoading } = useQuery({
    queryKey: queryKeys.library.todaysDailyReward(uid ?? ""),
    queryFn: () => fetchTodaysClaim(uid!),
    enabled: !!uid,
  });

  const claim = useCallback(async () => {
    if (!uid || todaysClaim) return;
    setIsClaiming(true);
    try {
      const result = await claimDailyReward();
      toast({ title: `+${result.vx_awarded} VX`, description: `Day ${result.streak_day} streak reward claimed` });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.todaysDailyReward(uid) });
    } catch (err) {
      toast({ title: "Couldn't claim reward", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsClaiming(false);
    }
  }, [uid, todaysClaim, queryClient]);

  return { todaysClaim: todaysClaim ?? null, isLoading, isClaiming, canClaim: !!uid && !todaysClaim, claim };
}
