import { Link } from "react-router-dom";
import { User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryAuthorRow } from "@/lib/types/library-author";

interface AuthorCardProps {
  author: LibraryAuthorRow;
}

export function AuthorCard({ author }: AuthorCardProps) {
  const { t } = useLanguage();

  return (
    <Link to={`/library/authors/${author.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      <Card className="flex flex-col items-center gap-2 p-5 text-center transition-shadow hover:shadow-md">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground/50" aria-hidden="true">
          {author.photo_url ? (
            <img src={author.photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <User className="h-8 w-8" />
          )}
        </div>
        <h3 className="font-semibold">{author.name}</h3>
        <p className="text-xs text-muted-foreground">
          {author.book_count} {t("library.authors.books")}
        </p>
      </Card>
    </Link>
  );
}
