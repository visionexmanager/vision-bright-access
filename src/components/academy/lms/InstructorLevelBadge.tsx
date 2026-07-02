import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Award, Crown } from "lucide-react";
import type { AcademyInstructorLevel } from "@/lib/types/academy-modules";

const CONFIG: Record<AcademyInstructorLevel, { label: string; icon: typeof Sparkles; className: string }> = {
  new: { label: "مدرّس جديد", icon: Sparkles, className: "bg-muted text-muted-foreground border-border" },
  rising: { label: "مدرّس صاعد", icon: TrendingUp, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  expert: { label: "مدرّس خبير", icon: Award, className: "bg-primary/10 text-primary border-primary/20" },
  master: { label: "مدرّس متمرّس", icon: Crown, className: "bg-yellow-400/10 text-yellow-600 border-yellow-400/20" },
};

export function InstructorLevelBadge({ level }: { level: AcademyInstructorLevel }) {
  const { label, icon: Icon, className } = CONFIG[level];
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
