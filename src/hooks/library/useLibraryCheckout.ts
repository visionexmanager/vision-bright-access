/**
 * useLibraryCheckout — action-triggered checkout for every pricing model
 * that isn't a plain VX one-time purchase (see usePurchaseBook.ts for
 * that simpler existing case, unchanged). On success with a checkoutUrl,
 * the caller should redirect the browser there; a `completed` VX result
 * means it's already done.
 */

import { useCallback, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { startLibraryCheckout, type LibraryCheckoutRequest } from "@/services/library/checkout";

export function useLibraryCheckout() {
  const [isProcessing, setIsProcessing] = useState(false);

  const checkout = useCallback(async (req: LibraryCheckoutRequest) => {
    setIsProcessing(true);
    try {
      const result = await startLibraryCheckout(req);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return result;
      }
      if (result.completed) {
        toast({ title: "Purchase complete" });
      }
      return result;
    } catch (err) {
      toast({ title: "Checkout failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { checkout, isProcessing };
}
