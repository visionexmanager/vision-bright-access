import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { ReaderShell } from "@/components/library/reader/ReaderShell";
import { ReaderTopToolbar } from "@/components/library/reader/ReaderTopToolbar";
import { ReaderBottomToolbar } from "@/components/library/reader/ReaderBottomToolbar";
import { ReflowableTextPane } from "@/components/library/reader/panes/ReflowableTextPane";
import { PdfIframePane } from "@/components/library/reader/panes/PdfIframePane";
import { UnsupportedFormatPane } from "@/components/library/reader/panes/UnsupportedFormatPane";
import { ReaderErrorState } from "@/components/library/reader/ReaderErrorState";
import { HighlightSelectionPopover } from "@/components/library/reader/HighlightSelectionPopover";
import { TocPanel } from "@/components/library/reader/panels/TocPanel";
import { BookmarksPanel } from "@/components/library/reader/panels/BookmarksPanel";
import { NotesPanel } from "@/components/library/reader/panels/NotesPanel";
import { HighlightsPanel } from "@/components/library/reader/panels/HighlightsPanel";
import { SearchPanel } from "@/components/library/reader/panels/SearchPanel";
import { SettingsPanel } from "@/components/library/reader/panels/SettingsPanel";
import { AiSidebarPanel } from "@/components/library/reader/panels/ai/AiSidebarPanel";
import { SmartDictionaryPopover } from "@/components/library/reader/panels/ai/SmartDictionaryPopover";
import { AccessibilityDescribePanel } from "@/components/library/reader/panels/ai/AccessibilityDescribePanel";
import { ReadingCoachPanel } from "@/components/library/reader/panels/ai/ReadingCoachPanel";
import { ReadAloudControls } from "@/components/library/reader/panels/ReadAloudControls";
import { BookInfoPanel } from "@/components/library/reader/panels/BookInfoPanel";
import { OfflinePanel } from "@/components/library/reader/panels/OfflinePanel";
import { BookOpen } from "lucide-react";
import { useBookDetails } from "@/hooks/library/useBookDetails";
import { useBookAccess } from "@/hooks/library/useBookAccess";
import { useChapters } from "@/hooks/library/useChapters";
import { useAudiobookProgress } from "@/hooks/library/useAudiobookProgress";
import { useReaderSettings } from "@/hooks/library/useReaderSettings";
import { useBookmarks } from "@/hooks/library/useBookmarks";
import { useHighlights } from "@/hooks/library/useHighlights";
import { useInBookSearch } from "@/hooks/library/useInBookSearch";
import { useOfflineBook } from "@/hooks/library/useOfflineBook";
import { useDownloads } from "@/hooks/library/useDownloads";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBookFiles, getSignedBookFileUrl } from "@/services/library/readerFiles";
import { logLibraryAnalyticsEvent } from "@/services/library/analytics";
import { logReadingActivity } from "@/services/library/readingGoals";
import { syncChapterProgressToAcademy } from "@/services/library/bookToCourse";
import { decideReaderRenderMode } from "@/lib/library/readerRenderMode";
import type { ReaderPanelKey } from "@/components/library/reader/ReaderPanelTypes";
import type { LibraryHighlightColor, LibraryLastPositionText } from "@/lib/types/library-reader";
import type { InBookSearchResult } from "@/hooks/library/useInBookSearch";

export default function LibraryReader() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const deepLinkChapterId = searchParams.get("chapter");

  const { book, isLoading: bookLoading } = useBookDetails(bookId);
  const access = useBookAccess(book ? { id: book.id, is_free: book.is_free, author_id: book.author_id } : null);

  const { progress, updateTextProgress } = useAudiobookProgress(bookId);
  const { chapters, isLoading: chaptersLoading, error: chaptersError, refetch: refetchChapters } = useChapters(bookId, progress.current_page);

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: queryKeys.library.bookFiles(bookId ?? ""),
    queryFn: () => fetchBookFiles(bookId!),
    enabled: !!bookId && access.canRead,
  });

  const renderMode = useMemo(() => decideReaderRenderMode(chapters, files), [chapters, files]);
  const primaryPdfFile = useMemo(() => files.find((f) => f.file_type === "pdf") ?? files.find((f) => f.is_primary), [files]);

  const { data: signedPdfUrl = null, isLoading: isSigningUrl } = useQuery({
    queryKey: ["library", "signed-pdf-url", primaryPdfFile?.storage_path ?? ""],
    queryFn: () => getSignedBookFileUrl(primaryPdfFile!.storage_path, "library-book-files"),
    enabled: renderMode === "pdf-iframe" && !!primaryPdfFile,
  });

  // ── Active chapter (reflowable-text mode) ─────────────────────────────────
  const lastChapterId = progress.last_position && "chapter_id" in progress.last_position ? (progress.last_position as LibraryLastPositionText).chapter_id : undefined;
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [hasResumed, setHasResumed] = useState(false);
  useEffect(() => {
    if (chapters.length === 0 || hasResumed) return;
    const deepLinkIndex = deepLinkChapterId ? chapters.findIndex((c) => c.id === deepLinkChapterId) : -1;
    const resumeIndex = deepLinkIndex >= 0 ? deepLinkIndex : lastChapterId ? chapters.findIndex((c) => c.id === lastChapterId) : -1;
    setActiveChapterIndex(resumeIndex >= 0 ? resumeIndex : 0);
    setHasResumed(true);
  }, [chapters, lastChapterId, hasResumed, deepLinkChapterId]);

  const activeChapter = chapters[activeChapterIndex] ?? null;

  // Marks today as a reading-activity day (for streaks) once the reader has
  // been open a little while — not on every scroll event, and not so
  // immediately that an accidental open counts as "reading today".
  useEffect(() => {
    if (!user || !bookId) return;
    const timer = setTimeout(() => { void logReadingActivity(0, 0); }, 20_000);
    return () => clearTimeout(timer);
  }, [user, bookId]);

  // ── Settings, bookmarks, highlights, search, offline ──────────────────────
  const { settings, updateSettings } = useReaderSettings();
  const { addBookmark } = useBookmarks(bookId);
  const { highlights, addHighlight } = useHighlights(bookId ?? "", book?.title ?? "");
  const { query: searchQuery, setQuery: setSearchQuery, results: searchResults, activeIndex: searchActiveIndex, setActiveIndex: setSearchActiveIndex, next: searchNext, prev: searchPrev } = useInBookSearch(chapters);
  const { isAvailableOffline, isSaving: isSavingOffline, saveForOffline, removeOffline } = useOfflineBook(bookId);
  const { toggleDownload } = useDownloads();

  // ── Panel / selection state ────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<ReaderPanelKey | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [aiInitialText, setAiInitialText] = useState<string | undefined>(undefined);
  const [dictionaryLookup, setDictionaryLookup] = useState<{ word: string; sentence: string } | null>(null);

  const openPanel = useCallback((panel: ReaderPanelKey) => setActivePanel(panel), []);
  const closePanel = useCallback(() => setActivePanel(null), []);

  useDocumentHead({
    title: book ? `${book.title} — ${t("library.nav.reader")}` : t("library.nav.reader"),
    canonicalPath: book ? `/library/read/${book.id}` : undefined,
  });

  // ── Chapter navigation ──────────────────────────────────────────────────────
  const goToChapter = useCallback(
    (index: number) => {
      if (index < 0 || index >= chapters.length) return;
      const wasForward = index > activeChapterIndex;
      const completedChapter = chapters[activeChapterIndex];
      setActiveChapterIndex(index);
      closePanel();
      if (user && bookId) {
        void logLibraryAnalyticsEvent("page_turned", { userId: user.id, entityType: "book", entityId: bookId });
        if (wasForward) {
          void logLibraryAnalyticsEvent("chapter_completed", { userId: user.id, entityType: "book", entityId: bookId });
          // Book-to-Course integration: if this chapter maps to an Academy
          // lesson (via library_chapter_lessons), mirror its completion.
          if (completedChapter) void syncChapterProgressToAcademy(completedChapter.id, true);
        }
      }
    },
    [chapters, activeChapterIndex, closePanel, user, bookId]
  );
  const goToNextChapter = useCallback(() => goToChapter(activeChapterIndex + 1), [goToChapter, activeChapterIndex]);
  const goToPrevChapter = useCallback(() => goToChapter(activeChapterIndex - 1), [goToChapter, activeChapterIndex]);

  const handleGoToPage = useCallback(
    (page: number) => {
      const index = chapters.findIndex((c) => c.page_start != null && c.page_end != null && page >= c.page_start && page <= c.page_end);
      if (index >= 0) goToChapter(index);
      else toast({ title: t("library.reader.pageNotFound") });
    },
    [chapters, goToChapter, t]
  );

  // ── Progress writing (debounced inside ReflowableTextPane's scroll handler) ──
  const handleScrollProgress = useCallback(
    (scrollOffset: number, percentOfChapter: number) => {
      if (!bookId || !user || !activeChapter) return;
      const currentPage = activeChapter.page_start != null && activeChapter.page_end != null
        ? Math.round(activeChapter.page_start + ((activeChapter.page_end - activeChapter.page_start) * percentOfChapter) / 100)
        : activeChapter.page_start ?? activeChapterIndex + 1;
      const overallPercent = chapters.length > 0 ? Math.round(((activeChapterIndex + percentOfChapter / 100) / chapters.length) * 100) : 0;
      void updateTextProgress(currentPage, overallPercent, { scroll_offset: scrollOffset, chapter_id: activeChapter.id });
    },
    [bookId, user, activeChapter, activeChapterIndex, chapters.length, updateTextProgress]
  );

  // ── Selection → highlight/note/AI ─────────────────────────────────────────
  const handleTextSelected = useCallback((text: string) => setSelectedText(text), []);
  const clearSelection = useCallback(() => setSelectedText(null), []);

  const handleHighlight = useCallback(
    (color: LibraryHighlightColor) => {
      if (!selectedText || !bookId || !user) return;
      void addHighlight(activeChapter?.page_start ?? null, selectedText, color);
      void logLibraryAnalyticsEvent("highlight_added", { userId: user.id, entityType: "book", entityId: bookId });
    },
    [selectedText, bookId, user, activeChapter, addHighlight]
  );
  const handleAddNoteFromSelection = useCallback(() => openPanel("notes"), [openPanel]);
  const handleOpenTranslateFromSelection = useCallback(() => {
    setAiInitialText(selectedText ?? undefined);
    openPanel("ai");
  }, [selectedText, openPanel]);
  const handleWordDoubleClick = useCallback((word: string, sentence: string) => setDictionaryLookup({ word, sentence }), []);

  const handleAddBookmark = useCallback(() => {
    if (!bookId || !user || !activeChapter) return;
    void addBookmark(activeChapter.page_start, { chapterId: activeChapter.id }, activeChapter.title || `${t("library.bookDetails.chapter")} ${activeChapter.chapter_number}`);
    void logLibraryAnalyticsEvent("bookmark_added", { userId: user.id, entityType: "book", entityId: bookId });
    toast({ title: t("library.reader.bookmarkAdded") });
  }, [bookId, user, activeChapter, addBookmark, t]);

  const handleJumpToBookmark = useCallback(
    (_pageNumber: number | null, position: Record<string, unknown>) => {
      const chapterId = typeof position.chapterId === "string" ? position.chapterId : undefined;
      const index = chapterId ? chapters.findIndex((c) => c.id === chapterId) : -1;
      if (index >= 0) goToChapter(index);
      closePanel();
    },
    [chapters, goToChapter, closePanel]
  );

  const handleSelectSearchResult = useCallback(
    (result: InBookSearchResult, index: number) => {
      const chapterIndex = chapters.findIndex((c) => c.id === result.chapterId);
      if (chapterIndex >= 0) setActiveChapterIndex(chapterIndex);
      setSearchActiveIndex(index);
    },
    [chapters, setSearchActiveIndex]
  );

  const handleSaveOffline = useCallback(async () => {
    if (!book) return;
    const ok = await saveForOffline(book.title, book.cover_image_url, chapters);
    if (ok) {
      toast({ title: t("library.reader.savedOfflineSuccess") });
      if (user && bookId) {
        void logLibraryAnalyticsEvent("offline_download", { userId: user.id, entityType: "book", entityId: bookId });
        void toggleDownload(bookId);
      }
    } else {
      toast({ title: t("library.reader.savedOfflineFailed"), variant: "destructive" });
    }
  }, [book, chapters, saveForOffline, t, user, bookId, toggleDownload]);

  const handleShare = useCallback(async () => {
    if (!book) return;
    const url = `${window.location.origin}/library/read/${book.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: book.title, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: t("library.share.copied") });
    }
    if (user) void logLibraryAnalyticsEvent("share", { userId: user.id, entityType: "book", entityId: book.id });
  }, [book, t, user]);

  const contentLoading = access.canRead && (chaptersLoading || filesLoading);

  const panelTitles: Record<ReaderPanelKey, string> = {
    toc: t("library.bookDetails.chapters"),
    bookmarks: t("library.reader.bookmarks"),
    notes: t("library.reader.notes"),
    highlights: t("library.reader.highlights"),
    search: t("library.reader.search"),
    settings: t("library.reader.settings"),
    ai: t("library.ai.title"),
    readAloud: t("library.reader.readAloud"),
    info: t("library.reader.bookInfo"),
    offline: t("library.reader.offline"),
    help: t("library.reader.help"),
    coach: t("library.ai.coach.title"),
    accessibility: t("library.ai.accessibility.title"),
  };

  const renderPanelContent = () => {
    if (!activePanel || !bookId) return null;
    switch (activePanel) {
      case "toc":
        return (
          <TocPanel
            bookId={bookId}
            currentPage={progress.current_page}
            canAccessContent={access.canRead}
            onSelectChapter={(id) => {
              const i = chapters.findIndex((c) => c.id === id);
              if (i >= 0) goToChapter(i);
            }}
          />
        );
      case "bookmarks":
        return <BookmarksPanel bookId={bookId} onJumpToBookmark={handleJumpToBookmark} />;
      case "notes":
        return <NotesPanel bookId={bookId} bookTitle={book?.title} currentPage={activeChapter?.page_start ?? null} />;
      case "highlights":
        return <HighlightsPanel bookId={bookId} bookTitle={book?.title ?? ""} />;
      case "search":
        return (
          <SearchPanel
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchResults}
            activeIndex={searchActiveIndex}
            onNext={searchNext}
            onPrev={searchPrev}
            onSelectResult={handleSelectSearchResult}
          />
        );
      case "settings":
        return <SettingsPanel settings={settings} onChange={updateSettings} />;
      case "ai":
        return (
          <AiSidebarPanel
            bookId={bookId}
            chapterId={activeChapter?.id ?? null}
            chapterContent={activeChapter?.content_text ?? null}
            currentPage={activeChapter?.page_start ?? null}
            initialSelectedText={aiInitialText}
            onOpenBookmarks={() => openPanel("bookmarks")}
          />
        );
      case "readAloud":
        return <ReadAloudControls bookId={bookId} text={activeChapter?.content_text ?? ""} />;
      case "info":
        return book ? <BookInfoPanel book={book} /> : null;
      case "coach":
        return <ReadingCoachPanel bookId={bookId} />;
      case "accessibility":
        return <AccessibilityDescribePanel />;
      case "offline":
        return (
          <OfflinePanel
            bookId={bookId}
            bookTitle={book?.title ?? ""}
            isAvailableOffline={isAvailableOffline}
            isSaving={isSavingOffline}
            onSaveThisBook={() => void handleSaveOffline()}
            onRemoveThisBook={() => void removeOffline()}
            isPdfMode={renderMode === "pdf-iframe"}
          />
        );
      case "help":
        return (
          <div className="space-y-2 text-sm">
            <p>{t("library.reader.keyboardShortcutsIntro")}</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>← / → — {t("library.reader.shortcutNav")}</li>
              <li>/ — {t("library.reader.shortcutSearch")}</li>
              <li>b — {t("library.reader.shortcutBookmark")}</li>
              <li>n — {t("library.reader.shortcutNote")}</li>
              <li>f — {t("library.reader.shortcutFullscreen")}</li>
              <li>+ / − — {t("library.reader.shortcutFontSize")}</li>
              <li>Esc — {t("library.reader.shortcutClose")}</li>
            </ul>
          </div>
        );
      default:
        return null;
    }
  };

  if (bookLoading) {
    return (
      <Layout>
        <LibraryLayout title={t("library.nav.reader")}>
          <SkeletonLoader variant="detail" />
        </LibraryLayout>
      </Layout>
    );
  }

  if (!book) {
    return (
      <Layout>
        <LibraryLayout title={t("library.nav.reader")}>
          <EmptyState icon={<BookOpen className="h-10 w-10" />} title={t("library.emptyState.bookNotFoundTitle")} actionLabel={t("library.nav.categories")} actionTo="/library/categories" />
        </LibraryLayout>
      </Layout>
    );
  }

  if (!access.isLoading && !access.canRead) {
    return (
      <Layout>
        <LibraryLayout title={book.title} breadcrumb={[{ label: book.title, to: `/library/books/${book.id}` }, { label: t("library.nav.reader") }]}>
          <EmptyState icon={<BookOpen className="h-10 w-10" />} title={t("library.reader.accessRequiredTitle")} description={t("library.reader.accessRequiredDesc")} actionLabel={t("library.nav.bookDetails")} actionTo={`/library/books/${book.id}`} />
        </LibraryLayout>
      </Layout>
    );
  }

  return (
    <Layout>
      <LibraryLayout title={book.title} breadcrumb={[{ label: book.title, to: `/library/books/${book.id}` }, { label: t("library.nav.reader") }]}>
        <div className="-m-4 sm:-m-6">
          {access.isLoading || contentLoading ? (
            <SkeletonLoader variant="detail" />
          ) : (
            <ReaderShell
              topToolbar={({ isFullscreen, toggleFullscreen }) => (
                <ReaderTopToolbar
                  bookId={book.id}
                  bookTitle={book.title}
                  onOpenPanel={openPanel}
                  onGoToPage={handleGoToPage}
                  isNightMode={settings.theme === "dark"}
                  onToggleNightMode={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={toggleFullscreen}
                  onShare={() => void handleShare()}
                  searchEnabled={renderMode === "reflowable-text"}
                />
              )}
              bottomToolbar={
                <ReaderBottomToolbar
                  currentChapterNumber={activeChapterIndex + 1}
                  totalChapters={chapters.length || 1}
                  percentComplete={progress.percent_complete}
                  onPrev={goToPrevChapter}
                  onNext={goToNextChapter}
                  canPrev={activeChapterIndex > 0}
                  canNext={activeChapterIndex < chapters.length - 1}
                  simplified={renderMode !== "reflowable-text"}
                />
              }
              activePanel={activePanel}
              onClosePanel={closePanel}
              panelTitle={activePanel ? panelTitles[activePanel] : ""}
              panelContent={renderPanelContent()}
              shortcuts={{
                onNext: goToNextChapter,
                onPrev: goToPrevChapter,
                onSearch: () => openPanel("search"),
                onBookmark: handleAddBookmark,
                onNote: () => openPanel("notes"),
                onFontIncrease: () => updateSettings({ fontSize: Math.min(32, settings.fontSize + 1) }),
                onFontDecrease: () => updateSettings({ fontSize: Math.max(12, settings.fontSize - 1) }),
              }}
            >
              {renderMode === "reflowable-text" ? (
                chaptersError ? (
                  <ReaderErrorState bookId={book.id} reason={t("library.reader.loadFailedTitle")} suggestion={chaptersError} onRetry={refetchChapters} />
                ) : activeChapter ? (
                  <>
                    <ReflowableTextPane
                      chapter={activeChapter}
                      settings={settings}
                      highlights={highlights}
                      onScrollProgress={handleScrollProgress}
                      onTextSelected={handleTextSelected}
                      onNextChapter={goToNextChapter}
                      onPrevChapter={goToPrevChapter}
                      searchTerm={activePanel === "search" ? searchQuery : undefined}
                      onWordDoubleClick={handleWordDoubleClick}
                    />
                    {selectedText && (
                      <HighlightSelectionPopover
                        bookId={book.id}
                        selectedText={selectedText}
                        onClose={clearSelection}
                        onHighlight={handleHighlight}
                        onAddNote={handleAddNoteFromSelection}
                        onOpenTranslate={handleOpenTranslateFromSelection}
                      />
                    )}
                    {dictionaryLookup && (
                      <SmartDictionaryPopover
                        word={dictionaryLookup.word}
                        sentenceContext={dictionaryLookup.sentence}
                        onClose={() => setDictionaryLookup(null)}
                      />
                    )}
                  </>
                ) : (
                  <UnsupportedFormatPane bookId={book.id} fileType={null} />
                )
              ) : renderMode === "pdf-iframe" ? (
                <PdfIframePane signedUrl={signedPdfUrl} isLoadingUrl={isSigningUrl} />
              ) : (
                <UnsupportedFormatPane bookId={book.id} fileType={primaryPdfFile?.file_type ?? files[0]?.file_type ?? null} />
              )}
            </ReaderShell>
          )}
        </div>
      </LibraryLayout>
    </Layout>
  );
}
