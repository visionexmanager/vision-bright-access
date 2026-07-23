import { Link } from "react-router-dom";
import { BookOpen, Headphones, Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/library/Rating";
import { BookmarkButton } from "@/components/library/BookmarkButton";
import { FavoriteButton } from "@/components/library/FavoriteButton";
import { ShareButton } from "@/components/library/ShareButton";
import { QuickPreviewDialog } from "@/components/library/QuickPreviewDialog";
import { FlashDealBadge } from "@/components/library/marketplace/FlashDealBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryBookRow } from "@/lib/types/library-book";
import { cn } from "@/lib/utils";

interface BookCardProps {
  book: LibraryBookRow;
  isOnShelf?: boolean;
  onToggleShelf?: (bookId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (bookId: string) => void;
  className?: string;
}

/**
 * Security note: a paid book's card NEVER renders a live "Read now" link —
 * that would claim access we haven't verified. Free books link straight to
 * the reader; paid books show their price and route to the book details
 * page, where useBookAccess() does a real (one-book-at-a-time) purchase
 * check before offering to read/download. Checking access per-card in a
 * large grid would mean 2 extra queries per card — not scalable.
 */
export function BookCard({ book, isOnShelf, onToggleShelf, isFavorite, onToggleFavorite, className }: BookCardProps) {
  const { t } = useLanguage();

  return (
    <Card className={cn("group relative overflow-hidden transition-shadow hover:shadow-md", className)}>
      <Link to={`/library/books/${book.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
          {book.cover_image_url ? (
            <img src={book.cover_image_url} alt="" loading="lazy" width={240} height={360} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/40" aria-hidden="true">
              <BookOpen className="h-10 w-10" />
            </div>
          )}
          {book.formats.includes("audiobook") && (
            <Badge className="absolute top-2 end-2 gap-1" variant="secondary">
              <Headphones className="h-3 w-3" aria-hidden="true" /> {t("library.format.audiobook")}
            </Badge>
          )}
          {book.flashDealEndsAt && (
            <FlashDealBadge endsAt={book.flashDealEndsAt} className="absolute top-2 start-2 gap-1" />
          )}
        </div>
        <div className="space-y-1 p-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{book.title}</h3>
          <p className="text-xs text-muted-foreground">{book.author_name}</p>
          {book.rating_count > 0 && <Rating value={book.rating_avg ?? 0} count={book.rating_count} />}
          {book.page_count != null && <p className="text-xs text-muted-foreground">{book.page_count} {t("library.challenge.unit.pages")}</p>}
          <p className="text-sm font-semibold text-primary">
            {book.is_free ? (
              t("library.format.free")
            ) : book.price_vx ? (
              <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5" aria-hidden="true" />{book.price_vx} VX</span>
            ) : book.price_usd ? (
              `$${book.price_usd}`
            ) : null}
          </p>
        </div>
      </Link>

      {book.is_free && (
        <Button asChild size="sm" className="absolute bottom-14 start-2 end-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Link to={`/library/read/${book.id}`}>{t("library.actions.readNow")}</Link>
        </Button>
      )}

      <div className="absolute start-2 top-2 flex flex-col gap-1.5">
        {onToggleShelf && (
          <BookmarkButton active={!!isOnShelf} onToggle={() => onToggleShelf(book.id)} className="bg-background/90 backdrop-blur" />
        )}
        {onToggleFavorite && (
          <FavoriteButton active={!!isFavorite} onToggle={() => onToggleFavorite(book.id)} className="bg-background/90 backdrop-blur" />
        )}
      </div>

      <div className="absolute bottom-2 end-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <QuickPreviewDialog bookId={book.id} triggerClassName="bg-background/90 backdrop-blur" />
        <ShareButton
          title={book.title}
          text={t("library.share.checkOutBook").replace("{title}", book.title)}
          url={`${window.location.origin}/library/books/${book.id}`}
          className="bg-background/90 backdrop-blur"
        />
      </div>
    </Card>
  );
}
