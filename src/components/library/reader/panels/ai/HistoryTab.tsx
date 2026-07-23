import { formatDistanceToNow } from "date-fns";
import { MessageSquare, FileText, Languages, Sparkles, Bookmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibraryAiHistory } from "@/hooks/library/useLibraryAiHistory";
import type { LibraryAiHistoryItem } from "@/lib/types/library-ai";

interface HistoryTabProps {
  bookId: string;
  /** Cross-links to the reader's existing (separate) Bookmarks panel —
   *  bookmarks aren't rebuilt here, just surfaced as a jump-off point. */
  onOpenBookmarks?: () => void;
}

const TYPE_ICON: Record<LibraryAiHistoryItem["type"], typeof MessageSquare> = {
  chat: MessageSquare,
  summary: FileText,
  translation: Languages,
  explain_selection: Sparkles,
};

export function HistoryTab({ bookId, onOpenBookmarks }: HistoryTabProps) {
  const { t } = useLanguage();
  const { items, isLoading } = useLibraryAiHistory(bookId);

  return (
    <div className="space-y-3">
      {onOpenBookmarks && (
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={onOpenBookmarks}>
          <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
          {t("library.ai.history.viewBookmarks")}
        </Button>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t("library.ai.history.empty")}</p>
      ) : (
        <ul className="space-y-2" aria-label={t("library.ai.history.title")}>
          {items.map((item) => {
            const Icon = TYPE_ICON[item.type];
            return (
              <li key={`${item.type}-${item.id}`} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="font-medium text-foreground">{t(`library.ai.history.type.${item.type}`)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                </div>
                <p className="mt-1 truncate text-muted-foreground">{item.snippet}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
