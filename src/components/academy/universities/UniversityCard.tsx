import { memo } from "react";
import { Link } from "react-router-dom";
import { MapPin, Trophy, Landmark } from "lucide-react";
import { StarRating } from "@/components/academy/lms/StarRating";
import type { AcademyUniversityRow } from "@/lib/types/academy-modules";

interface UniversityCardProps {
  university: AcademyUniversityRow;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export const UniversityCard = memo(function UniversityCard({
  university, selectable, selected, onToggleSelect,
}: UniversityCardProps) {
  const content = (
    <>
      <div className="h-24 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center" aria-hidden="true">
        <Landmark className="w-8 h-8 text-primary/40" />
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2">{university.name}</h3>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3" aria-hidden="true" />
          {university.city ? `${university.city}، ${university.country}` : university.country}
        </p>
        {university.ranking_global != null && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Trophy className="w-3 h-3 text-yellow-500" aria-hidden="true" />
            الترتيب العالمي: {university.ranking_global}
          </p>
        )}
        <div className="mt-auto pt-2 border-t border-border/50">
          <StarRating rating={university.rating_avg} count={university.rating_count} />
        </div>
      </div>
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        onClick={onToggleSelect}
        aria-pressed={selected}
        className={`group flex flex-col text-start rounded-2xl border overflow-hidden transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          selected ? "border-primary bg-primary/5 shadow-lg" : "border-border bg-muted/30 hover:border-primary hover:shadow-lg"
        }`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={`/academy/universities/${university.id}`}
      className="group flex flex-col rounded-2xl border border-border bg-muted/30 overflow-hidden hover:border-primary hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {content}
    </Link>
  );
});
