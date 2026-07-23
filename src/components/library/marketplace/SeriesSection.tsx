import { Link } from "react-router-dom";
import { Library } from "lucide-react";
import { BookCard } from "@/components/library/BookCard";
import { useSeries } from "@/hooks/library/useSeries";
import { useLanguage } from "@/contexts/LanguageContext";

interface SeriesSectionProps {
  seriesId: string | null;
  currentBookId: string;
}

export function SeriesSection({ seriesId, currentBookId }: SeriesSectionProps) {
  const { t } = useLanguage();
  const { series, books, isLoading } = useSeries(seriesId ?? undefined);
  if (!seriesId || isLoading || !series || books.length === 0) return null;

  return (
    <section aria-labelledby="book-series-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="book-series-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Library className="h-4 w-4" aria-hidden="true" /> {t("library.bookDetails.partOfSeries").replace("{series}", series.title)}
        </h2>
        <Link to={`/library/series/${series.slug}`} className="text-sm text-primary hover:underline">
          {t("library.rail.viewAll")}
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2" role="list">
        {books
          .slice()
          .sort((a, b) => (a.seriesPosition ?? 0) - (b.seriesPosition ?? 0))
          .map((book) => (
            <div key={book.id} className="w-40 shrink-0 sm:w-48" role="listitem">
              <BookCard book={book} className={book.id === currentBookId ? "ring-2 ring-primary" : undefined} />
            </div>
          ))}
      </div>
    </section>
  );
}
