import { BookOpen } from "lucide-react";
import { BookCard } from "@/components/library/BookCard";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryBookRow } from "@/lib/types/library-book";

interface BookGridProps {
  books: LibraryBookRow[];
  isLoading?: boolean;
  isOnShelf?: (bookId: string) => boolean;
  onToggleShelf?: (bookId: string) => void;
  isFavorite?: (bookId: string) => boolean;
  onToggleFavorite?: (bookId: string) => void;
}

export function BookGrid({ books, isLoading, isOnShelf, onToggleShelf, isFavorite, onToggleFavorite }: BookGridProps) {
  const { t } = useLanguage();

  if (isLoading) return <SkeletonLoader variant="grid" />;

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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" role="list">
      {books.map((book) => (
        <div role="listitem" key={book.id}>
          <BookCard
            book={book}
            isOnShelf={isOnShelf?.(book.id)}
            onToggleShelf={onToggleShelf}
            isFavorite={isFavorite?.(book.id)}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      ))}
    </div>
  );
}
