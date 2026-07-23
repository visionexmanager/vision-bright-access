import { Link } from "react-router-dom";
import { BookOpen, Headphones, Coins } from "lucide-react";
import { Rating } from "@/components/library/Rating";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryBookRow } from "@/lib/types/library-book";

interface BookListProps {
  books: LibraryBookRow[];
  isLoading?: boolean;
}

export function BookList({ books, isLoading }: BookListProps) {
  const { t } = useLanguage();

  if (isLoading) return <SkeletonLoader variant="list" />;

  if (books.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-10 w-10" />}
        title={t("library.emptyState.noBooksTitle")}
        description={t("library.emptyState.noBooksDesc")}
      />
    );
  }

  return (
    <ul className="divide-y divide-border" role="list">
      {books.map((book) => (
        <li key={book.id} className="py-3">
          <Link to={`/library/books/${book.id}`} className="flex items-center gap-4 rounded-lg p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground/40" aria-hidden="true">
              {book.cover_image_url ? (
                <img src={book.cover_image_url} alt="" loading="lazy" className="h-full w-full rounded-md object-cover" />
              ) : (
                <BookOpen className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold">{book.title}</h3>
              <p className="truncate text-xs text-muted-foreground">{book.author_name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                {book.rating_count > 0 && <Rating value={book.rating_avg ?? 0} count={book.rating_count} />}
                {book.formats.includes("audiobook") && (
                  <Badge variant="secondary" className="gap-1"><Headphones className="h-3 w-3" aria-hidden="true" />{t("library.format.audiobook")}</Badge>
                )}
              </div>
            </div>
            <div className="shrink-0 text-end text-sm font-semibold text-primary">
              {book.is_free ? (
                t("library.format.free")
              ) : book.price_vx ? (
                <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5" aria-hidden="true" />{book.price_vx}</span>
              ) : book.price_usd ? (
                `$${book.price_usd}`
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
