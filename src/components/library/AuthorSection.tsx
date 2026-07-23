import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/library/Rating";
import { BookCard } from "@/components/library/BookCard";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuthorProfile } from "@/hooks/library/useAuthors";
import { fetchCatalog } from "@/services/library/catalog";

interface AuthorSectionProps {
  authorId: string;
}

export function AuthorSection({ authorId }: AuthorSectionProps) {
  const { t } = useLanguage();
  const { author, isLoading } = useAuthorProfile(authorId);

  // Top-rated works for "most famous works" — capped at 100 for the average-
  // rating computation below, an approximation for prolific authors (the
  // author row's own book_count is the exact total, shown separately).
  const { data: topBooks = [], isLoading: booksLoading } = useQuery({
    queryKey: ["library", "author-top-books", authorId],
    queryFn: () => fetchCatalog({ authorId, sort: "rating", limit: 100 }),
    enabled: !!authorId,
  });

  const avgRating = (() => {
    const rated = topBooks.filter((b) => b.rating_count > 0);
    if (rated.length === 0) return null;
    return rated.reduce((sum, b) => sum + (b.rating_avg ?? 0), 0) / rated.length;
  })();

  if (isLoading) return <SkeletonLoader variant="detail" />;
  if (!author) return null;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground/50" aria-hidden="true">
          {author.photo_url ? (
            <img src={author.photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <User className="h-10 w-10" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="text-lg font-semibold">{author.name}</h2>
          {author.bio && <p className="text-sm text-muted-foreground line-clamp-3">{author.bio}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{author.book_count} {t("library.authors.books")}</span>
            {avgRating != null && <Rating value={avgRating} size="sm" />}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={`/library/authors/${authorId}`}>{t("library.bookDetails.viewAllBooks")}</Link>
          </Button>
        </div>
      </div>

      {!booksLoading && topBooks.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
          {topBooks.slice(0, 4).map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </Card>
  );
}
