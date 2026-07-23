import { Link } from "react-router-dom";
import { Quote, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { LibraryQuoteRow } from "@/lib/types/library-review";

interface QuoteCardProps {
  quote: LibraryQuoteRow;
}

export function QuoteCard({ quote }: QuoteCardProps) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <Quote className="h-6 w-6 text-primary/50" aria-hidden="true" />
      <p className="flex-1 text-sm italic leading-relaxed">&ldquo;{quote.text}&rdquo;</p>
      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <Link to={`/library/books/${quote.book_id}`} className="hover:text-foreground hover:underline">
          {quote.book_title} — {quote.author_name}
        </Link>
        <span className="flex items-center gap-1" aria-label={`${quote.like_count} likes`}>
          <Heart className="h-3.5 w-3.5" aria-hidden="true" /> {quote.like_count}
        </span>
      </div>
    </Card>
  );
}
