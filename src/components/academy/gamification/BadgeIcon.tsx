import { Lock } from "lucide-react";
import { resolveAchievementIcon } from "./achievementIcons";
import { TIER_STYLES } from "./tierStyles";
import type { AcademyBadgeTier } from "@/lib/types/academy-gamification";

interface BadgeIconProps {
  icon: string;
  tier: AcademyBadgeTier;
  unlocked: boolean;
  /** Reserved for a real animated-badge asset later — today it's a tasteful CSS glow, no asset pipeline. */
  animated?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: { box: "w-10 h-10 rounded-xl", icon: "w-4 h-4" },
  md: { box: "w-14 h-14 rounded-2xl", icon: "w-6 h-6" },
  lg: { box: "w-20 h-20 rounded-2xl", icon: "w-9 h-9" },
};

export function BadgeIcon({ icon, tier, unlocked, animated = false, size = "md" }: BadgeIconProps) {
  const style = TIER_STYLES[tier];
  const Icon = resolveAchievementIcon(icon);
  const s = SIZE_CLASSES[size];

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 border bg-gradient-to-br ${s.box} ${
        unlocked ? `${style.gradient} ${style.border} ${style.text}` : "bg-muted/40 border-dashed border-border text-muted-foreground"
      } ${unlocked && animated ? "shadow-[0_0_16px_-2px_currentColor]" : ""}`}
    >
      {unlocked ? <Icon className={s.icon} aria-hidden="true" /> : <Lock className={s.icon} aria-hidden="true" />}
    </div>
  );
}
