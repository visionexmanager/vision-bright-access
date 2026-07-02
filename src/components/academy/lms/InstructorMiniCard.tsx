import { User, BadgeCheck, Star } from "lucide-react";
import type { AcademyInstructorRow } from "@/lib/types/academy-modules";

interface InstructorMiniCardProps {
  instructor: AcademyInstructorRow;
}

export function InstructorMiniCard({ instructor }: InstructorMiniCardProps) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/50 border border-border">
      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true">
        <User className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-foreground text-sm truncate">{instructor.name}</p>
          {instructor.verified && (
            <BadgeCheck className="w-4 h-4 text-primary shrink-0" aria-label="مدرّس موثّق" />
          )}
        </div>
        {instructor.headline && (
          <p className="text-xs text-muted-foreground truncate">{instructor.headline}</p>
        )}
        {instructor.rating != null && (
          <p className="text-xs text-yellow-600 flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" aria-hidden="true" />
            {instructor.rating.toFixed(1)} · {instructor.courses_count} دورة
          </p>
        )}
      </div>
    </div>
  );
}
