import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Settings2, Bookmark as BookmarkIcon, Highlighter, StickyNote,
  Maximize, Minimize, List, Focus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn } from "@/features/visionkids/utils/animations";
import { useStoryBySlug, useStoryPages, useStoryChapters, useInteractiveStoryGraph } from "@/features/visionkids/hooks/stories/useStoryCatalog";
import {
  useReadingProgress, useSaveReadingProgress, useBookmarks, useAddBookmark, useRemoveBookmark,
  useHighlights, useAddHighlight, useNotes, useAddNote, useAwardAchievement, useAwardXp, useReadingStats,
} from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { useReaderSettings } from "@/features/visionkids/hooks/stories/useReaderSettings";
import { ReaderSettingsPanel } from "@/features/visionkids/components/stories/ReaderSettingsPanel";
import { WordLookupPopover } from "@/features/visionkids/components/stories/WordLookupPopover";
import { InteractiveStoryPlayer } from "@/features/visionkids/components/stories/InteractiveStoryPlayer";
import type { ReaderBackground } from "@/features/visionkids/types/stories.types";

const BG_CLASSES: Record<ReaderBackground, string> = {
  light: "bg-background text-foreground",
  sepia: "bg-[#f4ecd8] text-[#5b4636]",
  night: "bg-neutral-900 text-neutral-100",
  "high-contrast": "bg-black text-yellow-300",
};

const FONT_CLASSES = { sans: "font-sans", serif: "font-serif", dyslexic: "font-sans tracking-wide" } as const;

export default function StoryReader() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  const { data: story } = useStoryBySlug(slug);
  const { data: pages = [] } = useStoryPages(story?.is_interactive ? undefined : story?.id);
  const { data: chapters = [] } = useStoryChapters(story?.id);
  const { data: graph } = useInteractiveStoryGraph(story?.is_interactive ? story?.id : undefined);
  const { data: progress } = useReadingProgress(story?.id);
  const saveProgress = useSaveReadingProgress();
  const { data: bookmarks = [] } = useBookmarks(story?.id);
  const addBookmark = useAddBookmark();
  const removeBookmark = useRemoveBookmark();
  const { data: highlights = [] } = useHighlights(story?.id);
  const addHighlight = useAddHighlight();
  const { data: notes = [] } = useNotes(story?.id);
  const addNote = useAddNote();
  const awardAchievement = useAwardAchievement();
  const awardXp = useAwardXp();
  const { data: stats } = useReadingStats();

  const { settings, update: updateSetting } = useReaderSettings();
  const [pageIndex, setPageIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useDocumentHead({ title: story ? `${story.title} — VisionKids` : t("kids.stories.meta.title"), description: story?.description ?? "", canonicalPath: `/kids/stories/read/${slug}` });

  // Resume where the reader left off.
  useEffect(() => {
    if (progress?.current_page) setPageIndex(Math.max(0, progress.current_page - 1));
  }, [progress?.current_page]);

  // Auto-scroll → for a paginated reader this means auto-advance to the next page.
  useEffect(() => {
    if (!settings.autoScroll || pages.length === 0) return;
    const wordsOnPage = (pages[pageIndex]?.text_content ?? "").split(/\s+/).length;
    const msPerPage = Math.max(4000, (wordsOnPage / (settings.autoScrollSpeed || 30)) * 60000);
    const timer = window.setTimeout(() => {
      setPageIndex((i) => Math.min(i + 1, pages.length - 1));
    }, msPerPage);
    return () => window.clearTimeout(timer);
  }, [settings.autoScroll, settings.autoScrollSpeed, pageIndex, pages]);

  const currentPage = pages[pageIndex];
  const progressPercent = pages.length > 0 ? ((pageIndex + 1) / pages.length) * 100 : 0;

  const checkStoryAchievements = async () => {
    if (!user) return;
    await awardXp.mutateAsync({ amount: 20, reason: `Story completed: ${story?.slug}` }).catch(() => {});
    const total = (stats?.total_stories_read ?? 0) + 1;
    if (total === 1) awardAchievement.mutate("first_story");
    if (total === 5) awardAchievement.mutate("five_stories");
    if (total === 10) awardAchievement.mutate("ten_stories");
    if ((stats?.current_streak ?? 0) + 1 === 3) awardAchievement.mutate("streak_3");
    if ((stats?.current_streak ?? 0) + 1 === 7) awardAchievement.mutate("streak_7");
  };

  const persistProgress = (nextPageIndex: number, completed: boolean) => {
    if (!user || !story) return;
    const minutesReadDelta = Math.max(0, Math.round((Date.now() - startTimeRef.current) / 60000));
    startTimeRef.current = Date.now();
    saveProgress.mutate({
      storyId: story.id,
      currentPage: nextPageIndex + 1,
      progressPercent: pages.length > 0 ? ((nextPageIndex + 1) / pages.length) * 100 : 100,
      minutesReadDelta,
      completed,
    });
    if (completed) checkStoryAchievements();
  };

  const goToPage = (next: number) => {
    const clamped = Math.max(0, Math.min(next, pages.length - 1));
    setPageIndex(clamped);
    persistProgress(clamped, clamped === pages.length - 1);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  const currentPageBookmark = useMemo(() => bookmarks.find((b) => b.page_number === pageIndex + 1), [bookmarks, pageIndex]);
  const currentPageHighlights = useMemo(() => highlights.filter((h) => h.page_number === pageIndex + 1), [highlights, pageIndex]);
  const currentPageNotes = useMemo(() => notes.filter((n) => n.page_number === pageIndex + 1), [notes, pageIndex]);

  if (!story) return <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  if (story.is_interactive) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link to={`/kids/stories/story/${story.slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {story.title}
        </Link>
        {graph && graph.nodes.length > 0 ? (
          <InteractiveStoryPlayer
            nodes={graph.nodes}
            choices={graph.choices}
            startNodeId={progress?.current_node_id ?? undefined}
            onNodeChange={(nodeId) => {
              if (user) saveProgress.mutate({ storyId: story.id, currentNodeId: nodeId, progressPercent: 50, completed: false });
            }}
            onEnding={() => persistProgress(0, true)}
          />
        ) : (
          <p className="text-muted-foreground">{t("kids.stories.notFound")}</p>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`min-h-screen transition-colors ${BG_CLASSES[settings.background]}`}>
      {!settings.focusMode && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/50 bg-inherit/90 px-3 py-2 backdrop-blur">
          <Link to={`/kids/stories/story/${story.slug}`} className="flex items-center gap-1 text-sm hover:underline">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> <span className="line-clamp-1">{story.title}</span>
          </Link>
          <div className="flex items-center gap-1">
            <WordLookupPopover />
            <Button variant="ghost" size="icon" onClick={() => user && story && addBookmark.mutate({ storyId: story.id, pageNumber: pageIndex + 1 })} aria-pressed={!!currentPageBookmark} aria-label={t("kids.reader.addBookmark")}>
              <BookmarkIcon className={currentPageBookmark ? "h-4 w-4 fill-kids-accent text-kids-accent" : "h-4 w-4"} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={() => {
                const selection = window.getSelection()?.toString();
                if (selection && story) addHighlight.mutate({ storyId: story.id, pageNumber: pageIndex + 1, text: selection });
              }}
              aria-label={t("kids.reader.highlightSelection")}
            >
              <Highlighter className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setNoteOpen((o) => !o)} aria-label={t("kids.reader.addNote")} aria-expanded={noteOpen}>
              <StickyNote className="h-4 w-4" aria-hidden="true" />
            </Button>
            {chapters.length > 0 && (
              <Button variant="ghost" size="icon" onClick={() => setTocOpen((o) => !o)} aria-label={t("kids.reader.tableOfContents")} aria-expanded={tocOpen}>
                <List className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => updateSetting("focusMode", true)} aria-label={t("kids.reader.focusMode")}>
              <Focus className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={t("kids.reader.fullscreen")}>
              {fullscreen ? <Minimize className="h-4 w-4" aria-hidden="true" /> : <Maximize className="h-4 w-4" aria-hidden="true" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label={t("kids.reader.settingsTitle")}>
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {settings.focusMode && (
        <Button variant="ghost" size="icon" className="fixed end-3 top-3 z-20" onClick={() => updateSetting("focusMode", false)} aria-label={t("kids.reader.exitFocusMode")}>
          <X className="h-5 w-5" aria-hidden="true" />
        </Button>
      )}

      {tocOpen && (
        <nav aria-label={t("kids.reader.tableOfContents")} className="border-b border-border/50 px-4 py-3">
          <ul className="flex flex-wrap gap-2">
            {chapters.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => { goToPage(c.start_page - 1); setTocOpen(false); }}
                  className="rounded-lg border border-border/50 px-3 py-1 text-sm hover:bg-foreground/5"
                >
                  {c.chapter_number}. {c.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Progress value={progressPercent} className="mb-6" aria-label={t("kids.reader.progress")} />

        <AnimatePresence mode="wait">
          <motion.div
            key={pageIndex}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={fadeIn(reduced)}
            style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}
            className={FONT_CLASSES[settings.fontFamily]}
          >
            {currentPage?.image_url && <img src={currentPage.image_url} alt="" className="mb-4 w-full rounded-2xl object-cover" />}
            <p>{currentPage?.text_content}</p>

            {currentPageHighlights.length > 0 && (
              <div className="mt-4 flex flex-col gap-1 text-sm opacity-80">
                {currentPageHighlights.map((h) => <p key={h.id} className="rounded bg-yellow-200/60 px-1 text-black">"{h.quoted_text}"</p>)}
              </div>
            )}
            {currentPageNotes.length > 0 && (
              <div className="mt-4 flex flex-col gap-1 rounded-lg bg-foreground/5 p-3 text-sm">
                {currentPageNotes.map((n) => <p key={n.id}>📝 {n.content}</p>)}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {noteOpen && (
          <div className="mt-4 flex flex-col gap-2">
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={t("kids.reader.notePlaceholder")} aria-label={t("kids.reader.addNote")} />
            <Button
              size="sm"
              className="self-end"
              onClick={() => { if (story && noteText.trim()) { addNote.mutate({ storyId: story.id, pageNumber: pageIndex + 1, content: noteText.trim() }); setNoteText(""); setNoteOpen(false); } }}
            >
              {t("kids.reader.saveNote")}
            </Button>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="outline" onClick={() => goToPage(pageIndex - 1)} disabled={pageIndex === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.reader.previousPage")}
          </Button>
          <span className="text-sm opacity-70" aria-live="polite">{pageIndex + 1} / {pages.length}</span>
          <Button onClick={() => goToPage(pageIndex + 1)} disabled={pageIndex >= pages.length - 1} className="gap-1 bg-kids-primary text-white hover:bg-kids-primary/90">
            {t("kids.reader.nextPage")} <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <ReaderSettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onUpdate={updateSetting} />
    </div>
  );
}
