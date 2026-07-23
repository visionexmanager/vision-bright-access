import { useLanguage } from "@/contexts/LanguageContext";
import { useReaderAnalytics } from "@/hooks/library/useReaderAnalytics";
import type { LibraryBookRow } from "@/lib/types/library-book";

interface BookInfoPanelProps {
  book: LibraryBookRow;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function BookInfoPanel({ book }: BookInfoPanelProps) {
  const { t } = useLanguage();
  const { summary, isLoading } = useReaderAnalytics(book.id);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{book.title}</h3>
        <p className="text-sm text-muted-foreground">{book.author_name}</p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{book.description}</p>

      {!isLoading && summary && (summary.reading_time_seconds > 0 || summary.pages_read > 0) && (
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">{t("library.reader.yourStats")}</p>
          <dl className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div>
              <dt className="text-xs">{t("library.reader.timeSpent")}</dt>
              <dd>{formatDuration(summary.reading_time_seconds)}</dd>
            </div>
            <div>
              <dt className="text-xs">{t("library.reader.pagesRead")}</dt>
              <dd>{summary.pages_read}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
