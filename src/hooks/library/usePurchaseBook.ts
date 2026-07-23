/**
 * usePurchaseBook — "Purchase with VX" for the Book Details action bar.
 * Wraps services/library/purchases.ts; on success invalidates useBookAccess's
 * own purchase-check query key so "Read now"/"Download" unlock immediately
 * without a page refresh.
 */

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { purchaseBookWithVx } from "@/services/library/purchases";

export function usePurchaseBook(bookId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const purchase = useCallback(async (): Promise<boolean> => {
    if (!bookId || !user) return false;
    setIsPurchasing(true);
    try {
      const result = await purchaseBookWithVx(bookId);
      if (result.alreadyOwned) {
        toast({ title: "You already own this book" });
      } else {
        toast({ title: "Purchase complete", description: "This book has been added to your library." });
      }
      queryClient.invalidateQueries({ queryKey: ["library", "access-purchase", bookId, user.id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.points.total(user.id) });
      return true;
    } catch (err) {
      toast({ title: "Purchase failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return false;
    } finally {
      setIsPurchasing(false);
    }
  }, [bookId, user, queryClient]);

  return { purchase, isPurchasing };
}
