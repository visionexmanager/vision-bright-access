import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Rating } from "@/components/library/Rating";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryBookRow } from "@/lib/types/library-book";

interface BookListCompactProps {
  books: LibraryBookRow[];
  isLoading?: boolean;
}

/** The third ("Compact") view-mode density — one thin row per book, no
 * cover thumbnail, for scanning large result sets quickly. Distinct from
 * BookList (which keeps a cover + badges), matching the existing convention
 * of separate presentational components per layout. */
export function BookListCompact({ books, isLoading }: BookListCompactProps) {
  const { t } = useLanguage();

  if (isLoading) return <SkeletonLoader variant="list" count={10} />;

  if (books.length === 0) {
    return <EmptyState icon={<BookOpen className="h-10 w-10" />} title={t("library.emptyState.noBooksTitle")} description={t("library.emptyState.noBooksDesc")} />;
  }

  return (
    <ul className="divide-y divide-border" role="list">
      {books.map((book) => (
        <li key={book.id}>
          <Link
            to={`/library/books/${book.id}`}
            className="flex items-center justify-between gap-3 px-1 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{book.title}</span>
            <span className="hidden shrink-0 truncate text-muted-foreground sm:inline">{book.author_name}</span>
            {book.rating_count > 0 && <Rating value={book.rating_avg ?? 0} size="sm" />}
            <span className="shrink-0 text-xs font-semibold text-primary">
              {book.is_free ? t("library.format.free") : book.price_vx ? `${book.price_vx} VX` : book.price_usd ? `$${book.price_usd}` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
