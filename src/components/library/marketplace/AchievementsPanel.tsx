import { BookOpenCheck, Library, MessageSquare, Star, Coins, Trophy, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAchievements } from "@/hooks/library/useAchievements";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// Matches the `icon` column seeded in library_achievements (Phase 10) —
// a fixed, small set rather than a dynamic lucide-react lookup, since the
// achievement list itself is admin-curated and rarely changes.
const ACHIEVEMENT_ICONS: Record<string, typeof Trophy> = {
  BookOpenCheck, Library, MessageSquare, Star, Coins,
};

export function AchievementsPanel() {
  const { t } = useLanguage();
  const { achievements, isEarned, isLoading } = useAchievements();

  if (isLoading || achievements.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="list">
      {achievements.map((achievement) => {
        const Icon = ACHIEVEMENT_ICONS[achievement.icon ?? ""] ?? Trophy;
        const earned = isEarned(achievement.id);
        return (
          <Card
            key={achievement.id}
            role="listitem"
            className={cn("flex flex-col items-center gap-1.5 p-4 text-center", !earned && "opacity-50 grayscale")}
          >
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", earned ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              {earned ? <Icon className="h-6 w-6" aria-hidden="true" /> : <Lock className="h-5 w-5" aria-hidden="true" />}
            </div>
            <p className="text-sm font-semibold">{achievement.name}</p>
            <p className="text-xs text-muted-foreground">{achievement.description}</p>
            <p className="text-xs font-medium text-primary">{t("library.achievements.reward").replace("{amount}", String(achievement.reward_vx))}</p>
          </Card>
        );
      })}
    </div>
  );
}
