import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReadingProgress } from "@/components/library/ReadingProgress";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ContinueReadingItem } from "@/hooks/library/useContinueReading";

interface ContinueReadingCardProps {
  item: ContinueReadingItem;
}

/** Composes a book cover + title/author + ReadingProgress + a "Continue"
 * button — used by the Continue Reading rail. Distinct from the plain
 * BookCard since it needs progress state BookCard doesn't carry. */
export function ContinueReadingCard({ item }: ContinueReadingCardProps) {
  const { t } = useLanguage();
  const { book, percent_complete } = item;

  return (
    <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-md">
      <Link to={`/library/books/${book.id}`} className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground/40" aria-hidden="true">
        {book.cover_image_url ? (
          <img src={book.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <BookOpen className="h-6 w-6" />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/library/books/${book.id}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
          <h3 className="truncate text-sm font-semibold">{book.title}</h3>
        </Link>
        <p className="truncate text-xs text-muted-foreground">{book.author_name}</p>
        <ReadingProgress percentComplete={percent_complete} className="mt-2" />
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link to={`/library/read/${book.id}`}>{t("library.home.continueButton")}</Link>
      </Button>
    </Card>
  );
}
