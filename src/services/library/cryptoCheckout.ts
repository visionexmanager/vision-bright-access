// ─── Library — Crypto Checkout Service (Phase 10) ─────────────────────────
// Client wrapper for the library-crypto-checkout edge function (Coinbase
// Commerce). See that function's header for the untested-in-this-sandbox
// caveat.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryCheckoutResult } from "@/services/library/checkout";

export interface LibraryCryptoCheckoutRequest {
  book_id?: string;
  bundle_id?: string;
  pricing_model: "paid" | "rental" | "bundle" | "donation";
  coupon_code?: string;
  country_code?: string;
  amount_usd?: number;
  message?: string;
}

export async function startCryptoCheckout(req: LibraryCryptoCheckoutRequest): Promise<LibraryCheckoutResult> {
  const { data, error } = await supabase.functions.invoke("library-crypto-checkout", { body: req });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as LibraryCheckoutResult;
}
