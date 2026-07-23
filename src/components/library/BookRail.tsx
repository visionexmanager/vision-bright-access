import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookCard } from "@/components/library/BookCard";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { SectionError } from "@/components/library/SectionError";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryBookRow } from "@/lib/types/library-book";

interface BookRailProps {
  title: string;
  books: LibraryBookRow[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  viewAllHref?: string;
  isOnShelf?: (bookId: string) => boolean;
  onToggleShelf?: (bookId: string) => void;
  emptyTitle: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  emptyActionTo?: string;
}

/**
 * One reusable horizontal rail, driving every "list of books" home-page
 * section (newest/most-read/top-rated/free/paid/by-category/trending/
 * recommended/etc.) instead of a bespoke component per section — see the
 * Phase 3 plan's "one config-driven rail system" decision.
 */
export function BookRail({
  title, books, isLoading, error, onRetry, viewAllHref,
  isOnShelf, onToggleShelf, emptyTitle, emptyDescription, emptyActionLabel, emptyActionTo,
}: BookRailProps) {
  const { t, dir } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const sign = dir === "rtl" ? -1 : 1;
    el.scrollBy({ left: sign * direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="mb-10" aria-labelledby={`rail-${title}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={`rail-${title}`} className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-1">
          {books.length > 0 && (
            <>
              <Button variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={() => scrollByAmount(-1)} aria-label={t("library.rail.scrollLeft")}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={() => scrollByAmount(1)} aria-label={t("library.rail.scrollRight")}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          )}
          {viewAllHref && books.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link to={viewAllHref}>{t("library.rail.viewAll")}</Link>
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-40 shrink-0 sm:w-48">
              <SkeletonLoader variant="grid" count={1} />
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          actionTo={emptyActionTo}
          className="py-8"
        />
      ) : (
        <div
          ref={scrollRef}
          role="region"
          aria-label={title}
          tabIndex={0}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {books.map((book) => (
            <div key={book.id} className="w-40 shrink-0 snap-start sm:w-48">
              <BookCard book={book} isOnShelf={isOnShelf?.(book.id)} onToggleShelf={onToggleShelf} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
