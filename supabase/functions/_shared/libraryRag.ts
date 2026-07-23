// ─── Library AI Reading Assistant — RAG helpers (Phase 6.5) ───────────────
// Shared by library-ai-assistant, library-ai-chat, and library-embed-book so
// chunking/indexing/retrieval logic exists in exactly one place. Built on
// the existing createEmbedding() (OpenAI text-embedding-3-small, 1536 dims)
// from aiProvider.ts — no new provider code, per the Phase 6.5 plan.
//
// Security: retrieval always goes through match_library_chapter_chunks(),
// called via the CALLING USER's own JWT-scoped client, never service-role —
// that RPC re-checks is_free_preview/can_access_library_book_content itself
// (SECURITY DEFINER bypasses RLS, so the check is repeated explicitly there,
// not just relied on at the table level). This function module never sends
// more than a handful of retrieved chunks to the model — the whole point of
// this file is that nothing here ever concatenates a whole book/chapter.

import { createEmbedding } from "./aiProvider.ts";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const EMBED_BATCH = 50;

/** Chapter-scoped modes read content_text directly only below this length;
 *  at or above it (e.g. a PDF import's single "Full text" mega-chapter),
 *  they fall back to chunk retrieval scoped to that one chapter instead —
 *  the same "never send a huge blob to the model" rule applied uniformly. */
export const DIRECT_READ_CHAR_THRESHOLD = 6000;

export interface RagChunk {
  chapter_id: string;
  chunk_index: number;
  content: string;
  char_count: number;
}

/** Character-based chunking with overlap, preferring to break on a
 *  paragraph or sentence boundary near the target size rather than
 *  mid-word/mid-sentence. Pure function, no I/O — easy to unit-trace. */
export function chunkText(text: string, chapterId: string): RagChunk[] {
  const clean = text.trim();
  if (!clean) return [];

  const chunks: RagChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const windowStart = Math.max(start + CHUNK_SIZE - 150, start);
      const paragraphBreak = clean.lastIndexOf("\n", end);
      const sentenceBreak = clean.lastIndexOf(". ", end);
      const cut = Math.max(paragraphBreak, sentenceBreak);
      if (cut > windowStart) end = cut + 1;
    }
    const content = clean.slice(start, end).trim();
    if (content) chunks.push({ chapter_id: chapterId, chunk_index: index++, content, char_count: content.length });
    if (end >= clean.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

// deno-lint-ignore no-explicit-any
type ServiceClient = any;
// deno-lint-ignore no-explicit-any
type UserClient = any;

/** Lazily indexes a book: no-op if chunks already exist (unless
 *  forceReindex), otherwise chunks every chapter's content_text and embeds
 *  it via createEmbedding(), batched. Runs on the service-role client since
 *  writing library_chapter_chunks has no client-facing RLS policy at all. */
export async function ensureBookIndexed(
  serviceClient: ServiceClient,
  bookId: string,
  opts: { forceReindex?: boolean } = {},
): Promise<{ indexed: boolean; chunkCount: number }> {
  if (!opts.forceReindex) {
    const { count } = await serviceClient
      .from("library_chapter_chunks")
      .select("id", { count: "exact", head: true })
      .eq("book_id", bookId);
    if (count && count > 0) return { indexed: true, chunkCount: count };
  }

  const { data: chapters, error } = await serviceClient
    .from("library_chapters")
    .select("id, content_text")
    .eq("book_id", bookId);
  if (error) throw error;
  if (!chapters || chapters.length === 0) return { indexed: false, chunkCount: 0 };

  if (opts.forceReindex) {
    const { error: delErr } = await serviceClient.from("library_chapter_chunks").delete().eq("book_id", bookId);
    if (delErr) throw delErr;
  }

  const allChunks: RagChunk[] = [];
  for (const chapter of chapters as Array<{ id: string; content_text: string | null }>) {
    if (!chapter.content_text) continue;
    allChunks.push(...chunkText(chapter.content_text, chapter.id));
  }
  if (allChunks.length === 0) return { indexed: false, chunkCount: 0 };

  let total = 0;
  for (let i = 0; i < allChunks.length; i += EMBED_BATCH) {
    const batch = allChunks.slice(i, i + EMBED_BATCH);
    const vectors = await createEmbedding(batch.map((c) => c.content));
    const rows = batch.map((c, j) => ({
      book_id: bookId,
      chapter_id: c.chapter_id,
      chunk_index: c.chunk_index,
      content: c.content,
      char_count: c.char_count,
      embedding: vectors[j],
    }));
    const { error: upsertErr } = await serviceClient
      .from("library_chapter_chunks")
      .upsert(rows, { onConflict: "chapter_id,chunk_index" });
    if (upsertErr) throw upsertErr;
    total += rows.length;
  }

  return { indexed: true, chunkCount: total };
}

export interface RetrievedChunk {
  chunkId: string;
  chapterId: string;
  chapterTitle: string | null;
  content: string;
  similarity: number;
}

/** Embeds `queryText` and retrieves the most relevant chunks for one book
 *  (optionally scoped to one chapter) via the CALLER's own JWT-scoped
 *  client — this is what keeps retrieval RLS/access-check-correct: a
 *  non-purchaser's client can never pull chunks from a paid book's
 *  non-preview chapters, because match_library_chapter_chunks() re-checks
 *  that itself. */
export async function retrieveChunks(
  userClient: UserClient,
  bookId: string,
  queryText: string,
  opts: { matchCount?: number; chapterId?: string } = {},
): Promise<RetrievedChunk[]> {
  const [embedding] = await createEmbedding([queryText.slice(0, 2000)]);
  const { data, error } = await userClient.rpc("match_library_chapter_chunks", {
    _book_id: bookId,
    _query_embedding: embedding,
    _match_count: opts.matchCount ?? 8,
    _chapter_id: opts.chapterId ?? null,
  });
  if (error) throw error;

  return (data ?? []).map((r: { chunk_id: string; chapter_id: string; chapter_title: string | null; content: string; similarity: number }) => ({
    chunkId: r.chunk_id,
    chapterId: r.chapter_id,
    chapterTitle: r.chapter_title,
    content: r.content,
    similarity: r.similarity,
  }));
}

/** Formats retrieved chunks as one context block for a system/user prompt,
 *  each excerpt labeled with its chapter so the model (and citations built
 *  from the same chunk list) can reference where it came from. */
export function formatChunksAsContext(chunks: RetrievedChunk[]): string {
  return chunks.map((c) => `[${c.chapterTitle ?? "Excerpt"}]\n${c.content}`).join("\n\n---\n\n");
}

/** Deduplicated {chapterId, chapterTitle} list from a retrieval result —
 *  what library-ai-chat sends back as the X-Library-Citations header. */
export function citationsFromChunks(chunks: RetrievedChunk[]): Array<{ chapterId: string; chapterTitle: string | null }> {
  const seen = new Map<string, string | null>();
  for (const c of chunks) if (!seen.has(c.chapterId)) seen.set(c.chapterId, c.chapterTitle);
  return Array.from(seen, ([chapterId, chapterTitle]) => ({ chapterId, chapterTitle }));
}
