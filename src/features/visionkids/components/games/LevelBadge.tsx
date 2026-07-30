import { Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMyXpTotal, useLevelForXp } from "@/features/visionkids/hooks/games/useGameEngagement";

/** Level curve: kids_level_for_xp() = floor(sqrt(xp/25)) + 1, capped at 100 — see that SQL function for the source of truth. */
function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 25;
}

export function LevelBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const { data: xp = 0 } = useMyXpTotal();
  const { data: level = 1 } = useLevelForXp(xp);

  if (compact) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-kids-accent/10 px-2.5 py-1 text-xs font-bold text-kids-accent">
        <Star className="h-3.5 w-3.5 fill-kids-accent" aria-hidden="true" /> {t("kids.games.level")} {level}
      </span>
    );
  }

  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(Math.min(level + 1, 100));
  const progressPercent = level >= 100 ? 100 : Math.min(100, ((xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)) * 100);

  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="flex items-center gap-1 text-kids-accent"><Star className="h-4 w-4 fill-kids-accent" aria-hidden="true" /> {t("kids.games.level")} {level}</span>
        <span className="text-muted-foreground">{xp} XP</span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progressPercent)} aria-valuemin={0} aria-valuemax={100} aria-label={t("kids.games.levelProgress")}>
        <div className="h-full rounded-full bg-gradient-to-r from-kids-primary to-kids-accent transition-all" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}
