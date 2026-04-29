import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrial } from "@/hooks/useTrial";
import { toast } from "@/hooks/use-toast";

export function useVXWallet() {
  const { user } = useAuth();
  const { isOnTrial } = useTrial();
  const queryClient = useQueryClient();

  const { data: balance = 0, isLoading } = useQuery({
    queryKey: ["vx-balance", user?.id],
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
        toast({ title: "Login required", description: "Please log in to make purchases.", variant: "destructive" });
        return false;
      }

      // Free trial — bypass all charges
      if (isOnTrial) {
        toast({ title: "Free trial active ✓", description: `${itemName} is free during your trial period.` });
        return true;
      }

      if (balance < amount) {
        toast({ title: "Insufficient VX", description: `You need ${amount.toLocaleString()} VX but only have ${balance.toLocaleString()} VX.`, variant: "destructive" });
        return false;
      }

      const { error } = await supabase.rpc("spend_vx", {
        _amount: amount,
        _item_type: itemType,
        _item_id: itemId ?? null,
        _item_name: itemName,
      });

      if (error) {
        toast({ title: "Purchase failed", description: error.message, variant: "destructive" });
        return false;
      }

      // Invalidate balance & points queries
      queryClient.invalidateQueries({ queryKey: ["vx-balance", user.id] });
      queryClient.invalidateQueries({ queryKey: ["points-total", user.id] });
      queryClient.invalidateQueries({ queryKey: ["points-history", user.id] });

      return true;
    },
    [user, balance, queryClient]
  );

  return { balance, isLoading, spendVX };
}
