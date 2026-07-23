/**
 * Library — Section Search (Phase 1, client-side implementation)
 *
 * Fans out across the Phase 1 mock catalog/authors/audiobooks/quotes
 * services, same pattern as src/lib/academy/globalSearch.ts. The return
 * shape (LibrarySearchResults) stays identical once Phase 2 swaps the mock
 * services for real Supabase full-text queries.
 */

import { fetchCatalog, fetchFuzzyBookMatches } from "@/services/library/catalog";
import { fetchAuthors } from "@/services/library/authors";
import { fetchAudiobooks } from "@/services/library/audiobooks";
import type { LibraryBookRow } from "@/lib/types/library-book";
import type { LibraryAuthorRow } from "@/lib/types/library-author";
import type { LibraryAudiobookRow } from "@/lib/types/library-audiobook";

export interface LibrarySearchResults {
  books: LibraryBookRow[];
  authors: LibraryAuthorRow[];
  audiobooks: LibraryAudiobookRow[];
  /** True when `books` came from the typo-tolerant fuzzy fallback rather
   *  than an exact match, so the UI can tell the reader why. */
  isFuzzyMatch: boolean;
}

export async function runLibrarySearch(query: string): Promise<LibrarySearchResults> {
  const q = query.trim();
  if (!q) return { books: [], authors: [], audiobooks: [], isFuzzyMatch: false };
  const lower = q.toLowerCase();

  const [exactBooks, authors, audiobooks] = await Promise.all([
    fetchCatalog({ query: q }),
    fetchAuthors(),
    fetchAudiobooks(),
  ]);

  // Typo tolerance: only fall back to the fuzzy-title RPC when the exact
  // ILIKE match came back empty, so the common case pays no extra query.
  const isFuzzyMatch = exactBooks.length === 0;
  const books = isFuzzyMatch ? await fetchFuzzyBookMatches(q) : exactBooks;

  return {
    books,
    authors: authors.filter((a) => a.name.toLowerCase().includes(lower)),
    audiobooks: audiobooks.filter((a) => a.title.toLowerCase().includes(lower) || a.author_name.toLowerCase().includes(lower)),
    isFuzzyMatch: isFuzzyMatch && books.length > 0,
  };
}

export function getTotalResultCount(results: LibrarySearchResults): number {
  return results.books.length + results.authors.length + results.audiobooks.length;
}
