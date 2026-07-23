/**
 * useLibraryCart — a real, localStorage-backed cart (not a DB table).
 * Justification: Library checkout is fundamentally single-book/instant —
 * the actual "buy several books together" case is bundles, already handled
 * end-to-end by library-checkout-session's bundle branch. This cart exists
 * for the "add a few different books, then check out" flow the spec asks
 * for; "Checkout All" processes each item as its own purchase call in
 * sequence (VX completes synchronously per item; a cash item redirects to
 * its own Stripe session, so cash checkout is one-item-at-a-time by
 * necessity — reported clearly in the UI, not hidden).
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { purchaseBookWithVx } from "@/services/library/purchases";
import { startLibraryCheckout } from "@/services/library/checkout";

const STORAGE_KEY = "library:cart";

export interface CartItem {
  bookId: string;
  title: string;
  coverImageUrl: string | null;
  priceUsd: number | null;
  priceVx: number | null;
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Best-effort only.
  }
}

export function useLibraryCart() {
  const [items, setItems] = useState<CartItem[]>(readCart);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => writeCart(items), [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => (prev.some((i) => i.bookId === item.bookId) ? prev : [...prev, item]));
  }, []);

  const removeItem = useCallback((bookId: string) => {
    setItems((prev) => prev.filter((i) => i.bookId !== bookId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const checkoutAllWithVx = useCallback(async () => {
    setIsCheckingOut(true);
    let succeeded = 0;
    const failed: string[] = [];
    try {
      for (const item of items) {
        try {
          if (item.priceVx) {
            await purchaseBookWithVx(item.bookId);
          } else {
            await startLibraryCheckout({ book_id: item.bookId, payment_method: "vx", pricing_model: "paid" });
          }
          succeeded += 1;
        } catch {
          failed.push(item.title);
        }
      }
      setItems((prev) => prev.filter((i) => failed.includes(i.title)));
      if (succeeded > 0) toast({ title: `Purchased ${succeeded} book${succeeded === 1 ? "" : "s"}` });
      if (failed.length > 0) toast({ title: "Some items couldn't be purchased", description: failed.join(", "), variant: "destructive" });
    } finally {
      setIsCheckingOut(false);
    }
  }, [items]);

  const totalUsd = items.reduce((sum, i) => sum + (i.priceUsd ?? 0), 0);
  const totalVx = items.reduce((sum, i) => sum + (i.priceVx ?? 0), 0);

  return { items, addItem, removeItem, clear, checkoutAllWithVx, isCheckingOut, totalUsd, totalVx };
}
