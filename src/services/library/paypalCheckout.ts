// ─── Library — PayPal Checkout Service (Phase 10) ─────────────────────────
// Client wrapper for the library-paypal-checkout edge function. See that
// function's header for the untested-in-this-sandbox caveat.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryCheckoutResult } from "@/services/library/checkout";

export interface LibraryPaypalCheckoutRequest {
  book_id?: string;
  bundle_id?: string;
  pricing_model: "paid" | "rental" | "bundle" | "donation";
  coupon_code?: string;
  country_code?: string;
  amount_usd?: number;
  message?: string;
}

export async function startPaypalCheckout(req: LibraryPaypalCheckoutRequest): Promise<LibraryCheckoutResult> {
  const { data, error } = await supabase.functions.invoke("library-paypal-checkout", { body: req });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as LibraryCheckoutResult;
}
