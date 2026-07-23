// ─── Library — Purchases Service (Phase 5) ────────────────────────────────
// Wraps the library-purchase-book edge function (the trusted server step
// that debits VX via spend_vx then inserts a completed purchase — see that
// function's header for why this can't be a plain client-side insert) plus
// the has_purchased_library_book() RPC (public.library_purchases is
// RLS'd to buyer/owner/admin, so a plain client query already works for
// "did I buy this", but the RPC is reused here for consistency with
// useBookAccess's own direct-query approach — see note below).

import { supabase } from "@/integrations/supabase/client";

export interface PurchaseBookResult {
  ok: boolean;
  alreadyOwned?: boolean;
}

/** Purchases a book with VX via the library-purchase-book edge function.
 *  Throws with a user-facing message on failure (insufficient balance,
 *  book not purchasable, etc.) — callers should catch and toast it. */
export async function purchaseBookWithVx(bookId: string): Promise<PurchaseBookResult> {
  const { data, error } = await supabase.functions.invoke("library-purchase-book", { body: { book_id: bookId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { ok: true, alreadyOwned: !!data?.alreadyOwned };
}
