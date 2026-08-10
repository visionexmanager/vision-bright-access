import { User, BadgeCheck, Star } from "lucide-react";
import type { AcademyInstructorRow } from "@/lib/types/academy-modules";
import { useLanguage } from "@/contexts/LanguageContext";

interface InstructorMiniCardProps {
  instructor: AcademyInstructorRow;
}

const SEED_INSTRUCTOR_ENGLISH: Record<string, { name: string; headline: string }> = {
  "a1000000-0000-4000-8000-000000000001": {
    name: "Visionex Academic Team",
    headline: "The official content production team for Visionex Academy",
  },
  "a1000000-0000-4000-8000-000000000002": {
    name: "Sarah Al-Ahmad",
    headline: "Mobile app developer with 8 years of experience",
  },
  "a1000000-0000-4000-8000-000000000003": {
    name: "Data Analytics Initiative",
    headline: "A community of instructors specializing in data science",
  },
};

export function InstructorMiniCard({ instructor }: InstructorMiniCardProps) {
  const { lang } = useLanguage();
  const localized = lang === "ar" ? undefined : SEED_INSTRUCTOR_ENGLISH[instructor.id];
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/50 border border-border">
      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true">
        <User className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-foreground text-sm truncate">{localized?.name ?? instructor.name}</p>
          {instructor.verified && (
            <BadgeCheck className="w-4 h-4 text-primary shrink-0" aria-label={lang === "ar" ? "مدرّس موثّق" : "Verified instructor"} />
          )}
        </div>
        {instructor.headline && (
          <p className="text-xs text-muted-foreground truncate">{localized?.headline ?? instructor.headline}</p>
        )}
        {instructor.rating != null && (
          <p className="text-xs text-yellow-600 flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" aria-hidden="true" />
            {instructor.rating.toFixed(1)} · {instructor.courses_count} {lang === "ar" ? "دورة" : instructor.courses_count === 1 ? "course" : "courses"}
          </p>
        )}
      </div>
    </div>
  );
}
