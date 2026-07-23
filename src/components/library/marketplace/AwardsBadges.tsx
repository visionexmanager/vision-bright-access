import { Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useBookAwards } from "@/hooks/library/useBookAwards";
import { useLanguage } from "@/contexts/LanguageContext";

interface AwardsBadgesProps {
  bookId: string;
}

export function AwardsBadges({ bookId }: AwardsBadgesProps) {
  const { t } = useLanguage();
  const { awards, isLoading } = useBookAwards(bookId);
  if (isLoading || awards.length === 0) return null;

  return (
    <section aria-labelledby="book-awards-heading">
      <h2 id="book-awards-heading" className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Award className="h-4 w-4" aria-hidden="true" /> {t("library.bookDetails.awards")}
      </h2>
      <div className="flex flex-wrap gap-2" role="list">
        {awards.map((award) => (
          <Badge key={award.id} variant="secondary" className="gap-1.5 py-1.5" role="listitem">
            {award.icon_url ? <img src={award.icon_url} alt="" className="h-4 w-4" /> : <Award className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>
              {award.name}
              {award.year ? ` (${award.year})` : ""}
              {award.awarding_body ? ` — ${award.awarding_body}` : ""}
            </span>
          </Badge>
        ))}
      </div>
    </section>
  );
}
