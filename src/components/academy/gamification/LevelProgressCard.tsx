import { Sparkles, Gift } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { LevelBadge } from "./LevelBadge";
import type { AcademyLevelInfo } from "@/lib/academy/leveling";

interface LevelProgressCardProps {
  levelInfo: AcademyLevelInfo;
  xpTotal: number;
}

export function LevelProgressCard({ levelInfo, xpTotal }: LevelProgressCardProps) {
  return (
    <div className="bg-card p-6 rounded-2xl border border-border space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <LevelBadge levelInfo={levelInfo} />
          <span className={`text-sm font-bold ${levelInfo.rank.colorClass}`}>{levelInfo.rank.rank}</span>
        </div>
        <span className="text-xs text-muted-foreground font-medium">{xpTotal.toLocaleString()} XP إجمالي</span>
      </div>

      <div className="space-y-1.5">
        <Progress value={levelInfo.percentToNextLevel} className="h-2.5" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{levelInfo.xpIntoLevel.toLocaleString()} / {levelInfo.xpForNextLevel.toLocaleString()} XP</span>
          <span>المستوى {levelInfo.level + 1}</span>
        </div>
      </div>

      {levelInfo.unlocksAtThisLevel.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-foreground">فتحت للتو: {levelInfo.unlocksAtThisLevel.join("، ")}</p>
        </div>
      )}

      {levelInfo.nextMilestoneLevel !== null && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Gift className="w-3.5 h-3.5" aria-hidden="true" />
          المستوى الفارق التالي: {levelInfo.nextMilestoneLevel}
        </p>
      )}
    </div>
  );
}
