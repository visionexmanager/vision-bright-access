import { Link } from "react-router-dom";
import { BookOpen, Clock, Coins, Download, Eye, Hash, Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/library/Rating";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryBookRow } from "@/lib/types/library-book";

interface BookDetailsHeaderProps {
  book: LibraryBookRow;
  categoryName: string | null;
}

/** Full metadata header — cover plus every field the Phase 5 spec asks for
 *  (publisher/category/language/ISBN/page count/reading time/file type/
 *  free-or-paid/VX price/rating/read+download counts). Action buttons are
 *  rendered separately by the page (BookActions), not here. */
export function BookDetailsHeader({ book, categoryName }: BookDetailsHeaderProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <div className="flex aspect-[2/3] w-48 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground/40" aria-hidden="true">
        {book.cover_image_url ? (
          <img src={book.cover_image_url} alt="" loading="lazy" className="h-full w-full rounded-xl object-cover" />
        ) : (
          <BookOpen className="h-14 w-14" />
        )}
      </div>

      <div className="flex-1 space-y-3">
        <div>
          <h1 className="text-2xl font-bold">{book.title}</h1>
          {book.subtitle && <p className="text-muted-foreground">{book.subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link to={`/library/authors/${book.author_id}`} className="font-medium hover:underline">
            {book.author_name}
          </Link>
          {book.publisher_name && <span className="text-muted-foreground">· {book.publisher_name}</span>}
          {categoryName && (
            <Link to={`/library/categories/${book.category_id}`} className="text-muted-foreground hover:underline">
              · {categoryName}
            </Link>
          )}
        </div>

        {book.rating_count > 0 && <Rating value={book.rating_avg ?? 0} count={book.rating_count} size="md" />}

        <div className="flex flex-wrap gap-1.5">
          {book.formats.map((f) => (
            <Badge key={f} variant="secondary" className="capitalize">{t(`library.format.${f}`)}</Badge>
          ))}
          <Badge variant={book.is_free ? "secondary" : "outline"}>
            {book.is_free ? t("library.format.free") : book.price_vx ? `${book.price_vx} VX` : book.price_usd ? `$${book.price_usd}` : t("library.bookDetails.paid")}
          </Badge>
          {book.difficultyLevel && <Badge variant="outline" className="capitalize">{t(`library.bookDetails.difficulty.${book.difficultyLevel}`)}</Badge>}
          {book.ageCategory && <Badge variant="outline">{book.ageCategory}</Badge>}
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-3">
          <div className="flex items-center gap-1.5">
            <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <dt className="sr-only">{t("library.bookDetails.language")}</dt>
            <dd>{book.language}</dd>
          </div>
          {book.page_count != null && (
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <dt className="sr-only">{t("library.bookDetails.pageCount")}</dt>
              <dd>{book.page_count} {t("library.bookDetails.pages")}</dd>
            </div>
          )}
          {book.reading_time_minutes != null && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <dt className="sr-only">{t("library.bookDetails.readingTime")}</dt>
              <dd>{book.reading_time_minutes} {t("library.bookDetails.minutes")}</dd>
            </div>
          )}
          {book.isbn && (
            <div className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <dt className="sr-only">{t("library.bookDetails.isbn")}</dt>
              <dd>{book.isbn}</dd>
            </div>
          )}
          {book.published_date && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t("library.bookDetails.published")}</dt>
              <dd>{new Date(book.published_date).toLocaleDateString()}</dd>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <dt className="sr-only">{t("library.bookDetails.readCount")}</dt>
            <dd>{book.views_count.toLocaleString()}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <dt className="sr-only">{t("library.bookDetails.downloadCount")}</dt>
            <dd>{book.downloads_count.toLocaleString()}</dd>
          </div>
          {!book.is_free && book.price_vx != null && (
            <div className="flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <dt className="sr-only">{t("library.bookDetails.price")}</dt>
              <dd>{book.price_vx} VX</dd>
            </div>
          )}
        </dl>

        <p className="text-sm leading-relaxed text-muted-foreground">{book.description}</p>

        {book.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {book.keywords.map((kw) => (
              <Badge key={kw} variant="outline" className="text-xs font-normal text-muted-foreground">{kw}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
