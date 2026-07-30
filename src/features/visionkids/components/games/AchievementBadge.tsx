import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Achievement } from "@/features/visionkids/types/stories.types";

function resolveIcon(name: string | null): LucideIcon {
  if (!name) return Award;
  const icon = (Icons as unknown as Record<string, LucideIcon>)[name];
  return icon ?? Award;
}

interface AchievementBadgeProps {
  achievement: Achievement;
  earned: boolean;
  earnedAt?: string;
}

export function AchievementBadge({ achievement, earned, earnedAt }: AchievementBadgeProps) {
  const { t } = useLanguage();
  const Icon = resolveIcon(achievement.icon);

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-opacity ${
        earned ? "border-kids-accent/50 bg-kids-accent/10" : "border-border bg-card opacity-50"
      }`}
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${earned ? "bg-kids-accent/20" : "bg-muted"}`} aria-hidden="true">
        <Icon className={`h-7 w-7 ${earned ? "text-kids-accent" : "text-muted-foreground"}`} />
      </div>
      <p className="font-heading text-sm font-bold">{achievement.title}</p>
      {achievement.description && <p className="text-xs text-muted-foreground">{achievement.description}</p>}
      {earned && earnedAt && <p className="text-[10px] text-muted-foreground">{new Date(earnedAt).toLocaleDateString()}</p>}
      {!earned && <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.games.locked")}</p>}
    </div>
  );
}
