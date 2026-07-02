// ─── Academy — Digital Library Service Stubs (Phase 5 architecture prep) ─────
// Placeholder implementations, same pattern as services/academy/{modules,lms,
// instructor}.ts. The Phase 5 UI runs against
// src/lib/academy/libraryLocalStore.ts (localStorage, admin-authored via real
// UI forms — no hardcoded catalog data) so the library is genuinely usable
// once an admin adds resources. These stubs are the future Supabase contract.
//
// AI generation (summaries/flashcards/mind maps/Q&A) is explicitly modeled
// but NOT implemented — see AcademyResourceAIArtifactRow's lifecycle.

import type { AcademyLibraryResourceRow, AcademyLibraryBookmarkRow } from "@/lib/types/academy-modules";
import type {
  AcademyReadingProgressRow,
  AcademyResourceNoteRow,
  AcademyResourceHighlightRow,
  AcademyResourceFavoriteRow,
  AcademyResourceReviewRow,
  AcademyResourceCollectionRow,
  AcademyResourceAIArtifactRow,
  AcademyResourceAIArtifactType,
  AcademyResourceImportBatchRow,
} from "@/lib/types/academy-library";

export interface LibraryFilters {
  query?: string;
  category?: string;
  type?: string;
  language?: string;
  difficulty?: string;
  sort?: "popular" | "new" | "recommended" | "trending";
}

// ── Discovery ──────────────────────────────────────────────────────────────────

export async function fetchResources(filters: LibraryFilters = {}): Promise<AcademyLibraryResourceRow[]> {
  void filters;
  return [];
}

export async function fetchResourceById(resourceId: string): Promise<AcademyLibraryResourceRow | null> {
  void resourceId;
  return null;
}

export async function fetchRelatedResources(resourceId: string, limit = 4): Promise<AcademyLibraryResourceRow[]> {
  void resourceId;
  void limit;
  return [];
}

export async function fetchCollections(): Promise<AcademyResourceCollectionRow[]> {
  return [];
}

// ── Personalization ───────────────────────────────────────────────────────────

export async function fetchBookmarks(userId: string): Promise<AcademyLibraryBookmarkRow[]> {
  void userId;
  return [];
}

export async function toggleBookmark(userId: string, resourceId: string): Promise<boolean> {
  void userId;
  void resourceId;
  return false;
}

export async function fetchFavorites(userId: string): Promise<AcademyResourceFavoriteRow[]> {
  void userId;
  return [];
}

export async function toggleFavorite(userId: string, resourceId: string): Promise<boolean> {
  void userId;
  void resourceId;
  return false;
}

export async function fetchReadingProgress(userId: string, resourceId: string): Promise<AcademyReadingProgressRow | null> {
  void userId;
  void resourceId;
  return null;
}

export async function updateReadingProgress(
  progress: Omit<AcademyReadingProgressRow, "last_opened_at">
): Promise<boolean> {
  void progress;
  return false;
}

export async function fetchRecentlyOpened(userId: string, limit = 10): Promise<AcademyLibraryResourceRow[]> {
  void userId;
  void limit;
  return [];
}

// ── Notes & Highlights ────────────────────────────────────────────────────────

export async function fetchResourceNotes(userId: string, resourceId: string): Promise<AcademyResourceNoteRow[]> {
  void userId;
  void resourceId;
  return [];
}

export async function saveResourceNote(note: Omit<AcademyResourceNoteRow, "id" | "created_at">): Promise<boolean> {
  void note;
  return false;
}

export async function fetchResourceHighlights(userId: string, resourceId: string): Promise<AcademyResourceHighlightRow[]> {
  void userId;
  void resourceId;
  return [];
}

export async function saveResourceHighlight(
  highlight: Omit<AcademyResourceHighlightRow, "id" | "created_at">
): Promise<boolean> {
  void highlight;
  return false;
}

// ── Reviews ────────────────────────────────────────────────────────────────────

export async function fetchResourceReviews(resourceId: string): Promise<AcademyResourceReviewRow[]> {
  void resourceId;
  return [];
}

export async function submitResourceReview(
  review: Omit<AcademyResourceReviewRow, "id" | "created_at">
): Promise<AcademyResourceReviewRow | null> {
  void review;
  return null;
}

// ── AI Library Integration (generation out of scope) ──────────────────────────

export async function requestResourceAIArtifact(
  resourceId: string,
  type: AcademyResourceAIArtifactType
): Promise<AcademyResourceAIArtifactRow | null> {
  void resourceId;
  void type;
  return null;
}

export async function fetchResourceAIArtifact(
  resourceId: string,
  type: AcademyResourceAIArtifactType
): Promise<AcademyResourceAIArtifactRow | null> {
  void resourceId;
  void type;
  return null;
}

// ── Admin / Import ─────────────────────────────────────────────────────────────

export async function createResource(
  resource: Partial<AcademyLibraryResourceRow>
): Promise<AcademyLibraryResourceRow | null> {
  void resource;
  return null;
}

export async function updateResource(resourceId: string, updates: Partial<AcademyLibraryResourceRow>): Promise<boolean> {
  void resourceId;
  void updates;
  return false;
}

export async function deleteResource(resourceId: string): Promise<boolean> {
  void resourceId;
  return false;
}

export async function startImportBatch(source: string, adminUserId: string): Promise<AcademyResourceImportBatchRow | null> {
  void source;
  void adminUserId;
  return null;
}

export async function fetchImportBatches(): Promise<AcademyResourceImportBatchRow[]> {
  return [];
}
