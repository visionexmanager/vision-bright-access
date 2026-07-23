// ─── Library — Quotes Service (Phase 3: real Supabase backend) ───────────────
// See catalog.ts header for the mock -> real swap contract. Note the frontend
// type uses `like_count` but the real column is `likes_count` — mapped
// explicitly below.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryQuoteRow } from "@/lib/types/library-review";

type QuoteRow = {
  id: string;
  book_id: string;
  text: string;
  likes_count: number;
  library_books: { title: string; library_authors: { name: string } | null } | null;
};

const QUOTE_SELECT = "id, book_id, text, likes_count, library_books(title, library_authors(name))";

function mapQuoteRow(row: QuoteRow): LibraryQuoteRow {
  return {
    id: row.id,
    book_id: row.book_id,
    book_title: row.library_books?.title ?? "",
    author_name: row.library_books?.library_authors?.name ?? "",
    text: row.text,
    like_count: row.likes_count,
  };
}

export async function fetchQuotes(limit = 50): Promise<LibraryQuoteRow[]> {
  const { data, error } = await supabase
    .from("library_quotes")
    .select(QUOTE_SELECT)
    .eq("is_approved", true)
    .order("likes_count", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as QuoteRow[]).map(mapQuoteRow);
}

/**
 * Deterministic "quote of the day" — the same quote for every visitor all
 * day, not re-randomized per page load. Picks index (day-of-year % count)
 * from approved quotes ordered by a stable key (id), then fetches that one
 * row via .range(). No new backend needed.
 */
export async function fetchDailyQuote(): Promise<LibraryQuoteRow | null> {
  const { count, error: countErr } = await supabase
    .from("library_quotes")
    .select("id", { count: "exact", head: true })
    .eq("is_approved", true);
  if (countErr) throw new Error(countErr.message);
  if (!count || count === 0) return null;

  const startOfYear = Date.UTC(new Date().getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - startOfYear) / 86_400_000);
  const index = dayOfYear % count;

  const { data, error } = await supabase
    .from("library_quotes")
    .select(QUOTE_SELECT)
    .eq("is_approved", true)
    .order("id", { ascending: true })
    .range(index, index);

  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as unknown as QuoteRow | undefined;
  return row ? mapQuoteRow(row) : null;
}

/** One quote for a specific book (Quick Preview) — most-liked first. */
export async function fetchQuoteForBook(bookId: string): Promise<LibraryQuoteRow | null> {
  const { data, error } = await supabase
    .from("library_quotes")
    .select(QUOTE_SELECT)
    .eq("book_id", bookId)
    .eq("is_approved", true)
    .order("likes_count", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapQuoteRow(data as unknown as QuoteRow) : null;
}

/** All approved quotes for a book (Book Details "Quotes" section), most-liked
 *  first — distinct from fetchQuoteForBook, which returns just one for a
 *  compact preview card. */
export async function fetchQuotesForBook(bookId: string, limit = 10): Promise<LibraryQuoteRow[]> {
  const { data, error } = await supabase
    .from("library_quotes")
    .select(QUOTE_SELECT)
    .eq("book_id", bookId)
    .eq("is_approved", true)
    .order("likes_count", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as QuoteRow[]).map(mapQuoteRow);
}

/** Which of the given quote ids the signed-in viewer has saved — powers the
 *  "save" toggle's initial state without a per-quote round trip. */
export async function fetchSavedQuoteIds(userId: string, quoteIds: string[]): Promise<Set<string>> {
  if (quoteIds.length === 0) return new Set();
  const { data, error } = await supabase.from("library_saved_quotes").select("quote_id").eq("user_id", userId).in("quote_id", quoteIds);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.quote_id));
}

export async function saveQuote(userId: string, quoteId: string): Promise<void> {
  const { error } = await supabase.from("library_saved_quotes").upsert({ user_id: userId, quote_id: quoteId }, { onConflict: "user_id,quote_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function unsaveQuote(userId: string, quoteId: string): Promise<void> {
  const { error } = await supabase.from("library_saved_quotes").delete().eq("user_id", userId).eq("quote_id", quoteId);
  if (error) throw new Error(error.message);
}
