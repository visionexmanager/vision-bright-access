import { Flame, CheckCircle2, Dumbbell, Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useWellnessStats } from "@/features/visionkids/hooks/wellness/useWellnessEngagement";
import { WELLNESS_RANKS } from "@/features/visionkids/data/wellnessConfig";
import { WellnessHeader } from "@/features/visionkids/components/wellness/WellnessHeader";

export default function WellnessRewards() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: stats } = useWellnessStats();

  useDocumentHead({
    title: `${t("kids.wellness.nav.rewards")} — VisionKids`,
    description: t("kids.wellness.rewards.subtitle"),
    canonicalPath: "/kids/health/rewards",
  });

  const currentRankIndex = stats ? WELLNESS_RANKS.findIndex((r) => r.slug === stats.wellness_rank) : -1;

  const tiles = stats
    ? [
        { icon: Flame, color: "text-kids-pink", label: t("kids.wellness.streak"), value: `${stats.streak} ${t("kids.wellness.days")}` },
        { icon: CheckCircle2, color: "text-kids-green", label: t("kids.wellness.todayLabel"), value: `${stats.habits_today}` },
        { icon: Dumbbell, color: "text-kids-secondary", label: t("kids.wellness.rewards.sessions"), value: `${stats.sessions}` },
        { icon: Trophy, color: "text-kids-accent", label: t("kids.wellness.rewards.challengesDone"), value: `${stats.challenges_completed}` },
      ]
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <WellnessHeader emoji="🏆" title={t("kids.wellness.nav.rewards")} subtitle={t("kids.wellness.rewards.subtitle")} showSubNav activeId="rewards" />

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.wellness.rewards.signInHint")}</p>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.label} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-4 text-center">
                <tile.icon className={`h-7 w-7 ${tile.color}`} aria-hidden="true" />
                <span className="font-heading text-2xl font-extrabold">{tile.value}</span>
                <span className="text-xs font-semibold text-muted-foreground">{tile.label}</span>
              </div>
            ))}
          </div>

          {/* Rank ladder */}
          <section className="mt-8">
            <h2 className="font-heading text-xl font-bold">{t("kids.wellness.rewards.rankLadder")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("kids.wellness.rewards.rankHint")}</p>
            <ol className="mt-4 grid gap-3 sm:grid-cols-5">
              {WELLNESS_RANKS.map((rank, i) => {
                const reached = currentRankIndex >= i;
                const isCurrent = currentRankIndex === i;
                return (
                  <li
                    key={rank.slug}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-4 text-center transition-colors ${
                      isCurrent
                        ? "border-kids-primary bg-kids-primary/10"
                        : reached
                          ? "border-kids-green/40 bg-kids-green/5"
                          : "border-border opacity-60"
                    }`}
                  >
                    <span className="text-3xl" aria-hidden="true">{rank.emoji}</span>
                    <span className="text-sm font-bold">{t(`kids.wellness.rank.${rank.slug}`)}</span>
                    {isCurrent && <span className="text-[10px] font-semibold uppercase tracking-wide text-kids-primary">{t("kids.wellness.rewards.youAreHere")}</span>}
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
