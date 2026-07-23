import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StudioBookSummary } from "@/services/library/studio";

interface PendingReviewListProps {
  books: StudioBookSummary[];
}

export function PendingReviewList({ books }: PendingReviewListProps) {
  const { t } = useLanguage();

  if (books.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Clock className="h-4 w-4" aria-hidden="true" />
        {t("library.studio.dashboard.pendingReview")}
      </h3>
      <ul className="space-y-2">
        {books.map((book) => (
          <li key={book.id}>
            <Link to={`/library/studio/books/${book.id}`} className="flex items-center justify-between rounded-md p-2 text-sm hover:bg-accent">
              <span className="truncate">{book.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{new Date(book.updated_at).toLocaleDateString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
