import type { LibraryChapterRow } from "@/lib/types/library-book";
import type { LibraryBookFileRow, ReaderRenderMode } from "@/lib/types/library-reader";

/**
 * Decides which of the reader's two rendering modes a book gets, per the
 * Phase 6 plan's "text-first + native PDF fallback" architecture:
 *
 * - reflowable-text: any chapter has page_start/page_end populated (EPUB
 *   import, real per-chapter pages) OR ≥2 chapters exist (multi-chapter
 *   hand-seeded TXT/HTML/BRF) — page-accurate or clearly multi-chapter
 *   content is trustworthy for the custom reflowable engine.
 * - pdf-iframe: a raw PDF file exists and the above didn't already qualify
 *   — covers both a raw-PDF-only book (no chapters at all) AND a
 *   PDF-imported book whose single "Full text" blob chapter has no page
 *   numbers (library-import-book's PDF path never sets page_start/end, so
 *   that blob isn't page-accurate; the real PDF is a better fallback).
 * - reflowable-text (fallback): exactly one chapter with real content_text
 *   and NO pdf file to fall back to (a hand-seeded single-chapter TXT/HTML/
 *   BRF book) — something readable beats an "unsupported" dead end.
 * - unsupported: nothing usable (DOCX-only, or no content and no file at
 *   all) — the user's own requested "clear error + suggestion" fallback.
 */
export function decideReaderRenderMode(chapters: LibraryChapterRow[], files: LibraryBookFileRow[]): ReaderRenderMode {
  const hasPageAccurateChapter = chapters.some((c) => c.page_start != null && c.page_end != null);
  const hasMultipleChapters = chapters.length >= 2;
  if (hasPageAccurateChapter || hasMultipleChapters) return "reflowable-text";

  const hasPdfFile = files.some((f) => f.file_type === "pdf");
  if (hasPdfFile) return "pdf-iframe";

  const hasAnyContentText = chapters.some((c) => !!c.content_text?.trim());
  if (hasAnyContentText) return "reflowable-text";

  return "unsupported";
}
