import { useEffect } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { logLibraryAnalyticsEvent } from "@/services/library/analytics";

interface ReaderErrorStateProps {
  reason: string;
  suggestion: string;
  bookId: string;
  onRetry?: () => void;
  showDownloadSuggestion?: boolean;
}

/** Shared reason+suggestion+retry UI for anything the reader can't open —
 *  unsupported formats (DOCX), missing content, or a failed file load.
 *  Auto-logs the failure once per mount via the existing analytics
 *  pipeline, per the "log the error in the system" requirement. */
export function ReaderErrorState({ reason, suggestion, bookId, onRetry, showDownloadSuggestion }: ReaderErrorStateProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  useEffect(() => {
    console.error("Reader error:", reason);
    void logLibraryAnalyticsEvent("reader_error", {
      userId: user?.id ?? null,
      entityType: "book",
      entityId: bookId,
      metadata: { reason },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, reason]);

  return (
    <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
      <div className="space-y-1.5">
        <p className="text-lg font-semibold">{reason}</p>
        <p className="max-w-md text-sm text-muted-foreground">{suggestion}</p>
      </div>
      <div className="flex gap-2">
        {onRetry && <Button onClick={onRetry}>{t("library.common.retry")}</Button>}
        {showDownloadSuggestion && (
          <Button asChild variant="outline">
            <a href={`/library/books/${bookId}`}>
              <Download className="me-2 h-4 w-4" aria-hidden="true" />
              {t("library.reader.backToBookDetails")}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
