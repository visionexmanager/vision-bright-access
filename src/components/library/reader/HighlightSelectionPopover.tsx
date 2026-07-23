import { useEffect, useState } from "react";
import { Copy, Loader2, Sparkles, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { useLibraryAiAssistant } from "@/hooks/library/useLibraryAiAssistant";
import type { LibraryHighlightColor } from "@/lib/types/library-reader";
import { cn } from "@/lib/utils";

interface HighlightSelectionPopoverProps {
  /** For attaching explain-selection results to the current book's AI
   *  history (library_ai_activity_log) — the reader is always scoped to
   *  one book. */
  bookId: string;
  selectedText: string;
  onClose: () => void;
  onHighlight: (color: LibraryHighlightColor) => void;
  onAddNote: () => void;
  /** Opens the AI sidebar's Translate tab, pre-filled with the selection —
   *  translation needs a target-language input, so it's routed to the full
   *  sidebar rather than run inline here. */
  onOpenTranslate: () => void;
}

const COLORS: LibraryHighlightColor[] = ["yellow", "green", "blue", "pink", "purple"];
const COLOR_CLASS: Record<LibraryHighlightColor, string> = {
  yellow: "bg-yellow-400", green: "bg-green-400", blue: "bg-blue-400", pink: "bg-pink-400", purple: "bg-purple-400",
};

type AiAction = "explain" | "simplify" | "rephrase" | "example" | "extract-ideas" | "rewrite" | "expand" | "shorten";
const AI_ACTIONS: AiAction[] = ["explain", "simplify", "rephrase", "example", "extract-ideas", "rewrite", "expand", "shorten"];

/**
 * Text-selection popover — highlight color picker / add note / copy /
 * "Explain Selection" AI actions (explain, simplify, translate, rephrase,
 * give example, extract ideas), positioned near the current window
 * selection's bounding rect. Mouse-drag selection is inherently
 * sighted-first; the keyboard-only path (select-current-paragraph via
 * ReaderTopToolbar) fires the exact same onTextSelected callback the
 * reflowable pane uses for a real selection, so this popover works
 * identically either way.
 */
export function HighlightSelectionPopover({ bookId, selectedText, onClose, onHighlight, onAddNote, onOpenTranslate }: HighlightSelectionPopoverProps) {
  const { t } = useLanguage();
  const { run, result, isRunning, reset } = useLibraryAiAssistant();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setPosition(null);
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setPosition({ top: rect.top - 48, left: rect.left + rect.width / 2 });
  }, [selectedText]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedText);
      toast({ title: t("library.reader.copiedToClipboard") });
      onClose();
    } catch {
      toast({ title: t("library.share.failed"), variant: "destructive" });
    }
  };

  const handleAiAction = (instruction: AiAction) => {
    void run({ mode: "explain-paragraph", book_id: bookId, text: selectedText, instruction });
  };

  if (!position) return null;

  const explanation = result && result.mode === "explain-paragraph" ? result.result.explanation : null;

  return (
    <div
      role="menu"
      aria-label={t("library.reader.selectionActions")}
      className="fixed z-50 -translate-x-1/2 rounded-lg border bg-popover shadow-lg"
      style={{ top: Math.max(8, position.top), left: position.left }}
    >
      <div className="flex items-center gap-1 p-1.5">
        {COLORS.map((color) => (
          <button
            key={color}
            role="menuitem"
            onClick={() => { onHighlight(color); onClose(); }}
            className={cn("h-6 w-6 rounded-full border-2 border-transparent focus-visible:border-ring focus-visible:outline-none", COLOR_CLASS[color])}
            aria-label={t("library.reader.highlightColor").replace("{color}", t(`library.reader.color.${color}`))}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} aria-label={t("library.quotes.copy")}>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onAddNote(); onClose(); }} aria-label={t("library.reader.addNote")}>
          <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("library.reader.aiExplainSelection")}>
              {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {AI_ACTIONS.map((action) => (
              <DropdownMenuItem key={action} onClick={() => handleAiAction(action)}>
                {t(`library.ai.selection.${action}`)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => { onOpenTranslate(); onClose(); }}>
              {t("library.ai.selection.translate")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label={t("library.common.cancel")}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      {explanation && (
        <div className="max-w-xs border-t p-3 text-sm">
          <p className="whitespace-pre-line">{explanation}</p>
          <Button variant="ghost" size="sm" className="mt-1.5 h-6 px-2 text-xs" onClick={reset}>{t("library.common.cancel")}</Button>
        </div>
      )}
    </div>
  );
}
