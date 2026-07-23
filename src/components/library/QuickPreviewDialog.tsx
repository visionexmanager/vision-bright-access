import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, BookOpen, Quote as QuoteIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/library/Rating";
import { Loading } from "@/components/library/Loading";
import { useQuickPreview } from "@/hooks/library/useQuickPreview";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface QuickPreviewDialogProps {
  bookId: string;
  triggerClassName?: string;
}

/**
 * Press-triggered (click or Enter/Space via the native <button>), not
 * hover-only — see the Phase 4 plan's accessibility note (WCAG 1.4.13:
 * hover-revealed content needs a keyboard/touch equivalent, so press is the
 * baseline rather than a hover-only reveal). Self-contained: owns its own
 * open state and only fetches once actually opened.
 */
export function QuickPreviewDialog({ bookId, triggerClassName }: QuickPreviewDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { book, similar, author, quote, isLoading } = useQuickPreview(bookId, open);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(triggerClassName)}
          aria-label={t("library.explorer.quickPreview")}
          onClick={(e) => e.stopPropagation()}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        {isLoading || !book ? (
          <Loading />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{book.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex aspect-[2/3] w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground/40" aria-hidden="true">
                  {book.cover_image_url ? (
                    <img src={book.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <BookOpen className="h-8 w-8" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">{book.author_name}</p>
                  {book.rating_count > 0 && <Rating value={book.rating_avg ?? 0} count={book.rating_count} />}
                  {book.page_count != null && (
                    <p className="text-xs text-muted-foreground">{book.page_count} {t("library.challenge.unit.pages")}</p>
                  )}
                </div>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">{book.description}</p>

              {author?.bio && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="mb-1 text-xs font-semibold">{t("library.explorer.aboutAuthor")}</p>
                  <p className="text-xs text-muted-foreground">{author.bio}</p>
                </div>
              )}

              {quote && (
                <div className="flex gap-2 rounded-lg border-s-4 border-primary/40 bg-primary/5 p-3">
                  <QuoteIcon className="h-4 w-4 shrink-0 text-primary/60" aria-hidden="true" />
                  <p className="text-sm italic">&ldquo;{quote.text}&rdquo;</p>
                </div>
              )}

              {similar.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold">{t("library.bookDetails.similarBooks")}</p>
                  <ul className="flex flex-wrap gap-2" role="list">
                    {similar.slice(0, 4).map((s) => (
                      <li key={s.id}>
                        <Link to={`/library/books/${s.id}`} className="rounded-full border px-3 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {s.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button asChild className="w-full">
                <Link to={`/library/books/${book.id}`}>{t("library.explorer.viewFullDetails")}</Link>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
