import { Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";
import { MOCK_CAREER_LEVEL } from "../../mock/mockAchievements";

export function CareerScoreWidget() {
  const { t } = useLanguage();
  const { level, xp, xpForNextLevel } = MOCK_CAREER_LEVEL;
  const pct = Math.round((xp / xpForNextLevel) * 100);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Trophy className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("careerDash.widget.careerScore")}</p>
          <p className="text-xl font-black">{t("careerDash.widget.level")} {level}</p>
        </div>
      </div>
      <Progress value={pct} aria-label={t("careerDash.widget.careerScore")} />
      <p className="text-xs text-muted-foreground">{xp} / {xpForNextLevel} XP</p>
    </div>
  );
}
