import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Trash2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/library/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { listOfflineBooks, removeOfflineBookById } from "@/hooks/library/useOfflineBook";

interface OfflinePanelProps {
  bookId: string;
  bookTitle: string;
  isAvailableOffline: boolean;
  isSaving: boolean;
  onSaveThisBook: () => void;
  onRemoveThisBook: () => void;
  isPdfMode: boolean;
}

interface OfflineEntry {
  bookId: string;
  title: string;
  coverImageUrl: string | null;
  savedAt: string;
}

export function OfflinePanel({ bookId, bookTitle, isAvailableOffline, isSaving, onSaveThisBook, onRemoveThisBook, isPdfMode }: OfflinePanelProps) {
  const { t } = useLanguage();
  const [savedBooks, setSavedBooks] = useState<OfflineEntry[]>([]);

  const refresh = async () => setSavedBooks(await listOfflineBooks());

  useEffect(() => {
    void refresh();
  }, [isAvailableOffline]);

  const handleRemove = async (id: string) => {
    await removeOfflineBookById(id);
    void refresh();
  };

  return (
    <div className="space-y-4">
      {isPdfMode ? (
        <p className="text-sm text-muted-foreground">{t("library.reader.pdfOfflineUnavailable")}</p>
      ) : (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm">{bookTitle}</span>
          {isAvailableOffline ? (
            <Button variant="outline" size="sm" onClick={onRemoveThisBook} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.reader.removeOffline")}
            </Button>
          ) : (
            <Button size="sm" onClick={onSaveThisBook} disabled={isSaving} className="gap-1.5">
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.reader.saveOffline")}
            </Button>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">{t("library.reader.savedBooks")}</p>
        {savedBooks.length === 0 ? (
          <EmptyState icon={<WifiOff className="h-8 w-8" />} title={t("library.reader.noSavedBooks")} className="py-6" />
        ) : (
          <ul className="space-y-1.5">
            {savedBooks.map((entry) => (
              <li key={entry.bookId} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <Link to={`/library/read/${entry.bookId}`} className="truncate hover:underline">{entry.title}</Link>
                {entry.bookId !== bookId && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => void handleRemove(entry.bookId)} aria-label={t("library.reader.removeOffline")}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
