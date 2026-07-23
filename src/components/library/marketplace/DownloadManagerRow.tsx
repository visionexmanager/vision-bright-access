import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Headphones, Download, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOfflineBook } from "@/hooks/library/useOfflineBook";
import { useOfflineAudiobook } from "@/hooks/library/useOfflineAudiobook";
import { useAudiobookChapters } from "@/hooks/library/useAudiobookChapters";
import { fetchChaptersForBook } from "@/services/library/chapters";
import { fetchAudiobooksByBookIds } from "@/services/library/audiobooks";
import { fetchBookFileById } from "@/services/library/readerFiles";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryBookRow } from "@/lib/types/library-book";

interface DownloadManagerRowProps {
  book: LibraryBookRow;
}

/**
 * One row = one book's real offline state across both formats it has:
 * ebook chapters via useOfflineBook (Cache API, JSON), audiobook chapters
 * via useOfflineAudiobook (Cache API, binary, per-chapter byte progress).
 * Each format's hook instance lives in this one row component — a real
 * queue/progress UI, not a decorative one, built entirely on the existing
 * Phase 6/7 offline primitives (no new storage mechanism).
 */
export function DownloadManagerRow({ book }: DownloadManagerRowProps) {
  const { t } = useLanguage();
  const isEbook = book.formats.includes("ebook");
  const isAudiobook = book.formats.includes("audiobook");

  const { isAvailableOffline: ebookOffline, isSaving: ebookSaving, saveForOffline, removeOffline: removeEbookOffline } = useOfflineBook(book.id);
  const [ebookProgress, setEbookProgress] = useState<{ done: number; total: number } | null>(null);

  const [audiobookId, setAudiobookId] = useState<string | null>(null);
  useEffect(() => {
    if (!isAudiobook) return;
    let cancelled = false;
    void fetchAudiobooksByBookIds([book.id]).then((rows) => {
      if (!cancelled) setAudiobookId(rows[0]?.id ?? null);
    });
    return () => { cancelled = true; };
  }, [isAudiobook, book.id]);

  const { chapters: audiobookChapters } = useAudiobookChapters(audiobookId ?? undefined);
  const { manifest, downloadingChapterId, downloadChapter, isChapterDownloaded, deleteOfflineChapter } = useOfflineAudiobook(book.id);
  const [isQueuingAudiobook, setIsQueuingAudiobook] = useState(false);

  const audiobookProgress = useMemo(() => {
    const entries = Object.values(manifest);
    if (entries.length === 0) return null;
    const downloaded = entries.reduce((sum, e) => sum + e.downloadedBytes, 0);
    const total = entries.reduce((sum, e) => sum + e.totalBytes, 0);
    return total > 0 ? Math.round((downloaded / total) * 100) : 0;
  }, [manifest]);
  const allAudiobookChaptersDownloaded = audiobookChapters.length > 0 && audiobookChapters.every((c) => isChapterDownloaded(c.id));

  const handleSaveEbook = async () => {
    const chapters = await fetchChaptersForBook(book.id);
    setEbookProgress({ done: 0, total: chapters.length });
    await saveForOffline(book.title, book.cover_image_url, chapters, (done, total) => setEbookProgress({ done, total }));
    setEbookProgress(null);
  };

  const handleDownloadAudiobook = async () => {
    setIsQueuingAudiobook(true);
    try {
      for (const chapter of audiobookChapters) {
        if (isChapterDownloaded(chapter.id) || !chapter.audio_file_id) continue;
        const file = await fetchBookFileById(chapter.audio_file_id);
        if (!file) continue;
        await downloadChapter(chapter, file.storage_path);
      }
    } finally {
      setIsQueuingAudiobook(false);
    }
  };

  const handleRemoveAudiobook = async () => {
    for (const chapter of audiobookChapters) await deleteOfflineChapter(chapter.id);
  };

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <Link to={`/library/books/${book.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        {book.cover_image_url ? (
          <img src={book.cover_image_url} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-muted"><BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{book.title}</p>
          <p className="truncate text-xs text-muted-foreground">{book.author_name}</p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        {isEbook && (
          ebookProgress ? (
            <div className="flex w-40 items-center gap-2">
              <Progress value={(ebookProgress.done / ebookProgress.total) * 100} className="h-2" />
              <span className="text-xs text-muted-foreground">{ebookProgress.done}/{ebookProgress.total}</span>
            </div>
          ) : ebookOffline ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void removeEbookOffline()}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.downloads.removeEbook")}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleSaveEbook()} disabled={ebookSaving}>
              {ebookSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />}
              {t("library.downloads.saveEbook")}
            </Button>
          )
        )}

        {isAudiobook && (
          allAudiobookChaptersDownloaded ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleRemoveAudiobook()}>
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {t("library.downloads.removeAudiobook")}
            </Button>
          ) : isQueuingAudiobook || downloadingChapterId ? (
            <div className="flex w-40 items-center gap-2">
              <Progress value={audiobookProgress ?? 0} className="h-2" />
              <span className="text-xs text-muted-foreground">{audiobookProgress ?? 0}%</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void handleDownloadAudiobook()}
              disabled={audiobookChapters.length === 0}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
              {t("library.downloads.saveAudiobook")}
            </Button>
          )
        )}
      </div>
    </Card>
  );
}
