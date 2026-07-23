/**
 * useOfflineBook — Cache-API-backed offline reading for reflowable-text
 * books. Not IndexedDB: the payload is just text/JSON, no query needs, and
 * the Cache API's "store a Response, serve it on fetch" model is a direct
 * fit. saveForOffline fetches chapters that are already RLS-gated (so an
 * offline save can never smuggle out content the user lacks rights to).
 * Callers should also call useDownloads().toggleDownload(bookId) alongside
 * saveForOffline so the save shows up in the existing Downloads page too —
 * this hook only owns the Cache API side, not the library_downloads log.
 *
 * PDF-mode books are NOT supported for offline (see Phase 6 plan's scope
 * boundaries) — callers should not offer this for pdf-iframe render mode.
 */

import { useCallback, useEffect, useState } from "react";
import type { LibraryChapterRow } from "@/lib/types/library-book";

const CACHE_NAME = "visionex-library-offline";

interface OfflineBookManifest {
  bookId: string;
  title: string;
  coverImageUrl: string | null;
  chapterIds: string[];
  savedAt: string;
}

function manifestKey(bookId: string) {
  return `/offline/${bookId}/manifest`;
}
function chapterKey(bookId: string, chapterId: string) {
  return `/offline/${bookId}/chapter/${chapterId}`;
}

async function jsonResponse(data: unknown): Promise<Response> {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

export function useOfflineBook(bookId: string | undefined) {
  const [isAvailableOffline, setIsAvailableOffline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const checkAvailability = useCallback(async () => {
    if (!bookId || !("caches" in window)) {
      setIsAvailableOffline(false);
      return;
    }
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(manifestKey(bookId));
    setIsAvailableOffline(!!match);
  }, [bookId]);

  useEffect(() => {
    void checkAvailability();
  }, [checkAvailability]);

  const saveForOffline = useCallback(
    async (title: string, coverImageUrl: string | null, chapters: LibraryChapterRow[], onProgress?: (done: number, total: number) => void) => {
      if (!bookId || !("caches" in window)) return false;
      setIsSaving(true);
      try {
        const cache = await caches.open(CACHE_NAME);
        for (let i = 0; i < chapters.length; i++) {
          await cache.put(chapterKey(bookId, chapters[i].id), await jsonResponse(chapters[i]));
          onProgress?.(i + 1, chapters.length);
        }
        const manifest: OfflineBookManifest = {
          bookId,
          title,
          coverImageUrl,
          chapterIds: chapters.map((c) => c.id),
          savedAt: new Date().toISOString(),
        };
        await cache.put(manifestKey(bookId), await jsonResponse(manifest));
        setIsAvailableOffline(true);
        return true;
      } catch (err) {
        console.error("Failed to save book for offline reading:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [bookId]
  );

  const removeOffline = useCallback(async () => {
    if (!bookId || !("caches" in window)) return;
    const cache = await caches.open(CACHE_NAME);
    const manifestRes = await cache.match(manifestKey(bookId));
    if (manifestRes) {
      const manifest = (await manifestRes.json()) as OfflineBookManifest;
      for (const chapterId of manifest.chapterIds) await cache.delete(chapterKey(bookId, chapterId));
    }
    await cache.delete(manifestKey(bookId));
    setIsAvailableOffline(false);
  }, [bookId]);

  const loadOfflineChapter = useCallback(
    async (chapterId: string): Promise<LibraryChapterRow | null> => {
      if (!bookId || !("caches" in window)) return null;
      const cache = await caches.open(CACHE_NAME);
      const res = await cache.match(chapterKey(bookId, chapterId));
      return res ? ((await res.json()) as LibraryChapterRow) : null;
    },
    [bookId]
  );

  return { isAvailableOffline, isSaving, saveForOffline, removeOffline, loadOfflineChapter };
}

/** Lists every book saved offline (for the "manage locally saved books" UI) —
 *  not scoped to a single bookId, so it's a standalone function rather than
 *  part of the per-book hook above. */
export async function listOfflineBooks(): Promise<OfflineBookManifest[]> {
  if (!("caches" in window)) return [];
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  const manifests: OfflineBookManifest[] = [];
  for (const request of keys) {
    if (!request.url.endsWith("/manifest")) continue;
    const res = await cache.match(request);
    if (res) manifests.push((await res.json()) as OfflineBookManifest);
  }
  return manifests;
}

export async function removeOfflineBookById(bookId: string): Promise<void> {
  if (!("caches" in window)) return;
  const cache = await caches.open(CACHE_NAME);
  const manifestRes = await cache.match(manifestKey(bookId));
  if (manifestRes) {
    const manifest = (await manifestRes.json()) as OfflineBookManifest;
    for (const chapterId of manifest.chapterIds) await cache.delete(chapterKey(bookId, chapterId));
  }
  await cache.delete(manifestKey(bookId));
}
