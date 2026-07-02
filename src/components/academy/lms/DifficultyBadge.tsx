import { Badge } from "@/components/ui/badge";
import type { AcademyCourseDifficulty } from "@/lib/types/academy-modules";

const LABELS: Record<AcademyCourseDifficulty, string> = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  advanced: "متقدّم",
};

const STYLES: Record<AcademyCourseDifficulty, string> = {
  beginner: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  intermediate: "bg-yellow-400/10 text-yellow-600 border-yellow-400/20",
  advanced: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function DifficultyBadge({ difficulty }: { difficulty: AcademyCourseDifficulty }) {
  return (
    <Badge variant="outline" className={STYLES[difficulty]}>
      {LABELS[difficulty]}
    </Badge>
  );
}
