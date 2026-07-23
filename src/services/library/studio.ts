// ─── Library — Publishing Studio Service (Phase 9) ────────────────────────
// Author Dashboard stats, book CRUD for the Studio (draft/create/update),
// and gallery management. Reader-facing catalog reads stay in catalog.ts —
// this file is the write-side/author-side counterpart.

import { supabase } from "@/integrations/supabase/client";
import type { AuthorDashboardStats, AuthorMonthlyStatPoint, LibraryBookGalleryRow, LibraryStudioBookFields } from "@/lib/types/library-studio";
import type { LibraryBookRow } from "@/lib/types/library-book";
import { mapRawBookRow, type RawLibraryBookRow } from "@/services/library/catalog";
import { logLibraryAuditEvent } from "@/services/library/auditLog";

/** Every book this author owns OR actively collaborates on (owner/editor
 *  roles get full rows via can_edit_library_book's widened RLS; narrower
 *  roles get read access via the same policy's collaborator branch). */
export interface StudioBookSummary {
  id: string;
  title: string;
  cover_image_url: string | null;
  publish_status: LibraryStudioBookFields["publish_status"];
  views_count: number;
  downloads_count: number;
  reviews_count: number;
  rating_avg: number | null;
  updated_at: string;
}

const STUDIO_BOOK_SELECT = "id, title, cover_image_url, publish_status, views_count, downloads_count, reviews_count, rating_avg, updated_at";

export async function fetchStudioBooks(authorId: string): Promise<StudioBookSummary[]> {
  const { data, error } = await supabase
    .from("library_books")
    .select(STUDIO_BOOK_SELECT)
    .eq("author_id", authorId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioBookSummary[];
}

export async function fetchAuthorDashboardStats(authorId: string): Promise<AuthorDashboardStats> {
  const [{ data: books, error: booksErr }, { data: author, error: authorErr }, { data: revenueRows, error: revenueErr }] = await Promise.all([
    supabase.from("library_books").select("publish_status, views_count, downloads_count, reviews_count").eq("author_id", authorId),
    supabase.from("library_authors").select("follower_count, rating_avg").eq("id", authorId).maybeSingle(),
    supabase.from("library_book_daily_stats").select("revenue_usd, revenue_vx, book_id, library_books!inner(author_id)").eq("library_books.author_id", authorId),
  ]);
  if (booksErr) throw new Error(booksErr.message);
  if (authorErr) throw new Error(authorErr.message);
  if (revenueErr) throw new Error(revenueErr.message);

  const rows = books ?? [];
  return {
    totalBooks: rows.length,
    publishedBooks: rows.filter((b) => b.publish_status === "published" || b.publish_status === "scheduled").length,
    drafts: rows.filter((b) => b.publish_status === "draft").length,
    pendingReview: rows.filter((b) => b.publish_status === "review").length,
    totalReads: rows.reduce((sum, b) => sum + (b.views_count ?? 0), 0),
    totalDownloads: rows.reduce((sum, b) => sum + (b.downloads_count ?? 0), 0),
    followers: author?.follower_count ?? 0,
    revenueUsd: (revenueRows ?? []).reduce((sum, r) => sum + Number(r.revenue_usd ?? 0), 0),
    revenueVx: (revenueRows ?? []).reduce((sum, r) => sum + Number(r.revenue_vx ?? 0), 0),
    ratingAvg: author?.rating_avg ?? null,
    totalReviews: rows.reduce((sum, b) => sum + (b.reviews_count ?? 0), 0),
  };
}

/** Last `months` months of views/downloads/revenue for every book this
 *  author owns, aggregated client-side (the fact table is daily-grain and
 *  per-book; a per-author monthly rollup has no dedicated view, and this
 *  dataset — one author's books over a handful of months — is small enough
 *  that a client-side group-by is simpler and cheap, same reasoning
 *  fetchChatSessions already applies to its own small aggregation). */
export async function fetchAuthorMonthlyStats(authorId: string, months = 6): Promise<AuthorMonthlyStatPoint[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("library_book_daily_stats")
    .select("stat_date, views, downloads, revenue_usd, library_books!inner(author_id)")
    .eq("library_books.author_id", authorId)
    .gte("stat_date", sinceDate)
    .order("stat_date", { ascending: true });
  if (error) throw new Error(error.message);

  const byMonth = new Map<string, AuthorMonthlyStatPoint>();
  for (const row of data ?? []) {
    const month = String(row.stat_date).slice(0, 7);
    const point = byMonth.get(month) ?? { month, reads: 0, downloads: 0, revenueUsd: 0 };
    point.reads += row.views ?? 0;
    point.downloads += row.downloads ?? 0;
    point.revenueUsd += Number(row.revenue_usd ?? 0);
    byMonth.set(month, point);
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/** Books this author has in 'review' status, for the dashboard's "Pending
 *  Review" list (distinct from the count above — this returns the actual
 *  rows to link into). */
export async function fetchPendingReviewBooks(authorId: string): Promise<StudioBookSummary[]> {
  const { data, error } = await supabase
    .from("library_books")
    .select(STUDIO_BOOK_SELECT)
    .eq("author_id", authorId)
    .eq("publish_status", "review")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioBookSummary[];
}

// ─── Book creation / metadata ──────────────────────────────────────────────

export interface CreateBlankBookInput {
  author_id: string;
  title: string;
  subtitle?: string;
  description: string;
  language: string;
  category_id?: string;
  book_type: "ebook" | "audiobook" | "physical" | "hybrid";
  content_format?: LibraryStudioBookFields["content_format"];
  isbn?: string;
  edition?: string;
  publisher_id?: string;
  published_date?: string;
  age_rating?: LibraryStudioBookFields["age_rating"];
  license_type?: LibraryStudioBookFields["license_type"];
  license_details?: string;
  cover_image_url?: string;
  trailer_video_url?: string;
  is_free?: boolean;
  price_usd?: number;
  price_vx?: number;
  pricing_model?: LibraryStudioBookFields["pricing_model"];
}

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "book"
  );
}

/** Creates a new library_books draft with no chapters yet — the wizard's
 *  "blank book" path for formats library-import-book doesn't parse (DOCX,
 *  TXT, HTML, Markdown, Audiobook, Interactive). The author then adds
 *  chapters in the editor. EPUB/PDF creation instead calls the existing
 *  library-import-book edge function (see useBookWizard.ts), which parses
 *  real content immediately. */
export async function createBlankBook(input: CreateBlankBookInput): Promise<{ id: string }> {
  const base = slugifyTitle(input.title);
  let slug = base;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await supabase
      .from("library_books")
      .insert({
        slug,
        title: input.title,
        subtitle: input.subtitle ?? null,
        description: input.description,
        language: input.language,
        author_id: input.author_id,
        category_id: input.category_id ?? null,
        book_type: input.book_type,
        content_format: input.content_format ?? null,
        isbn: input.isbn ?? null,
        edition: input.edition ?? null,
        publisher_id: input.publisher_id ?? null,
        published_date: input.published_date ?? null,
        age_rating: input.age_rating ?? "all",
        license_type: input.license_type ?? "copyright",
        license_details: input.license_details ?? null,
        cover_image_url: input.cover_image_url ?? null,
        trailer_video_url: input.trailer_video_url ?? null,
        is_free: input.is_free ?? false,
        price_usd: input.price_usd ?? null,
        price_vx: input.price_vx ?? null,
        pricing_model: input.pricing_model ?? "paid",
      })
      .select("id")
      .single();
    if (!error) return data;
    if (error.code !== "23505") throw new Error(error.message);
    slug = `${base}-${attempt + 2}`;
  }
  throw new Error("Couldn't generate a unique book URL — try a different title.");
}

export async function updateBookMetadata(bookId: string, patch: Partial<LibraryBookRow & LibraryStudioBookFields>): Promise<void> {
  const { error } = await supabase.from("library_books").update(patch).eq("id", bookId);
  if (error) throw new Error(error.message);
}

export async function updateBookPublishStatus(
  bookId: string,
  publish_status: LibraryStudioBookFields["publish_status"],
  opts: { reviewNote?: string; scheduledPublishAt?: string } = {}
): Promise<void> {
  const { error } = await supabase
    .from("library_books")
    .update({ publish_status, review_note: opts.reviewNote ?? null, scheduled_publish_at: opts.scheduledPublishAt ?? null })
    .eq("id", bookId);
  if (error) throw new Error(error.message);
  await logLibraryAuditEvent("publish_status_change", "library_book", bookId, { to: publish_status, review_note: opts.reviewNote ?? null });
}

export async function fetchStudioBookDetail(bookId: string): Promise<(LibraryBookRow & LibraryStudioBookFields) | null> {
  const { data, error } = await supabase
    .from("library_books")
    .select("*, library_authors(name), library_publishers(name)")
    .eq("id", bookId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  // mapRawBookRow resolves every camelCase LibraryBookRow field (topics,
  // readingLevel, ageRating, trailerVideoUrl, ...) from the raw snake_case
  // columns — spreading the raw row on top afterward adds the Studio-only
  // fields (pricing_model, review_note, ...) without re-clobbering those,
  // since none of the key names collide.
  const row = data as unknown as RawLibraryBookRow & LibraryStudioBookFields & {
    library_authors: { name: string } | null;
    library_publishers: { name: string } | null;
  };
  return { ...mapRawBookRow(row, row.library_authors?.name ?? "", row.library_publishers?.name ?? null), ...row };
}

// ─── Gallery ────────────────────────────────────────────────────────────

export async function fetchBookGallery(bookId: string): Promise<LibraryBookGalleryRow[]> {
  const { data, error } = await supabase.from("library_book_gallery").select("*").eq("book_id", bookId).order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryBookGalleryRow[];
}

export async function addGalleryItem(bookId: string, item: { media_type: "image" | "video"; url: string; caption?: string; display_order: number }): Promise<void> {
  const { error } = await supabase.from("library_book_gallery").insert({ book_id: bookId, ...item, caption: item.caption ?? null });
  if (error) throw new Error(error.message);
}

export async function removeGalleryItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("library_book_gallery").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function reorderGallery(items: Array<{ id: string; display_order: number }>): Promise<void> {
  await Promise.all(items.map((item) => supabase.from("library_book_gallery").update({ display_order: item.display_order }).eq("id", item.id)));
}
