/**
 * useAlternatePaymentCheckout — same redirect-on-checkoutUrl shape as
 * useLibraryCheckout, but dispatches to whichever rail's edge function the
 * caller picked (Stripe cash via the existing library-checkout-session,
 * or the new PayPal/crypto functions). One hook so PurchaseOptionsDialog
 * doesn't need three near-identical call sites.
 */

import { useCallback, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { startLibraryCheckout } from "@/services/library/checkout";
import { startPaypalCheckout } from "@/services/library/paypalCheckout";
import { startCryptoCheckout } from "@/services/library/cryptoCheckout";

export type PaymentRail = "cash" | "paypal" | "crypto";

export interface AlternatePaymentRequest {
  book_id?: string;
  bundle_id?: string;
  pricing_model: "paid" | "rental" | "bundle" | "donation";
  coupon_code?: string;
  country_code?: string;
  amount_usd?: number;
  message?: string;
}

export function useAlternatePaymentCheckout() {
  const [isProcessing, setIsProcessing] = useState(false);

  const checkout = useCallback(async (rail: PaymentRail, req: AlternatePaymentRequest) => {
    setIsProcessing(true);
    try {
      const result = rail === "cash"
        ? await startLibraryCheckout({ ...req, payment_method: "cash" })
        : rail === "paypal"
        ? await startPaypalCheckout(req)
        : await startCryptoCheckout(req);

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return result;
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
