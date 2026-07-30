import { CheckCircle2, Sparkles, Coins } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DailyChallenge, WeeklyChallenge } from "@/features/visionkids/types/games.types";

export function ChallengeCard({ challenge }: { challenge: DailyChallenge | WeeklyChallenge }) {
  const { t } = useLanguage();
  const current = challenge.progress?.current_value ?? 0;
  const completed = !!challenge.progress?.completed_at;
  const percent = Math.min(100, (current / challenge.target_value) * 100);

  return (
    <div className={`rounded-2xl border-2 p-4 ${completed ? "border-kids-green/50 bg-kids-green/10" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-heading font-bold">{challenge.title}</h3>
          {challenge.description && <p className="mt-0.5 text-sm text-muted-foreground">{challenge.description}</p>}
        </div>
        {completed && <CheckCircle2 className="h-6 w-6 shrink-0 text-kids-green" aria-hidden="true" />}
      </div>

      <div className="mt-3">
        <Progress value={percent} aria-label={`${current} / ${challenge.target_value}`} />
        <p className="mt-1 text-xs text-muted-foreground">{Math.min(current, challenge.target_value)} / {challenge.target_value}</p>
      </div>

      <div className="mt-3 flex items-center gap-3 text-sm font-semibold">
        <span className="flex items-center gap-1 text-kids-accent"><Sparkles className="h-4 w-4" aria-hidden="true" /> +{challenge.reward_xp} XP</span>
        <span className="flex items-center gap-1 text-kids-secondary"><Coins className="h-4 w-4" aria-hidden="true" /> +{challenge.reward_coins}</span>
      </div>
      {!completed && <p className="mt-2 text-xs text-muted-foreground">{t("kids.games.challengeHint")}</p>}
    </div>
  );
}
