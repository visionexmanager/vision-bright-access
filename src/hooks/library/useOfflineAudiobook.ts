/**
 * useOfflineAudiobook — Cache-API-backed offline listening, mirroring
 * useOfflineBook.ts's pattern but for binary audio chapters: a separate
 * cache name keeps audio Blobs apart from the JSON-only text cache.
 *
 * Partial-download tracking (the Cache API alone can't do this — there is
 * no incremental-append primitive) is done via a small localStorage
 * manifest plus an in-memory chunk buffer kept in a ref. Resume works
 * WITHIN the same tab session (network drop/reconnect while the tab stays
 * open, via a Range request appended to the in-memory buffer); a full page
 * reload restarts an in-progress chapter's download from zero —
 * session-durable partial-byte storage would need IndexedDB, which this
 * codebase's own offline-text precedent (useOfflineBook.ts) deliberately
 * avoided. Documented Phase 7 scope boundary, not an oversight.
 *
 * Once a chapter's Blob is fully committed to Cache, a library_downloads
 * row is logged exactly as useDownloads() does for text books.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getSignedBookFileUrl } from "@/services/library/readerFiles";
import type { LibraryAudiobookChapterRow } from "@/lib/types/library-audiobook";

const CACHE_NAME = "visionex-library-offline-audio";
const MANIFEST_PREFIX = "visionex:library:offline-audio:";

interface ChapterDownloadState {
  totalBytes: number;
  downloadedBytes: number;
  completed: boolean;
}
type AudiobookManifest = Record<string, ChapterDownloadState>;

function audioKey(bookId: string, chapterId: string) {
  return `/offline-audio/${bookId}/chapter/${chapterId}`;
}
function manifestStorageKey(bookId: string) {
  return `${MANIFEST_PREFIX}${bookId}`;
}
function readManifest(bookId: string): AudiobookManifest {
  try {
    const raw = localStorage.getItem(manifestStorageKey(bookId));
    return raw ? (JSON.parse(raw) as AudiobookManifest) : {};
  } catch {
    return {};
  }
}
function writeManifest(bookId: string, manifest: AudiobookManifest) {
  try {
    localStorage.setItem(manifestStorageKey(bookId), JSON.stringify(manifest));
  } catch {
    // localStorage unavailable/full — download still completes for this session, just not tracked for resume.
  }
}

export function useOfflineAudiobook(bookId: string | undefined) {
  const { user } = useAuth();
  const [manifest, setManifest] = useState<AudiobookManifest>({});
  const [downloadingChapterId, setDownloadingChapterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chunkBuffersRef = useRef<Record<string, Uint8Array[]>>({});

  useEffect(() => {
    if (!bookId) return;
    setManifest(readManifest(bookId));
  }, [bookId]);

  const updateProgress = useCallback(
    (chapterId: string, downloadedBytes: number, totalBytes: number, completed: boolean) => {
      setManifest((prev) => {
        const next = { ...prev, [chapterId]: { downloadedBytes, totalBytes, completed } };
        if (bookId) writeManifest(bookId, next);
        return next;
      });
    },
    [bookId]
  );

  const downloadChapter = useCallback(
    async (chapter: LibraryAudiobookChapterRow, storagePath: string): Promise<boolean> => {
      if (!bookId || !("caches" in window)) return false;
      setDownloadingChapterId(chapter.id);
      setError(null);

      try {
        const signedUrl = await getSignedBookFileUrl(storagePath, "library-audiobooks");
        if (!signedUrl) throw new Error("Could not get a secure link for this chapter");

        const existingChunks = chunkBuffersRef.current[chapter.id] ?? [];
        let downloadedBytes = existingChunks.reduce((sum, c) => sum + c.length, 0);

        const res = await fetch(signedUrl, downloadedBytes > 0 ? { headers: { Range: `bytes=${downloadedBytes}-` } } : undefined);
        if (!res.ok && res.status !== 206) throw new Error(`Download failed (${res.status})`);

        const contentRange = res.headers.get("Content-Range");
        const totalBytes = contentRange
          ? Number(contentRange.split("/")[1] ?? 0)
          : downloadedBytes + Number(res.headers.get("Content-Length") ?? 0);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Streaming downloads are not supported by this browser");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          existingChunks.push(value);
          downloadedBytes += value.length;
          chunkBuffersRef.current[chapter.id] = existingChunks;
          updateProgress(chapter.id, downloadedBytes, totalBytes || downloadedBytes, false);
        }

        const blob = new Blob(existingChunks.map((c) => new Uint8Array(c)), { type: "audio/mpeg" });
        const cache = await caches.open(CACHE_NAME);
        await cache.put(audioKey(bookId, chapter.id), new Response(blob, { headers: { "Content-Type": "audio/mpeg" } }));
        delete chunkBuffersRef.current[chapter.id];
        updateProgress(chapter.id, downloadedBytes, downloadedBytes, true);

        if (user && chapter.audio_file_id) {
          await supabase.from("library_downloads").insert({ user_id: user.id, book_id: bookId, file_id: chapter.audio_file_id });
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setDownloadingChapterId(null);
      }
    },
    [bookId, user, updateProgress]
  );

  const isChapterDownloaded = useCallback((chapterId: string) => manifest[chapterId]?.completed ?? false, [manifest]);

  const loadOfflineChapterUrl = useCallback(
    async (chapterId: string): Promise<string | null> => {
      if (!bookId || !("caches" in window)) return null;
      const cache = await caches.open(CACHE_NAME);
      const res = await cache.match(audioKey(bookId, chapterId));
      if (!res) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    [bookId]
  );

  const deleteOfflineChapter = useCallback(
    async (chapterId: string) => {
      if (!bookId || !("caches" in window)) return;
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(audioKey(bookId, chapterId));
      delete chunkBuffersRef.current[chapterId];
      setManifest((prev) => {
        const next = { ...prev };
        delete next[chapterId];
        writeManifest(bookId, next);
        return next;
      });
    },
    [bookId]
  );

  return { manifest, downloadingChapterId, error, downloadChapter, isChapterDownloaded, loadOfflineChapterUrl, deleteOfflineChapter };
}
