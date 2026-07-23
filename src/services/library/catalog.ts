// ─── Library — Catalog Service (Phase 3/4: real Supabase backend) ────────────
// Replaces the Phase 1 mock fixtures with real queries against the Phase 2
// schema (supabase/migrations/20260720000000_library_core_catalog.sql).
// Phase 4 extended the filter/sort surface for the Books Explorer — see
// LibraryCatalogFilters (src/lib/types/library-book.ts) for the full list.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookRow, LibraryCategoryRow, LibraryCatalogFilters, LibraryBookFormat } from "@/lib/types/library-book";

const BOOK_SELECT = "*, library_authors(name), library_publishers(name)";

/** Raw `library_books` row shape, no embedded relations — also what RPCs
 *  returning `SETOF library_books` (e.g. get_library_trending_books) give
 *  back, since PostgREST's relation-embedding syntax only applies to direct
 *  table queries, not RPC results. */
export type RawLibraryBookRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  author_id: string;
  publisher_id: string | null;
  category_id: string | null;
  cover_image_url: string | null;
  description: string;
  description_long: string | null;
  keywords: string[];
  language: string;
  page_count: number | null;
  reading_time_minutes: number | null;
  published_date: string | null;
  rating_avg: number | null;
  rating_count: number;
  isbn: string | null;
  book_type: string;
  is_free: boolean;
  price_vx: number | null;
  price_usd: number | null;
  views_count: number;
  downloads_count: number;
  likes_count: number;
  reviews_count: number;
  lending_copies_total: number | null;
  age_category: string | null;
  difficulty_level: string | null;
  // Phase 10 — already SELECTed for free via "*" (fetchCatalog/fetchBookById
  // never restricted columns), just not read into the frontend type until now.
  trailer_video_url: string | null;
  series_id: string | null;
  series_position: number | null;
  flash_deal_ends_at: string | null;
  age_rating: string | null;
  // Phase 11 — Global Digital Library additions, also already SELECTed via "*".
  topics: string[];
  subtopics: string[];
  reading_level: string | null;
  auto_classified_at: string | null;
  doi: string | null;
  issn: string | null;
};

type BookRowWithRelations = RawLibraryBookRow & {
  library_authors: { name: string } | null;
  library_publishers: { name: string } | null;
};

/**
 * The real schema stores one `book_type` (ebook/audiobook/physical/hybrid),
 * not a per-book list of formats — `formats` is derived here rather than
 * read from a column. "hybrid" is mapped to ebook+audiobook, the most common
 * hybrid case in the catalog today; a book that's genuinely ebook+physical
 * would need its own book_type value to distinguish (not modeled yet).
 */
export function deriveFormats(bookType: string): LibraryBookFormat[] {
  switch (bookType) {
    case "audiobook":
      return ["audiobook"];
    case "physical":
      return ["physical"];
    case "hybrid":
      return ["ebook", "audiobook"];
    case "ebook":
    default:
      return ["ebook"];
  }
}

/** Maps a raw (non-embedded) book row plus a separately-resolved author name
 *  into the frontend LibraryBookRow shape — used both for direct table
 *  queries (via mapBookRow below) and for RPC results that need a follow-up
 *  author-name lookup (see services/library/stats.ts). `publisherName` is
 *  optional (defaults to null) so every pre-Phase-5 call site that only
 *  resolves an author name keeps compiling unchanged. */
export function mapRawBookRow(row: RawLibraryBookRow, authorName: string, publisherName: string | null = null): LibraryBookRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    author_id: row.author_id,
    author_name: authorName,
    publisher_id: row.publisher_id,
    publisher_name: publisherName,
    category_id: row.category_id,
    cover_image_url: row.cover_image_url,
    description: row.description,
    description_long: row.description_long,
    keywords: row.keywords ?? [],
    formats: deriveFormats(row.book_type),
    bookType: row.book_type,
    language: row.language,
    page_count: row.page_count,
    reading_time_minutes: row.reading_time_minutes,
    published_year: row.published_date ? new Date(row.published_date).getFullYear() : null,
    published_date: row.published_date,
    rating_avg: row.rating_avg,
    rating_count: row.rating_count,
    isbn: row.isbn,
    is_free: row.is_free,
    price_vx: row.price_vx,
    price_usd: row.price_usd,
    views_count: row.views_count,
    downloads_count: row.downloads_count,
    likes_count: row.likes_count,
    reviews_count: row.reviews_count,
    lendingCopiesTotal: row.lending_copies_total,
    ageCategory: row.age_category,
    difficultyLevel: row.difficulty_level as "beginner" | "intermediate" | "advanced" | null,
    trailerVideoUrl: row.trailer_video_url ?? null,
    seriesId: row.series_id ?? null,
    seriesPosition: row.series_position ?? null,
    flashDealEndsAt: row.flash_deal_ends_at ?? null,
    ageRating: row.age_rating ?? null,
    topics: row.topics ?? [],
    subtopics: row.subtopics ?? [],
    readingLevel: row.reading_level as LibraryBookRow["readingLevel"],
    autoClassifiedAt: row.auto_classified_at ?? null,
    doi: row.doi ?? null,
    issn: row.issn ?? null,
  };
}

function mapBookRow(row: BookRowWithRelations): LibraryBookRow {
  return mapRawBookRow(row, row.library_authors?.name ?? "", row.library_publishers?.name ?? null);
}

const FORMAT_BOOK_TYPES: Record<LibraryBookFormat, string[]> = {
  ebook: ["ebook", "hybrid"],
  audiobook: ["audiobook", "hybrid"],
  physical: ["physical", "hybrid"],
};

export async function fetchCategories(): Promise<LibraryCategoryRow[]> {
  const { data, error } = await supabase
    .from("library_categories")
    .select("id, parent_id, name, slug, description, icon, image_url, book_count")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface LibraryPublisherOption {
  id: string;
  name: string;
}

/** Publishers, name-only — for the Explorer's publisher filter dropdown.
 *  Unlike books, publishers are always a small, bounded list even at huge
 *  catalog scale, so a plain <select> populated from this is fine (no
 *  pagination/search-as-you-type needed here). */
export async function fetchPublishers(): Promise<LibraryPublisherOption[]> {
  const { data, error } = await supabase.from("library_publishers").select("id, name").order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Builds the `select` clause's embed list — shared by fetchCatalog and
 *  fetchCatalogCount so both filter identically regardless of what data
 *  each ultimately returns. */
function buildEmbeds(filters: LibraryCatalogFilters, includeAuthor: boolean): string[] {
  const embeds: string[] = [];
  if (includeAuthor) embeds.push("library_authors(name)");
  if (filters.categorySlug) embeds.push("library_categories!inner(slug)");
  if (filters.fileType || filters.downloadable) embeds.push("library_book_files!inner(file_type)");
  if (filters.tagSlug || filters.tagSlugs?.length) embeds.push("library_book_tags!inner(library_tags!inner(slug))");
  return embeds;
}

/** Column filter conditions shared by fetchCatalog/fetchCatalogCount are
 *  applied inline in each function rather than through a generic helper —
 *  Supabase's fluent query builder has complex per-table generic types, and
 *  a loosely-typed generic wrapper risks not structurally matching them in
 *  ways that can't be checked without a compiler in this environment.
 *  Both blocks below must be kept in sync if a filter is added/changed. */

export async function fetchCatalog(filters: LibraryCatalogFilters = {}): Promise<LibraryBookRow[]> {
  const select = `*, ${buildEmbeds(filters, true).join(", ")}`;
  let query = supabase.from("library_books").select(select).eq("publish_status", "published");

  if (filters.categorySlug) query = query.eq("library_categories.slug", filters.categorySlug);
  if (filters.fileType) query = query.eq("library_book_files.file_type", filters.fileType);
  if (filters.tagSlug) query = query.eq("library_book_tags.library_tags.slug", filters.tagSlug);
  if (filters.tagSlugs?.length) query = query.in("library_book_tags.library_tags.slug", filters.tagSlugs);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.authorId) query = query.eq("author_id", filters.authorId);
  if (filters.publisherId) query = query.eq("publisher_id", filters.publisherId);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.format) query = query.in("book_type", FORMAT_BOOK_TYPES[filters.format]);
  if (filters.isFree !== undefined) query = query.eq("is_free", filters.isFree);
  if (filters.borrowable) query = query.not("lending_copies_total", "is", null);
  if (filters.minRating !== undefined) query = query.gte("rating_avg", filters.minRating);
  if (filters.minPages !== undefined) query = query.gte("page_count", filters.minPages);
  if (filters.maxPages !== undefined) query = query.lte("page_count", filters.maxPages);
  if (filters.yearFrom !== undefined) query = query.gte("published_date", `${filters.yearFrom}-01-01`);
  if (filters.yearTo !== undefined) query = query.lte("published_date", `${filters.yearTo}-12-31`);
  if (filters.isbn?.trim()) query = query.eq("isbn", filters.isbn.trim());
  if (filters.ageRating) query = query.eq("age_rating", filters.ageRating);
  if (filters.difficultyLevel) query = query.eq("difficulty_level", filters.difficultyLevel);
  if (filters.seriesId) query = query.eq("series_id", filters.seriesId);
  if (filters.comingSoon) query = query.gt("published_date", new Date().toISOString());
  if (filters.flashDeal) query = query.not("flash_deal_ends_at", "is", null).gt("flash_deal_ends_at", new Date().toISOString());
  if (filters.topic) query = query.contains("topics", [filters.topic]);
  if (filters.readingLevel) query = query.eq("reading_level", filters.readingLevel);
  if (filters.query?.trim()) {
    const term = filters.query.trim().replace(/[%,]/g, "");
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  switch (filters.sort) {
    case "rating":
      query = query.order("rating_avg", { ascending: false, nullsFirst: false });
      break;
    case "newest":
      query = query.order("published_date", { ascending: false, nullsFirst: false });
      break;
    case "oldest":
      query = query.order("published_date", { ascending: true, nullsFirst: false });
      break;
    case "title":
      query = query.order("title", { ascending: true });
      break;
    case "downloads":
      query = query.order("downloads_count", { ascending: false });
      break;
    case "reviews":
      query = query.order("reviews_count", { ascending: false });
      break;
    case "likes":
      query = query.order("likes_count", { ascending: false });
      break;
    case "popular":
    default:
      query = query.order("views_count", { ascending: false });
      break;
  }

  const limit = filters.limit ?? 100;
  const page = filters.page ?? 0;
  query = query.range(page * limit, page * limit + limit - 1);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as BookRowWithRelations[]).map(mapBookRow);
}

/** Total matching row count for the same filters — powers Pagination.tsx's
 * totalPages, kept separate from fetchCatalog so a plain listing query
 * never pays for a count it doesn't need. */
export async function fetchCatalogCount(filters: LibraryCatalogFilters = {}): Promise<number> {
  const select = `id, ${buildEmbeds(filters, false).join(", ")}`;
  let query = supabase.from("library_books").select(select, { count: "exact", head: true }).eq("publish_status", "published");

  if (filters.categorySlug) query = query.eq("library_categories.slug", filters.categorySlug);
  if (filters.fileType) query = query.eq("library_book_files.file_type", filters.fileType);
  if (filters.tagSlug) query = query.eq("library_book_tags.library_tags.slug", filters.tagSlug);
  if (filters.tagSlugs?.length) query = query.in("library_book_tags.library_tags.slug", filters.tagSlugs);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.authorId) query = query.eq("author_id", filters.authorId);
  if (filters.publisherId) query = query.eq("publisher_id", filters.publisherId);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.format) query = query.in("book_type", FORMAT_BOOK_TYPES[filters.format]);
  if (filters.isFree !== undefined) query = query.eq("is_free", filters.isFree);
  if (filters.borrowable) query = query.not("lending_copies_total", "is", null);
  if (filters.minRating !== undefined) query = query.gte("rating_avg", filters.minRating);
  if (filters.minPages !== undefined) query = query.gte("page_count", filters.minPages);
  if (filters.maxPages !== undefined) query = query.lte("page_count", filters.maxPages);
  if (filters.yearFrom !== undefined) query = query.gte("published_date", `${filters.yearFrom}-01-01`);
  if (filters.yearTo !== undefined) query = query.lte("published_date", `${filters.yearTo}-12-31`);
  if (filters.isbn?.trim()) query = query.eq("isbn", filters.isbn.trim());
  if (filters.ageRating) query = query.eq("age_rating", filters.ageRating);
  if (filters.difficultyLevel) query = query.eq("difficulty_level", filters.difficultyLevel);
  if (filters.seriesId) query = query.eq("series_id", filters.seriesId);
  if (filters.comingSoon) query = query.gt("published_date", new Date().toISOString());
  if (filters.flashDeal) query = query.not("flash_deal_ends_at", "is", null).gt("flash_deal_ends_at", new Date().toISOString());
  if (filters.topic) query = query.contains("topics", [filters.topic]);
  if (filters.readingLevel) query = query.eq("reading_level", filters.readingLevel);
  if (filters.query?.trim()) {
    const term = filters.query.trim().replace(/[%,]/g, "");
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function fetchBookById(bookId: string): Promise<LibraryBookRow | null> {
  const { data, error } = await supabase.from("library_books").select(BOOK_SELECT).eq("id", bookId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapBookRow(data as unknown as BookRowWithRelations) : null;
}

/** Fetches books by id, preserving the caller's given order — used by
 *  semantic search (ranked by similarity) rather than sorting by any DB
 *  column. Missing/unpublished ids are silently dropped. */
export async function fetchBooksByIds(ids: string[]): Promise<LibraryBookRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("library_books").select(BOOK_SELECT).in("id", ids);
  if (error) throw new Error(error.message);

  const byId = new Map(((data ?? []) as unknown as BookRowWithRelations[]).map((row) => [row.id, mapBookRow(row)]));
  return ids.map((id) => byId.get(id)).filter((b): b is LibraryBookRow => !!b);
}

/** Typo-tolerant fallback: title-similarity ranked matches via the
 *  fuzzy_search_library_books RPC (pg_trgm), preserving similarity order.
 *  Only meant to be called when a plain ILIKE search comes back empty. */
export async function fetchFuzzyBookMatches(query: string, limit = 20): Promise<LibraryBookRow[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc("fuzzy_search_library_books", { _query: q, _match_count: limit });
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as Array<{ book_id: string; similarity_score: number }>).map((row) => row.book_id);
  return fetchBooksByIds(ids);
}

export async function fetchSimilarBooks(bookId: string, limit = 4): Promise<LibraryBookRow[]> {
  const { data: book, error: bookErr } = await supabase.from("library_books").select("category_id").eq("id", bookId).maybeSingle();
  if (bookErr) throw new Error(bookErr.message);
  if (!book?.category_id) return [];

  const { data, error } = await supabase
    .from("library_books")
    .select(BOOK_SELECT)
    .eq("publish_status", "published")
    .eq("category_id", book.category_id)
    .neq("id", bookId)
    .order("rating_avg", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as BookRowWithRelations[]).map(mapBookRow);
}
