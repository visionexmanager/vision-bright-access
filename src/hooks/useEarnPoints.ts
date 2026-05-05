import { useCallback } from "react";
import { EARNING_RATES } from "@/systems/pricingSystem";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

/** Maximum rewarded-ad watches per user per calendar day */
export const DAILY_AD_LIMIT = 10;

export function useEarnPoints() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const earnPoints = useCallback(
    async (points: number, reason: string) => {
      if (!user) return false;
      const { error } = await supabase.rpc("award_points", {
        _points: points,
        _reason: reason,
      });
      if (error) {
        console.error("award_points error:", error.message);
        return false;
      }
      queryClient.invalidateQueries({ queryKey: ["points-total", user.id] });
      queryClient.invalidateQueries({ queryKey: ["points-history", user.id] });
      return true;
    },
    [user, queryClient]
  );

  const checkDailyLogin = useCallback(async () => {
    if (!user) return false;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("user_points")
      .select("id")
      .eq("user_id", user.id)
      .eq("reason", "Daily login bonus")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);
    return (data?.length ?? 0) > 0;
  }, [user]);

  /**
   * Returns how many rewarded ads the user has already watched today.
   * Cap is DAILY_AD_LIMIT (10).
   */
  const getTodayAdCount = useCallback(async (): Promise<number> => {
    if (!user) return DAILY_AD_LIMIT; // treat as maxed if not logged in
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("user_points")
      .select("id")
      .eq("user_id", user.id)
      .eq("reason", "Watched an ad")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);
    return data?.length ?? 0;
  }, [user]);

  return { earnPoints, checkDailyLogin, getTodayAdCount };
}
