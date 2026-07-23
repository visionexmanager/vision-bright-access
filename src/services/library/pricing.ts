// ─── Library — Pricing Management Service (Phase 9) ───────────────────────
// Author-side CRUD for coupons/regional pricing/bundles. Actual checkout
// (redeeming a coupon, paying, subscribing, donating) goes through
// services/library/checkout.ts's edge-function call, never these tables
// directly — a shopper never needs to read library_coupons at all.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBundleRow, LibraryCouponRow, LibraryRegionalPriceRow, LibraryDonationRow } from "@/lib/types/library-studio";
import type { LibraryBookRow } from "@/lib/types/library-book";
import { mapRawBookRow, type RawLibraryBookRow } from "@/services/library/catalog";

// ── Coupons ─────────────────────────────────────────────────────────────

export async function fetchBookCoupons(bookId: string): Promise<LibraryCouponRow[]> {
  const { data, error } = await supabase.from("library_coupons").select("*").eq("book_id", bookId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryCouponRow[];
}

export async function createCoupon(input: {
  book_id: string;
  code: string;
  discount_type: LibraryCouponRow["discount_type"];
  discount_value: number;
  max_redemptions?: number;
  valid_from?: string;
  valid_until?: string;
  created_by: string;
}): Promise<LibraryCouponRow> {
  const { data, error } = await supabase
    .from("library_coupons")
    .insert({
      book_id: input.book_id,
      code: input.code.trim().toUpperCase(),
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      max_redemptions: input.max_redemptions ?? null,
      valid_from: input.valid_from ?? null,
      valid_until: input.valid_until ?? null,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as LibraryCouponRow;
}

export async function setCouponActive(couponId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("library_coupons").update({ is_active: isActive }).eq("id", couponId);
  if (error) throw new Error(error.message);
}

// ── Regional pricing ────────────────────────────────────────────────────

export async function fetchRegionalPrices(bookId: string): Promise<LibraryRegionalPriceRow[]> {
  const { data, error } = await supabase.from("library_regional_prices").select("*").eq("book_id", bookId);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryRegionalPriceRow[];
}

export async function upsertRegionalPrice(row: LibraryRegionalPriceRow): Promise<void> {
  const { error } = await supabase.from("library_regional_prices").upsert(row, { onConflict: "book_id,country_code" });
  if (error) throw new Error(error.message);
}

export async function removeRegionalPrice(bookId: string, countryCode: string): Promise<void> {
  const { error } = await supabase.from("library_regional_prices").delete().eq("book_id", bookId).eq("country_code", countryCode);
  if (error) throw new Error(error.message);
}

// ── Bundles ─────────────────────────────────────────────────────────────

export async function fetchAuthorBundles(authorId: string): Promise<LibraryBundleRow[]> {
  const { data, error } = await supabase
    .from("library_bundles")
    .select("*, library_bundle_books(book_id)")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: LibraryBundleRow & { library_bundle_books?: Array<{ book_id: string }> }) => ({
    ...row,
    bookIds: (row.library_bundle_books ?? []).map((b) => b.book_id),
  }));
}

export async function createBundle(input: { author_id: string; title: string; description?: string; price_usd?: number; price_vx?: number; bookIds: string[] }): Promise<LibraryBundleRow> {
  const { data: bundle, error: bundleErr } = await supabase
    .from("library_bundles")
    .insert({ author_id: input.author_id, title: input.title, description: input.description ?? null, price_usd: input.price_usd ?? null, price_vx: input.price_vx ?? null })
    .select("*")
    .single();
  if (bundleErr) throw new Error(bundleErr.message);

  if (input.bookIds.length > 0) {
    const { error: booksErr } = await supabase.from("library_bundle_books").insert(input.bookIds.map((bookId) => ({ bundle_id: bundle.id, book_id: bookId })));
    if (booksErr) throw new Error(booksErr.message);
  }
  return { ...bundle, bookIds: input.bookIds } as LibraryBundleRow;
}

export async function setBundleActive(bundleId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("library_bundles").update({ is_active: isActive }).eq("id", bundleId);
  if (error) throw new Error(error.message);
}

/** One bundle + its full book list, for the public /library/bundles/:id
 *  page (linked from FrequentlyBoughtTogether). Returns null for an
 *  inactive/nonexistent bundle — RLS's "public read active" policy means an
 *  inactive bundle simply won't be returned here, not an error. */
export async function fetchBundleById(bundleId: string): Promise<(LibraryBundleRow & { books: LibraryBookRow[] }) | null> {
  const { data, error } = await supabase
    .from("library_bundles")
    .select("*, library_bundle_books(book_id, library_books(*, library_authors(name), library_publishers(name)))")
    .eq("id", bundleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const bundle = data as LibraryBundleRow & {
    library_bundle_books: Array<{ book_id: string; library_books: (RawLibraryBookRow & { library_authors: { name: string } | null; library_publishers: { name: string } | null }) | null }>;
  };
  return {
    ...bundle,
    bookIds: bundle.library_bundle_books.map((b) => b.book_id),
    books: bundle.library_bundle_books
      .filter((b) => b.library_books)
      .map((b) => mapRawBookRow(b.library_books!, b.library_books!.library_authors?.name ?? "", b.library_books!.library_publishers?.name ?? null)),
  };
}

/** Reader-facing "Frequently Bought Together" — active bundles that include
 *  this book, with the OTHER books in each bundle resolved to full rows for
 *  display. A book can appear in more than one bundle; each is returned
 *  separately rather than merged into one flat book list. */
export async function fetchBundlesForBook(bookId: string): Promise<Array<LibraryBundleRow & { otherBooks: LibraryBookRow[] }>> {
  const { data: bundleLinks, error: linkErr } = await supabase.from("library_bundle_books").select("bundle_id").eq("book_id", bookId);
  if (linkErr) throw new Error(linkErr.message);
  const bundleIds = (bundleLinks ?? []).map((r) => r.bundle_id);
  if (bundleIds.length === 0) return [];

  const { data: bundles, error } = await supabase
    .from("library_bundles")
    .select("*, library_bundle_books(book_id, library_books(*, library_authors(name), library_publishers(name)))")
    .in("id", bundleIds)
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  type BundleWithBooks = LibraryBundleRow & {
    library_bundle_books: Array<{ book_id: string; library_books: (RawLibraryBookRow & { library_authors: { name: string } | null; library_publishers: { name: string } | null }) | null }>;
  };

  return ((bundles ?? []) as unknown as BundleWithBooks[]).map((bundle) => ({
    ...bundle,
    bookIds: bundle.library_bundle_books.map((b) => b.book_id),
    otherBooks: bundle.library_bundle_books
      .filter((b) => b.book_id !== bookId && b.library_books)
      .map((b) => mapRawBookRow(b.library_books!, b.library_books!.library_authors?.name ?? "", b.library_books!.library_publishers?.name ?? null)),
  }));
}

// ── Donations (read-only here — creation happens via checkout.ts) ──────

export async function fetchBookDonations(bookId: string, limit = 20): Promise<LibraryDonationRow[]> {
  const { data, error } = await supabase.from("library_donations").select("*").eq("book_id", bookId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryDonationRow[];
}
