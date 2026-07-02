import { Trophy, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";
import { MOCK_ACHIEVEMENTS, MOCK_CAREER_LEVEL } from "../mock/mockAchievements";

export function AchievementsPanel() {
  const { t } = useLanguage();
  const { level, xp, xpForNextLevel } = MOCK_CAREER_LEVEL;
  const pct = Math.round((xp / xpForNextLevel) * 100);
  const totalXp = MOCK_ACHIEVEMENTS.filter((a) => a.unlocked).reduce((sum, a) => sum + a.xp, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.achievements")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.achievements.subtitle")}</p>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Trophy className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xl font-black">{t("careerDash.widget.level")} {level}</p>
            <p className="text-xs text-muted-foreground">{totalXp} {t("careerDash.achievements.totalXp")}</p>
          </div>
        </div>
        <Progress value={pct} aria-label={t("careerDash.widget.careerScore")} />
        <p className="mt-2 text-xs text-muted-foreground">{xp} / {xpForNextLevel} XP {t("careerDash.achievements.toNextLevel")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MOCK_ACHIEVEMENTS.map((badge) => {
          const Icon = badge.icon;
          return (
            <div
              key={badge.id}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-5 text-center ${
                badge.unlocked ? "border-border/60 bg-card" : "border-dashed border-border/60 bg-muted/30 opacity-60"
              }`}
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${badge.unlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {badge.unlocked ? <Icon className="h-6 w-6" aria-hidden="true" /> : <Lock className="h-5 w-5" aria-hidden="true" />}
              </span>
              <p className="text-sm font-bold">{t(badge.titleKey)}</p>
              <p className="text-xs text-muted-foreground">{t(badge.descKey)}</p>
              <span className="text-[11px] font-semibold text-primary">+{badge.xp} XP</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
