import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryChapterRow } from "@/lib/types/library-book";
import type { LibraryHighlightRow, LibraryReaderSettings } from "@/lib/types/library-reader";
import { cn } from "@/lib/utils";

interface ReflowableTextPaneProps {
  chapter: LibraryChapterRow;
  settings: LibraryReaderSettings;
  highlights: LibraryHighlightRow[];
  initialScrollOffset?: number;
  onScrollProgress: (scrollOffset: number, percentOfChapter: number) => void;
  onTextSelected: (selectedText: string) => void;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
  searchTerm?: string;
  /** Native double-click word-selection → Smart Dictionary lookup. Fires
   *  with the double-clicked word plus its containing paragraph as context
   *  (so the definition reflects how the word is actually used here). */
  onWordDoubleClick?: (word: string, sentenceContext: string) => void;
}

const FONT_FAMILY_MAP: Record<LibraryReaderSettings["fontFamily"], string> = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "system-ui, -apple-system, sans-serif",
  dyslexic: "'Comic Sans MS', 'Comic Sans', sans-serif",
};

const MARGIN_MAP: Record<LibraryReaderSettings["margins"], string> = {
  narrow: "1rem",
  normal: "2rem",
  wide: "4rem",
};

const WIDTH_MAP: Record<LibraryReaderSettings["pageWidth"], string> = {
  narrow: "38rem",
  normal: "48rem",
  wide: "60rem",
};

const THEME_CLASSES: Record<LibraryReaderSettings["theme"], string> = {
  light: "bg-background text-foreground",
  dark: "bg-[#121212] text-[#e8e8e8]",
  sepia: "bg-[#f4ecd8] text-[#5b4636]",
  "high-contrast": "bg-black text-white",
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface MarkTerm {
  value: string;
  className: string;
}

/** Wraps every occurrence of any term's value within `text` in a <mark>.
 *  Used for both saved highlights and live search-term rendering — a
 *  highlight is just a saved substring, a search term is a live one. Exact
 *  "jump to THIS specific occurrence" precision is left to the browser's
 *  normal find-in-page-style scroll (SearchPanel scrolls to the chapter and
 *  relies on the mark being visually distinct) rather than per-occurrence
 *  DOM indexing, which would need fragile cross-paragraph offset math for
 *  little practical benefit at this content scale. */
function renderTextWithMarks(text: string, terms: MarkTerm[]): (string | JSX.Element)[] {
  const active = terms.filter((t) => t.value.trim().length > 0);
  if (active.length === 0) return [text];

  const pattern = active.map((t) => escapeRegExp(t.value)).join("|");
  const re = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(re);

  return parts.map((part, i) => {
    const matched = active.find((t) => t.value.toLowerCase() === part.toLowerCase());
    if (!matched) return part;
    return (
      <mark key={i} className={matched.className}>
        {part}
      </mark>
    );
  });
}

/**
 * The custom reflowable renderer — one chapter's content_text as continuous
 * semantic HTML. "Page" (in horizontal-paginated scrollMode) is a CSS
 * multi-column transform on this SAME single DOM block, never a
 * DOM-splitting operation — this is what keeps the chapter fully navigable
 * by a screen reader's normal browse-mode regardless of what's visually
 * paginated. Vertical-scroll mode has no such conflict by construction.
 */
export function ReflowableTextPane({
  chapter, settings, highlights, initialScrollOffset, onScrollProgress, onTextSelected,
  onNextChapter, onPrevChapter, searchTerm, onWordDoubleClick,
}: ReflowableTextPaneProps) {
  const { t, dir } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const paragraphs = useMemo(() => (chapter.content_text ?? "").split(/\n{2,}/).filter((p) => p.trim().length > 0), [chapter.content_text]);

  const chapterHighlights = useMemo(
    () => highlights.filter((h) => h.page_number == null || (chapter.page_start != null && chapter.page_end != null && h.page_number >= chapter.page_start && h.page_number <= chapter.page_end)),
    [highlights, chapter]
  );

  useEffect(() => {
    if (initialScrollOffset && containerRef.current) {
      containerRef.current.scrollTop = initialScrollOffset;
    }
  }, [chapter.id, initialScrollOffset]);

  const reportProgress = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    const percent = maxScroll > 0 ? Math.min(100, Math.round((el.scrollTop / maxScroll) * 100)) : 100;
    onScrollProgress(el.scrollTop, percent);
  }, [onScrollProgress]);

  const handleScroll = useCallback(() => {
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(reportProgress, 500);
  }, [reportProgress]);

  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    };
  }, []);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (text.length > 0 && articleRef.current?.contains(selection?.anchorNode ?? null)) {
      onTextSelected(text);
    }
  }, [onTextSelected]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(delta) > 60) {
      const swipedLeft = delta < 0;
      const goNext = dir === "rtl" ? !swipedLeft : swipedLeft;
      if (goNext) onNextChapter?.();
      else onPrevChapter?.();
    }
    touchStartXRef.current = null;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!onWordDoubleClick) return;
    const word = window.getSelection()?.toString().trim();
    if (!word || /\s/.test(word)) return; // native dblclick selects one word; a multi-word selection means something else was selected
    const paragraphEl = (e.target as HTMLElement).closest("p");
    onWordDoubleClick(word, paragraphEl?.textContent ?? word);
  };

  const handlePaneClick = (e: React.MouseEvent) => {
    if (settings.scrollMode !== "horizontal-paginated") return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clickRatio = (e.clientX - rect.left) / rect.width;
    if (clickRatio < 0.15) onPrevChapter?.();
    else if (clickRatio > 0.85) onNextChapter?.();
  };

  const marks = useMemo((): MarkTerm[] => {
    const terms: MarkTerm[] = chapterHighlights.map((h) => ({
      value: h.quoted_text,
      className:
        h.color === "yellow" ? "bg-yellow-200/70 dark:bg-yellow-500/30" :
        h.color === "green" ? "bg-green-200/70 dark:bg-green-500/30" :
        h.color === "blue" ? "bg-blue-200/70 dark:bg-blue-500/30" :
        h.color === "pink" ? "bg-pink-200/70 dark:bg-pink-500/30" :
        "bg-purple-200/70 dark:bg-purple-500/30",
    }));
    if (searchTerm) terms.push({ value: searchTerm, className: "bg-orange-200/70 dark:bg-orange-500/30" });
    return terms;
  }, [chapterHighlights, searchTerm]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onClick={handlePaneClick}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn("h-full overflow-y-auto", THEME_CLASSES[settings.theme], settings.scrollMode === "horizontal-paginated" && "overflow-x-hidden")}
    >
      <article
        ref={articleRef}
        className="mx-auto"
        style={{
          maxWidth: WIDTH_MAP[settings.pageWidth],
          padding: MARGIN_MAP[settings.margins],
          fontSize: `${settings.fontSize}px`,
          fontFamily: FONT_FAMILY_MAP[settings.fontFamily],
          fontWeight: settings.fontWeight === "bold" ? 600 : 400,
          lineHeight: settings.lineSpacing,
          columnWidth: settings.scrollMode === "horizontal-paginated" ? WIDTH_MAP[settings.pageWidth] : undefined,
          columnGap: settings.scrollMode === "horizontal-paginated" ? MARGIN_MAP[settings.margins] : undefined,
        }}
        aria-label={t("library.reader.chapterContent").replace("{title}", chapter.title || String(chapter.chapter_number))}
      >
        {chapter.title && <h2 className="mb-4 text-xl font-bold">{chapter.title}</h2>}
        {paragraphs.length === 0 ? (
          <p className="text-muted-foreground">{t("library.reader.emptyChapter")}</p>
        ) : (
          paragraphs.map((para, i) => (
            <p key={i} id={`p-${chapter.id}-${i}`} className="mb-4">
              {renderTextWithMarks(para, marks)}
            </p>
          ))
        )}
      </article>
    </div>
  );
}
