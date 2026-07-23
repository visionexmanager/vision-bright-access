// ─── Library — Import Review Service (Phase 11) ───────────────────────────
// Admin moderation queue for public-domain imports (library-import-book
// with public_domain: true) — regular authors' own self-service imports
// stay in 'draft', under their own control, and never appear here.

import { supabase } from "@/integrations/supabase/client";
import { mapRawBookRow, type RawLibraryBookRow } from "@/services/library/catalog";
import { logLibraryAuditEvent } from "@/services/library/auditLog";
import type { LibraryBookRow } from "@/lib/types/library-book";

export interface LibraryImportQueueItem extends LibraryBookRow {
  importSource: string | null;
  importedBy: string | null;
  potentialDuplicateOf: string | null;
  potentialDuplicateTitle: string | null;
}

export async function fetchImportReviewQueue(): Promise<LibraryImportQueueItem[]> {
  const { data, error } = await supabase
    .from("library_books")
    .select("*, library_authors(name), library_publishers(name), duplicate:library_books!potential_duplicate_of(title)")
    .eq("publish_status", "review")
    .not("import_source", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<
    RawLibraryBookRow & {
      library_authors: { name: string } | null;
      library_publishers: { name: string } | null;
      import_source: string | null;
      imported_by: string | null;
      potential_duplicate_of: string | null;
      duplicate: { title: string } | null;
    }
  >).map((row) => ({
    ...mapRawBookRow(row, row.library_authors?.name ?? "", row.library_publishers?.name ?? null),
    importSource: row.import_source,
    importedBy: row.imported_by,
    potentialDuplicateOf: row.potential_duplicate_of,
    potentialDuplicateTitle: row.duplicate?.title ?? null,
  }));
}

/** Approves the import and enqueues background auto-classification — public-
 *  domain imports never went through the Studio's "Classify with AI" button,
 *  so this queues that same work (see library-process-background-jobs)
 *  instead of leaving newly-published imports uncategorized. */
export async function approveImportedBook(bookId: string): Promise<void> {
  const { error } = await supabase.from("library_books").update({ publish_status: "published" }).eq("id", bookId);
  if (error) throw new Error(error.message);

  const { error: enqueueError } = await supabase.rpc("enqueue_library_background_job", {
    _job_type: "classify_and_index_book",
    _payload: { book_id: bookId },
  });
  if (enqueueError) console.error("Failed to enqueue classify_and_index_book job:", enqueueError.message);

  await logLibraryAuditEvent("import_approved", "library_book", bookId);
}

export async function rejectImportedBook(bookId: string, reviewNote: string): Promise<void> {
  const { error } = await supabase.from("library_books").update({ publish_status: "rejected", review_note: reviewNote }).eq("id", bookId);
  if (error) throw new Error(error.message);
  await logLibraryAuditEvent("import_rejected", "library_book", bookId, { review_note: reviewNote });
}

/** "Merge as duplicate" — the imported row is discarded (rejected with a
 *  note pointing at the kept book) rather than actually merging content;
 *  a real content-level merge (chapters/files) would need a human editorial
 *  decision this tool doesn't try to automate. */
export async function markImportAsDuplicate(bookId: string, duplicateOfTitle: string): Promise<void> {
  await rejectImportedBook(bookId, `Rejected as a likely duplicate of "${duplicateOfTitle}".`);
}
