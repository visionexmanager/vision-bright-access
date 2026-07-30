import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useHealthyChallenges } from "@/features/visionkids/hooks/wellness/useWellnessCatalog";
import { useChallengeProgress, useCompleteChallenge } from "@/features/visionkids/hooks/wellness/useWellnessEngagement";
import { WELLNESS_COLOR_CLASSES } from "@/features/visionkids/data/wellnessConfig";
import { WellnessHeader } from "@/features/visionkids/components/wellness/WellnessHeader";
import { WellnessRewardBanner } from "@/features/visionkids/components/wellness/WellnessRewardBanner";
import type { ChallengePeriod, HealthyChallenge } from "@/features/visionkids/types/wellness.types";

const PERIODS: ChallengePeriod[] = ["daily", "weekly"];

export default function HealthyChallenges() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: challenges = [], isLoading } = useHealthyChallenges();
  const { data: progress = [] } = useChallengeProgress();
  const complete = useCompleteChallenge();

  const [reward, setReward] = useState<{ xp: number; coins: number } | null>(null);

  useDocumentHead({
    title: `${t("kids.wellness.nav.challenges")} — VisionKids`,
    description: t("kids.wellness.challenges.subtitle"),
    canonicalPath: "/kids/health/challenges",
  });

  const doneIds = useMemo(
    () => new Set(progress.filter((p) => p.completed).map((p) => p.challenge_id)),
    [progress],
  );

  const byPeriod = (period: ChallengePeriod) => challenges.filter((c) => c.period === period);

  async function onComplete(c: HealthyChallenge) {
    if (!user || doneIds.has(c.id) || complete.isPending) return;
    try {
      const ok = await complete.mutateAsync(c.id);
      if (ok) {
        setReward({ xp: c.reward_xp, coins: c.reward_coins });
        setTimeout(() => setReward(null), 3000);
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <WellnessHeader emoji="🏅" title={t("kids.wellness.nav.challenges")} subtitle={t("kids.wellness.challenges.subtitle")} showSubNav activeId="challenges" />

      <WellnessRewardBanner show={!!reward} message={t("kids.wellness.challenges.completedMsg")} xp={reward?.xp} coins={reward?.coins} />

      {isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : challenges.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.wellness.challenges.none")}</p>
      ) : (
        PERIODS.map((period) => {
          const list = byPeriod(period);
          if (list.length === 0) return null;
          return (
            <section key={period} className="mt-8">
              <h2 className="font-heading text-xl font-bold">{t(`kids.wellness.challenges.${period}`)}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {list.map((c) => {
                  const isDone = doneIds.has(c.id);
                  const color = period === "daily" ? WELLNESS_COLOR_CLASSES.primary : WELLNESS_COLOR_CLASSES.purple;
                  return (
                    <div key={c.id} className={`flex flex-col gap-3 rounded-2xl border-2 p-4 ${color}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-3xl" aria-hidden="true">{c.emoji}</span>
                        <div>
                          <p className="font-heading text-base font-bold leading-tight">{c.title}</p>
                          {c.description && <p className="text-sm text-foreground/70">{c.description}</p>}
                        </div>
                      </div>
                      <p className="text-sm font-semibold">
                        🎯 {t("kids.wellness.challenges.goal")}: {c.target_value} {c.unit ?? ""}
                      </p>
                      <button
                        type="button"
                        onClick={() => onComplete(c)}
                        disabled={!user || isDone || complete.isPending}
                        aria-pressed={isDone}
                        className={`mt-auto inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60 ${
                          isDone ? "bg-kids-green/20 text-kids-green" : "bg-kids-primary text-white hover:opacity-90"
                        }`}
                      >
                        {isDone ? (<><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("kids.wellness.challenges.done")}</>) : t("kids.wellness.challenges.complete")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {!user && <p className="mt-6 text-sm text-muted-foreground">{t("kids.wellness.challenges.signInHint")}</p>}
    </div>
  );
}
