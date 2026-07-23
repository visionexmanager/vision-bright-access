/**
 * Academy — Digital Library Local Store (Phase 5, temporary)
 *
 * Client-only (localStorage) persistence, same honesty contract as
 * lessonLocalStore.ts / instructorLocalStore.ts. Per this phase's explicit
 * "do not hardcode data" instruction, there is NO pre-seeded resource array —
 * the catalog starts empty and is populated only through real admin UI
 * (AdminLibraryResources.tsx), so nothing here is fabricated content.
 */

import type { AcademyLibraryResourceRow, AcademyLibraryResourceType, AcademyResourceDifficulty } from "@/lib/types/academy-modules";
import type {
  AcademyReadingProgressRow, AcademyResourceNoteRow, AcademyResourceHighlightRow,
  AcademyResourceFavoriteRow, AcademyResourceReviewRow, AcademyResourceCollectionRow,
} from "@/lib/types/academy-library";
import { readJSON, writeJSON } from "../storage/localStorageUtils";

const RESOURCES_KEY = "academy:library-resources";
const BOOKMARKS_KEY = "academy:library-bookmarks";
const FAVORITES_KEY = "academy:library-favorites";
const PROGRESS_KEY = "academy:library-progress";
const NOTES_KEY = "academy:library-notes";
const HIGHLIGHTS_KEY = "academy:library-highlights";
const REVIEWS_KEY = "academy:library-reviews";
const COLLECTIONS_KEY = "academy:library-collections";

// ── Resources (admin-authored catalog) ────────────────────────────────────────

export function getAllResourcesLocal(): AcademyLibraryResourceRow[] {
  return Object.values(readJSON<Record<string, AcademyLibraryResourceRow>>(RESOURCES_KEY, {}));
}

export function getResourceByIdLocal(id: string): AcademyLibraryResourceRow | null {
  return readJSON<Record<string, AcademyLibraryResourceRow>>(RESOURCES_KEY, {})[id] ?? null;
}

export function createResourceLocal(data: Partial<AcademyLibraryResourceRow>): AcademyLibraryResourceRow {
  const all = readJSON<Record<string, AcademyLibraryResourceRow>>(RESOURCES_KEY, {});
  const id = `local-resource-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const resource: AcademyLibraryResourceRow = {
    id,
    title: data.title ?? "مورد بدون عنوان",
    type: (data.type ?? "document") as AcademyLibraryResourceType,
    subject: data.subject ?? "",
    level: data.level ?? "",
    url: data.url ?? "",
    created_at: now,
    description: data.description ?? "",
    category: data.category ?? "عام",
    language: data.language ?? "العربية",
    author: data.author ?? null,
    publisher: data.publisher ?? null,
    publication_date: data.publication_date ?? null,
    edition: data.edition ?? null,
    version: data.version ?? null,
    pages: data.pages ?? null,
    reading_time_minutes: data.reading_time_minutes ?? null,
    downloads_count: 0,
    views_count: 0,
    bookmarks_count: 0,
    rating_avg: null,
    rating_count: 0,
    tags: data.tags ?? [],
    difficulty: (data.difficulty ?? "beginner") as AcademyResourceDifficulty,
    accessibility_info: data.accessibility_info ?? null,
    cover_image_url: null,
    external_source: null,
    external_id: null,
  };
  all[id] = resource;
  writeJSON(RESOURCES_KEY, all);
  return resource;
}

export function updateResourceLocal(id: string, updates: Partial<AcademyLibraryResourceRow>): AcademyLibraryResourceRow | null {
  const all = readJSON<Record<string, AcademyLibraryResourceRow>>(RESOURCES_KEY, {});
  const existing = all[id];
  if (!existing) return null;
  const next = { ...existing, ...updates };
  all[id] = next;
  writeJSON(RESOURCES_KEY, all);
  return next;
}

export function deleteResourceLocal(id: string): void {
  const all = readJSON<Record<string, AcademyLibraryResourceRow>>(RESOURCES_KEY, {});
  delete all[id];
  writeJSON(RESOURCES_KEY, all);
}

export interface LocalLibraryFilters {
  query?: string;
  category?: string;
  type?: string;
  language?: string;
  difficulty?: string;
  sort?: "popular" | "new" | "recommended" | "trending";
}

export function searchResourcesLocal(filters: LocalLibraryFilters = {}): AcademyLibraryResourceRow[] {
  let results = getAllResourcesLocal();

  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase();
    results = results.filter((r) =>
      r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  if (filters.category) results = results.filter((r) => r.category === filters.category);
  if (filters.type) results = results.filter((r) => r.type === filters.type);
  if (filters.language) results = results.filter((r) => r.language === filters.language);
  if (filters.difficulty) results = results.filter((r) => r.difficulty === filters.difficulty);

  if (filters.sort === "popular") results = [...results].sort((a, b) => b.views_count - a.views_count);
  else if (filters.sort === "new") results = [...results].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  else if (filters.sort === "trending") results = [...results].sort((a, b) => b.downloads_count - a.downloads_count);
  else results = [...results].sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0));

  return results;
}

export function getAllLibraryCategories(): string[] {
  return Array.from(new Set(getAllResourcesLocal().map((r) => r.category)));
}

export function recordResourceView(resourceId: string): void {
  updateResourceLocal(resourceId, { views_count: (getResourceByIdLocal(resourceId)?.views_count ?? 0) + 1 });
}

// ── Bookmarks & Favorites ─────────────────────────────────────────────────────

export function getBookmarkedResourceIds(userId: string): string[] {
  const all = readJSON<Record<string, string[]>>(BOOKMARKS_KEY, {});
  return all[userId] ?? [];
}

export function toggleBookmarkLocal(userId: string, resourceId: string): boolean {
  const all = readJSON<Record<string, string[]>>(BOOKMARKS_KEY, {});
  const current = all[userId] ?? [];
  const isBookmarked = current.includes(resourceId);
  all[userId] = isBookmarked ? current.filter((id) => id !== resourceId) : [...current, resourceId];
  writeJSON(BOOKMARKS_KEY, all);
  return !isBookmarked;
}

export function getFavoriteResourceIds(userId: string): string[] {
  const all = readJSON<Record<string, string[]>>(FAVORITES_KEY, {});
  return all[userId] ?? [];
}

export function toggleFavoriteResourceLocal(userId: string, resourceId: string): boolean {
  const all = readJSON<Record<string, string[]>>(FAVORITES_KEY, {});
  const current = all[userId] ?? [];
  const isFavorite = current.includes(resourceId);
  all[userId] = isFavorite ? current.filter((id) => id !== resourceId) : [...current, resourceId];
  writeJSON(FAVORITES_KEY, all);
  return !isFavorite;
}

// ── Reading Progress ───────────────────────────────────────────────────────────

type ProgressMap = Record<string, AcademyReadingProgressRow>; // `${userId}:${resourceId}` -> row

export function getReadingProgressLocal(userId: string, resourceId: string): AcademyReadingProgressRow | null {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  return map[`${userId}:${resourceId}`] ?? null;
}

/** Every resource this user has opened, across the whole library — feeds gamification statistics. */
export function getAllReadingProgressForUser(userId: string): AcademyReadingProgressRow[] {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  return Object.values(map).filter((p) => p.user_id === userId);
}

export function setReadingProgressLocal(
  userId: string,
  resourceId: string,
  update: Partial<Pick<AcademyReadingProgressRow, "current_page" | "percent_complete">>
): AcademyReadingProgressRow {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  const key = `${userId}:${resourceId}`;
  const next: AcademyReadingProgressRow = {
    user_id: userId,
    resource_id: resourceId,
    current_page: null,
    percent_complete: 0,
    ...map[key],
    ...update,
    last_opened_at: new Date().toISOString(),
  };
  map[key] = next;
  writeJSON(PROGRESS_KEY, map);
  return next;
}

export function getRecentlyOpenedResources(userId: string, limit = 10): AcademyLibraryResourceRow[] {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  const entries = Object.values(map)
    .filter((p) => p.user_id === userId)
    .sort((a, b) => new Date(b.last_opened_at).getTime() - new Date(a.last_opened_at).getTime())
    .slice(0, limit);
  return entries.map((p) => getResourceByIdLocal(p.resource_id)).filter((r): r is AcademyLibraryResourceRow => r !== null);
}

// ── Notes ──────────────────────────────────────────────────────────────────────

export function getResourceNotesLocal(resourceId: string): AcademyResourceNoteRow[] {
  const all = readJSON<AcademyResourceNoteRow[]>(NOTES_KEY, []);
  return all.filter((n) => n.resource_id === resourceId);
}

export function addResourceNoteLocal(userId: string, resourceId: string, content: string, page: number | null = null): AcademyResourceNoteRow {
  const all = readJSON<AcademyResourceNoteRow[]>(NOTES_KEY, []);
  const note: AcademyResourceNoteRow = { id: crypto.randomUUID(), user_id: userId, resource_id: resourceId, page, content, created_at: new Date().toISOString() };
  all.push(note);
  writeJSON(NOTES_KEY, all);
  return note;
}

export function removeResourceNoteLocal(noteId: string): void {
  const all = readJSON<AcademyResourceNoteRow[]>(NOTES_KEY, []);
  writeJSON(NOTES_KEY, all.filter((n) => n.id !== noteId));
}

// ── Highlights ─────────────────────────────────────────────────────────────────

export function getResourceHighlightsLocal(resourceId: string): AcademyResourceHighlightRow[] {
  const all = readJSON<AcademyResourceHighlightRow[]>(HIGHLIGHTS_KEY, []);
  return all.filter((h) => h.resource_id === resourceId);
}

export function addResourceHighlightLocal(
  userId: string, resourceId: string, quotedText: string, color = "#fde047", page: number | null = null
): AcademyResourceHighlightRow {
  const all = readJSON<AcademyResourceHighlightRow[]>(HIGHLIGHTS_KEY, []);
  const highlight: AcademyResourceHighlightRow = {
    id: crypto.randomUUID(), user_id: userId, resource_id: resourceId, page, quoted_text: quotedText, color, created_at: new Date().toISOString(),
  };
  all.push(highlight);
  writeJSON(HIGHLIGHTS_KEY, all);
  return highlight;
}

export function removeResourceHighlightLocal(highlightId: string): void {
  const all = readJSON<AcademyResourceHighlightRow[]>(HIGHLIGHTS_KEY, []);
  writeJSON(HIGHLIGHTS_KEY, all.filter((h) => h.id !== highlightId));
}

// ── Reviews ────────────────────────────────────────────────────────────────────

export function getResourceReviewsLocal(resourceId: string): AcademyResourceReviewRow[] {
  const all = readJSON<AcademyResourceReviewRow[]>(REVIEWS_KEY, []);
  return all.filter((r) => r.resource_id === resourceId);
}

export function addResourceReviewLocal(userId: string, resourceId: string, rating: 1 | 2 | 3 | 4 | 5, comment: string | null): AcademyResourceReviewRow {
  const all = readJSON<AcademyResourceReviewRow[]>(REVIEWS_KEY, []);
  const review: AcademyResourceReviewRow = { id: crypto.randomUUID(), user_id: userId, resource_id: resourceId, rating, comment, created_at: new Date().toISOString() };
  all.push(review);
  writeJSON(REVIEWS_KEY, all);

  const ratings = [...all.filter((r) => r.resource_id === resourceId)].map((r) => r.rating);
  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  updateResourceLocal(resourceId, { rating_avg: Math.round(avg * 10) / 10, rating_count: ratings.length });

  return review;
}

// ── Collections (editorial or personal) ───────────────────────────────────────

export function getCollectionsLocal(): AcademyResourceCollectionRow[] {
  return readJSON<AcademyResourceCollectionRow[]>(COLLECTIONS_KEY, []);
}

export function createCollectionLocal(title: string, description: string | null, ownerUserId: string | null): AcademyResourceCollectionRow {
  const all = readJSON<AcademyResourceCollectionRow[]>(COLLECTIONS_KEY, []);
  const collection: AcademyResourceCollectionRow = {
    id: crypto.randomUUID(), title, description, owner_user_id: ownerUserId, resource_ids: [], cover_image_url: null, created_at: new Date().toISOString(),
  };
  all.push(collection);
  writeJSON(COLLECTIONS_KEY, all);
  return collection;
}

export function addResourceToCollectionLocal(collectionId: string, resourceId: string): void {
  const all = readJSON<AcademyResourceCollectionRow[]>(COLLECTIONS_KEY, []);
  const next = all.map((c) => (c.id === collectionId && !c.resource_ids.includes(resourceId) ? { ...c, resource_ids: [...c.resource_ids, resourceId] } : c));
  writeJSON(COLLECTIONS_KEY, next);
}
