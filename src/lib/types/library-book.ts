/**
 * Library — Book & Category types (Phase 1 architecture prep, extended in
 * Phase 3/4 as the real Supabase schema came online)
 *
 * Shapes mirror the real Supabase rows (library_books, library_categories,
 * see supabase/migrations/20260720000000_library_core_catalog.sql).
 * Distinct from AcademyLibraryResourceRow (academy-modules.ts) — that's
 * course study material, this is the consumer books/audiobooks catalog.
 */

export type LibraryBookFormat = "ebook" | "audiobook" | "physical";

/** Matches library_book_files.file_type's CHECK constraint exactly. */
export type LibraryFileType = "pdf" | "epub" | "txt" | "docx" | "brf" | "audio";

export interface LibraryCategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  book_count: number;
}

/** Returned by get_library_categories_with_stats() / get_library_category_stats()
 *  — the richer shape the Categories grid and Category Details pages need
 *  (author_count/updated_at aren't in the plain category row). */
export interface LibraryCategoryWithStats extends LibraryCategoryRow {
  author_count: number;
  updated_at: string;
}

export interface LibraryBookRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  author_id: string;
  author_name: string;
  publisher_id: string | null;
  publisher_name: string | null;
  category_id: string | null;
  cover_image_url: string | null;
  description: string;
  description_long: string | null;
  keywords: string[];
  formats: LibraryBookFormat[];
  /** Raw book_type column (ebook/audiobook/physical/hybrid) — `formats` is
   *  derived from this; kept alongside it for callers that need the exact
   *  underlying value (e.g. the Book Details header's "file type" line). */
  bookType: string;
  language: string;
  page_count: number | null;
  reading_time_minutes: number | null;
  published_year: number | null;
  published_date: string | null;
  rating_avg: number | null;
  rating_count: number;
  isbn: string | null;
  is_free: boolean;
  price_vx: number | null;
  price_usd: number | null;
  views_count: number;
  downloads_count: number;
  likes_count: number;
  reviews_count: number;
  lendingCopiesTotal: number | null;
  ageCategory: string | null;
  difficultyLevel: "beginner" | "intermediate" | "advanced" | null;
  /** Phase 10 marketplace additions — trailer/gallery were added to the
   *  schema in Phase 9 but never selected/mapped until now; series/flash-deal
   *  are new in Phase 10. Gallery images are fetched separately (one row per
   *  image, see services/library/studio.ts's fetchBookGallery) rather than
   *  embedded here. */
  trailerVideoUrl: string | null;
  seriesId: string | null;
  seriesPosition: number | null;
  flashDealEndsAt: string | null;
  ageRating: string | null;
  /** Phase 11 — Global Digital Library additions. topics/subtopics/
   *  reading_level are AI-generated (see library-ai-classify-book);
   *  doi/issn are plain author-entered academic identifiers. */
  topics: string[];
  subtopics: string[];
  readingLevel: "early_reader" | "middle_grade" | "young_adult" | "adult" | "graduate" | null;
  autoClassifiedAt: string | null;
  doi: string | null;
  issn: string | null;
}

/** Mirrors library_chapters exactly (20260720000000_library_core_catalog.sql). */
export interface LibraryChapterRow {
  id: string;
  book_id: string;
  chapter_number: number;
  title: string | null;
  content_text: string | null;
  content_url: string | null;
  page_start: number | null;
  page_end: number | null;
  duration_seconds: number | null;
  is_free_preview: boolean;
  order_index: number;
}

export interface LibraryCatalogFilters {
  categoryId?: string;
  /** Filters by the category's slug via a PostgREST inner-join, so callers
   *  (e.g. home-page rails) don't need the category's UUID pre-resolved. */
  categorySlug?: string;
  format?: LibraryBookFormat;
  /** Filters via an inner-join on library_book_files.file_type — same
   *  PostgREST technique as categorySlug. Distinct from `format`, which
   *  reads the coarser book_type column. */
  fileType?: LibraryFileType;
  /** At least one library_book_files row exists (any type). */
  downloadable?: boolean;
  /** lending_copies_total IS NOT NULL. */
  borrowable?: boolean;
  /** Filters via an inner-join through library_book_tags -> library_tags.slug. */
  tagSlug?: string;
  /** Phase 10 — matches ANY of the given tag slugs (vs. tagSlug's single
   *  exact match), for Advanced Search's multi-tag filter. */
  tagSlugs?: string[];
  query?: string;
  authorId?: string;
  publisherId?: string;
  language?: string;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  minPages?: number;
  maxPages?: number;
  isFree?: boolean;
  sort?: "popular" | "newest" | "oldest" | "rating" | "title" | "trending" | "downloads" | "reviews" | "likes";
  limit?: number;
  /** Zero-based page offset — combined with `limit` for real pagination. */
  page?: number;
  /** Phase 10 — Advanced Search / Marketplace additions. */
  isbn?: string;
  ageRating?: string;
  difficultyLevel?: "beginner" | "intermediate" | "advanced";
  seriesId?: string;
  /** published_date is in the future. */
  comingSoon?: boolean;
  /** flash_deal_ends_at is set and still in the future. */
  flashDeal?: boolean;
  /** Phase 11 — matches ANY of the book's AI-generated topics. */
  topic?: string;
  readingLevel?: "early_reader" | "middle_grade" | "young_adult" | "adult" | "graduate";
}
