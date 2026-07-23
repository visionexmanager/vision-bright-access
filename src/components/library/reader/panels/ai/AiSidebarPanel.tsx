import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChatTab } from "@/components/library/reader/panels/ai/ChatTab";
import { SummaryTab } from "@/components/library/reader/panels/ai/SummaryTab";
import { QuestionsTab } from "@/components/library/reader/panels/ai/QuestionsTab";
import { TranslateTab } from "@/components/library/reader/panels/ai/TranslateTab";
import { FlashcardsTab } from "@/components/library/reader/panels/ai/FlashcardsTab";
import { QuizTab } from "@/components/library/reader/panels/ai/QuizTab";
import { MindMapTab } from "@/components/library/reader/panels/ai/MindMapTab";
import { NotesTab } from "@/components/library/reader/panels/ai/NotesTab";
import { HistoryTab } from "@/components/library/reader/panels/ai/HistoryTab";
import { ReadingModeSelector } from "@/components/library/reader/panels/ai/ReadingModeSelector";

interface AiSidebarPanelProps {
  bookId: string;
  chapterId: string | null;
  chapterContent: string | null;
  currentPage: number | null;
  /** Pre-fills the Translate tab from HighlightSelectionPopover's "AI
   *  explain" action, if the panel was opened that way. */
  initialSelectedText?: string;
  /** History tab's cross-link into the reader's separate Bookmarks panel. */
  onOpenBookmarks?: () => void;
}

type TabKey = "chat" | "summary" | "questions" | "translate" | "flashcards" | "quiz" | "mindmap" | "notes" | "history";
const TABS: TabKey[] = ["chat", "summary", "questions", "translate", "flashcards", "quiz", "mindmap", "notes", "history"];

/**
 * The reader's AI Sidebar — a tab container matching the spec's explicit
 * section list (chat, summaries, Q&A, translate, flashcards, quiz, mind
 * map, notes, history). A Select-based switcher drives the tabs instead of
 * a horizontal TabsList, since 9 tabs don't fit inline inside the Sheet
 * panel's narrow (max-w-sm) width — Radix Tabs still owns the actual
 * panel-switching semantics/accessibility underneath. The reading-mode
 * selector sits above the tabs since it applies to every tab uniformly
 * (each tab's underlying hook reads it from useAiReadingPreferences).
 */
export function AiSidebarPanel({ bookId, chapterId, chapterContent, currentPage, initialSelectedText, onOpenBookmarks }: AiSidebarPanelProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<TabKey>(initialSelectedText ? "translate" : "chat");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
      <ReadingModeSelector />
      <Select value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <SelectTrigger className="mb-3" aria-label={t("library.ai.sidebar.sectionLabel")}><SelectValue /></SelectTrigger>
        <SelectContent>
          {TABS.map((key) => (
            <SelectItem key={key} value={key}>{t(`library.ai.sidebar.tab.${key}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <TabsContent value="chat" className="mt-0 h-[60vh]">
        <ChatTab bookId={bookId} chapterId={chapterId} />
      </TabsContent>
      <TabsContent value="summary" className="mt-0">
        <SummaryTab bookId={bookId} chapterId={chapterId} />
      </TabsContent>
      <TabsContent value="questions" className="mt-0">
        <QuestionsTab bookId={bookId} />
      </TabsContent>
      <TabsContent value="translate" className="mt-0">
        <TranslateTab bookId={bookId} chapterContent={chapterContent} initialText={initialSelectedText} />
      </TabsContent>
      <TabsContent value="flashcards" className="mt-0">
        <FlashcardsTab bookId={bookId} chapterId={chapterId} />
      </TabsContent>
      <TabsContent value="quiz" className="mt-0">
        <QuizTab bookId={bookId} chapterId={chapterId} />
      </TabsContent>
      <TabsContent value="mindmap" className="mt-0">
        <MindMapTab bookId={bookId} chapterId={chapterId} />
      </TabsContent>
      <TabsContent value="notes" className="mt-0">
        <NotesTab bookId={bookId} currentPage={currentPage} />
      </TabsContent>
      <TabsContent value="history" className="mt-0">
        <HistoryTab bookId={bookId} onOpenBookmarks={onOpenBookmarks} />
      </TabsContent>
    </Tabs>
  );
}
