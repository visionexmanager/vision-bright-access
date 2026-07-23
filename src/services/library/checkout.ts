// ─── Library — Checkout Service (Phase 9) ─────────────────────────────────
// Client wrapper for the library-checkout-session edge function, which
// handles every pricing model that isn't a plain VX one-time purchase
// (library-purchase-book, untouched, still handles that simple case).
// Mirrors services/library/aiChat.ts's fetch-based invocation (needed here
// too since the response for the VX path is plain JSON but shaped
// differently per pricing model, and the cash path returns a checkout URL —
// supabase.functions.invoke works fine for both, unlike the streaming chat
// case, so this uses invoke() directly rather than raw fetch).

import { supabase } from "@/integrations/supabase/client";

export interface LibraryCheckoutRequest {
  book_id?: string;
  bundle_id?: string;
  payment_method: "vx" | "cash";
  pricing_model: "paid" | "rental" | "bundle" | "subscription" | "donation" | "license";
  coupon_code?: string;
  country_code?: string;
  /** subscription only. */
  plan?: "monthly" | "yearly";
  /** donation only — falls back to the book's suggested_donation_usd server-side if omitted. */
  amount_usd?: number;
  amount_vx?: number;
  message?: string;
  /** Gift purchase (pricing_model "paid" only) — recipient resolved server-side, never client-side. */
  recipient_email?: string;
  gift_message?: string;
  /** License purchase only. */
  license_type?: "individual" | "corporate" | "educational" | "family";
  seat_count?: number;
}

export interface LibraryCheckoutResult {
  ok: true;
  /** Present for the VX path (completes synchronously) — absent for cash. */
  completed?: boolean;
  /** Present for the cash path — redirect the browser here. */
  checkoutUrl?: string;
}

export async function startLibraryCheckout(req: LibraryCheckoutRequest): Promise<LibraryCheckoutResult> {
  const { data, error } = await supabase.functions.invoke("library-checkout-session", { body: req });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as LibraryCheckoutResult;
}
