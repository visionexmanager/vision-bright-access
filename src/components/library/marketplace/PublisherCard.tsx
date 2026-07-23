import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryPublisherProfile } from "@/lib/types/library-marketplace";

interface PublisherCardProps {
  publisher: LibraryPublisherProfile & { bookCount: number };
}

export function PublisherCard({ publisher }: PublisherCardProps) {
  const { t } = useLanguage();

  return (
    <Link to={`/library/publishers/${publisher.slug}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      <Card className="flex flex-col items-center gap-2 p-5 text-center transition-shadow hover:shadow-md">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground/50" aria-hidden="true">
          {publisher.logo_url ? (
            <img src={publisher.logo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-8 w-8" />
          )}
        </div>
        <h3 className="font-semibold">{publisher.name}</h3>
        <p className="text-xs text-muted-foreground">
          {publisher.bookCount} {t("library.authors.books")}
        </p>
      </Card>
    </Link>
  );
}
