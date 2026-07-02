/**
 * Academy — Digital Library Types (Phase 5 architecture prep)
 *
 * Extends AcademyLibraryResourceRow (academy-modules.ts) with reading state,
 * annotations, reviews, curated collections, and an import-batch model for
 * future automated catalog ingestion. No hardcoded resource data ships with
 * this phase — see lib/academy/libraryLocalStore.ts for how the (currently
 * empty) catalog is populated via real admin-authored UI instead.
 */

// ── Reading progress / bookmarks-with-position / notes / highlights ─────────
// Planned tables: academy_reading_progress, academy_resource_notes,
// academy_resource_highlights. All FK user_id → academy_profiles.user_id,
// resource_id → AcademyLibraryResourceRow.id (academy-modules.ts)

export interface AcademyReadingProgressRow {
  user_id: string;
  resource_id: string;
  /** Page number for paginated formats, or percent-through for audio/continuous formats. */
  current_page: number | null;
  percent_complete: number;
  last_opened_at: string;
}

export interface AcademyResourceNoteRow {
  id: string;
  user_id: string;
  resource_id: string;
  page: number | null;
  content: string;
  created_at: string;
}

export interface AcademyResourceHighlightRow {
  id: string;
  user_id: string;
  resource_id: string;
  page: number | null;
  quoted_text: string;
  color: string;
  created_at: string;
}

export interface AcademyResourceFavoriteRow {
  user_id: string;
  resource_id: string;
  created_at: string;
}

// ── Reviews ──────────────────────────────────────────────────────────────────
// Planned table: academy_resource_reviews

export interface AcademyResourceReviewRow {
  id: string;
  user_id: string;
  resource_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  created_at: string;
}

// ── Collections ────────────────────────────────────────────────────────────────
// Planned tables: academy_resource_collections, academy_resource_collection_items
// Curated (editorial) or personal (user-created) groupings of resources.

export interface AcademyResourceCollectionRow {
  id: string;
  title: string;
  description: string | null;
  /** null = editorial/official collection; set = a user's personal collection. */
  owner_user_id: string | null;
  resource_ids: string[];
  cover_image_url: string | null;
  created_at: string;
}

// ── AI Library Integration ────────────────────────────────────────────────────
// Generation itself is out of scope for Phase 5 — these types model the
// request/response lifecycle so the UI can show honest "generating/ready"
// states once a real AI pipeline is wired to src/services/academy/library.ts.

export type AcademyResourceAIArtifactType = "summary" | "flashcards" | "mind_map" | "key_concepts" | "study_notes";

export interface AcademyResourceAIArtifactRow {
  id: string;
  resource_id: string;
  type: AcademyResourceAIArtifactType;
  status: "requested" | "generating" | "ready" | "failed";
  content: string | null; // markdown, or JSON-stringified structure for flashcards/mind_map
  generated_at: string | null;
}

// ── Import Architecture ───────────────────────────────────────────────────────
// Planned table: academy_resource_import_batches
// Models a bulk-import job from an external catalog/API, keyed against
// AcademyLibraryResourceRow.external_source / external_id for deduplication
// on re-import. No importer is implemented yet — this is the shape a future
// one will write to.

export type AcademyImportBatchStatus = "queued" | "running" | "completed" | "failed";

export interface AcademyResourceImportBatchRow {
  id: string;
  source: string;            // e.g. "openlibrary", "arxiv", "manual-csv"
  status: AcademyImportBatchStatus;
  records_found: number;
  records_imported: number;
  records_skipped: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  /** FK → academy_profiles.user_id — the admin who triggered the import. */
  triggered_by_user_id: string;
}
