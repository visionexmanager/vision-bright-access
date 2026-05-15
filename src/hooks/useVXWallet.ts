import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrial } from "@/hooks/useTrial";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export function useVXWallet() {
  const { user } = useAuth();
  const { isOnTrial } = useTrial();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: balance = 0, isLoading } = useQuery({
    queryKey: ["points-total", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_points")
        .select("points")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).reduce((sum, r) => sum + r.points, 0);
    },
  });

  const spendVX = useCallback(
    async (amount: number, itemType: string, itemName: string, itemId?: string) => {
      if (!user) {
        toast({ title: t("vxWallet.loginRequired"), description: t("vxWallet.loginRequiredDesc"), variant: "destructive" });
        return false;
      }

      // Free trial bypasses usage charges while users can still earn VX for later upgrades.
      if (isOnTrial) {
        toast({ title: t("vxWallet.freeTrialActive"), description: t("vxWallet.freeTrialDesc").replace("{item}", itemName) });
        return true;
      }

      if (balance < amount) {
        toast({ title: t("vxWallet.insufficientVX"), description: t("vxWallet.insufficientVXDesc").replace("{needed}", amount.toLocaleString()).replace("{balance}", balance.toLocaleString()), variant: "destructive" });
        return false;
      }

      const { error } = await supabase.rpc("spend_vx", {
        _amount: amount,
        _item_type: itemType,
        _item_id: itemId ?? null,
        _item_name: itemName,
      });

      if (error) {
        toast({ title: t("vxWallet.purchaseFailed"), description: error.message, variant: "destructive" });
        return false;
      }

      // Invalidate balance & points queries
      queryClient.invalidateQueries({ queryKey: ["points-total", user.id] });
      queryClient.invalidateQueries({ queryKey: ["points-history", user.id] });

      return true;
    },
    [user, isOnTrial, balance, queryClient, t]
  );

  return { balance, isLoading, spendVX };
}
