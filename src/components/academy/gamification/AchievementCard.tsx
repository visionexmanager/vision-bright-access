import { BadgeIcon } from "./BadgeIcon";
import { TIER_STYLES } from "./tierStyles";
import type { AcademyAchievementDef } from "@/lib/types/academy-gamification";

interface AchievementCardProps {
  achievement: AcademyAchievementDef;
  unlocked: boolean;
}

export function AchievementCard({ achievement, unlocked }: AchievementCardProps) {
  const isHiddenAndLocked = achievement.hidden && !unlocked;
  const style = TIER_STYLES[achievement.tier];

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-2xl border ${
        unlocked ? `${style.border} bg-card` : "border-dashed border-border bg-muted/30 opacity-80"
      }`}
    >
      <BadgeIcon icon={achievement.icon} tier={achievement.tier} unlocked={unlocked} animated={achievement.animatedAssetPrepared} />
      <div className="min-w-0">
        <p className="font-bold text-foreground text-sm truncate">
          {isHiddenAndLocked ? "إنجاز مخفي" : achievement.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {isHiddenAndLocked ? "أكمل نشاطات معينة لكشف هذا الإنجاز" : achievement.description}
        </p>
        <span className={`text-[10px] font-bold ${unlocked ? style.text : "text-muted-foreground"}`}>{style.label}</span>
      </div>
    </div>
  );
}
