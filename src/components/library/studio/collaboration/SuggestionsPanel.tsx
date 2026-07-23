import { diffWords } from "diff";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBookSuggestions } from "@/hooks/library/useBookSuggestions";
import { flattenTiptapDocToText } from "@/lib/library/tiptapUtils";
import type { Editor } from "@tiptap/react";

interface SuggestionsPanelProps {
  bookId: string;
  chapterId: string;
  /** The live editor instance — used only to read the CURRENT chapter text
   *  as the diff baseline (suggestions are diffed against what's on screen
   *  right now, not necessarily the suggestion's original base_version). */
  editor: Editor;
}

/** Reviews pending "track changes" suggestions from collaborators who
 *  can't write chapters directly — a word-level diff (via the `diff`
 *  package) against the chapter's current text, since no verified free
 *  Tiptap track-changes package exists to depend on (see
 *  library_book_suggestions' schema comment for the full rationale). */
export function SuggestionsPanel({ bookId, chapterId, editor }: SuggestionsPanelProps) {
  const { t } = useLanguage();
  const { suggestions, isLoading, accept, reject } = useBookSuggestions(bookId, chapterId);
  const pending = suggestions.filter((s) => s.status === "pending");

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />;
  if (pending.length === 0) return <p className="text-sm text-muted-foreground">{t("library.studio.suggestions.empty")}</p>;

  const currentText = flattenTiptapDocToText(editor.getJSON() as Parameters<typeof flattenTiptapDocToText>[0]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("library.studio.suggestions.title")}</h3>
      <ul className="space-y-3">
        {pending.map((suggestion) => {
          const suggestedText = flattenTiptapDocToText(suggestion.suggested_content as Parameters<typeof flattenTiptapDocToText>[0]);
          const parts = diffWords(currentText, suggestedText);
          return (
            <li key={suggestion.id} className="rounded-md border p-2 text-sm">
              {suggestion.note && <p className="mb-2 text-xs italic text-muted-foreground">{suggestion.note}</p>}
              <p className="whitespace-pre-line leading-relaxed">
                {parts.map((part, i) => (
                  <span
                    key={i}
                    className={part.added ? "bg-green-500/20 text-green-800 dark:text-green-300" : part.removed ? "bg-red-500/20 text-red-800 line-through dark:text-red-300" : undefined}
                  >
                    {part.value}
                  </span>
                ))}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => void accept(suggestion)}>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("library.studio.suggestions.accept")}
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => void reject(suggestion.id)}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("library.studio.suggestions.reject")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
