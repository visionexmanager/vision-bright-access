import { FlaskConical, Lightbulb, Bot, Box, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useStemStats } from "@/features/visionkids/hooks/stem/useStemEngagement";
import { SCIENCE_RANKS, INVENTOR_RANKS } from "@/features/visionkids/data/stemConfig";
import { StemHeader } from "@/features/visionkids/components/stem/StemHeader";

export default function StemRewards() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: stats } = useStemStats();

  useDocumentHead({
    title: `${t("kids.stem.nav.rewards")} — VisionKids`,
    description: t("kids.stem.rewards.subtitle"),
    canonicalPath: "/kids/stem/rewards",
  });

  const sciIndex = stats ? SCIENCE_RANKS.findIndex((r) => r.slug === stats.science_rank) : -1;
  const invIndex = stats ? INVENTOR_RANKS.findIndex((r) => r.slug === stats.inventor_rank) : -1;

  const tiles = stats
    ? [
        { icon: FlaskConical, color: "text-kids-primary", label: t("kids.stem.experimentsDone"), value: stats.experiments },
        { icon: Lightbulb, color: "text-kids-pink", label: t("kids.stem.rewards.inventions"), value: stats.inventions },
        { icon: Bot, color: "text-kids-secondary", label: t("kids.stem.rewards.robots"), value: stats.robots },
        { icon: Box, color: "text-kids-accent", label: t("kids.stem.rewards.designs"), value: stats.designs },
        { icon: BookOpen, color: "text-kids-green", label: t("kids.stem.rewards.research"), value: stats.research_read },
      ]
    : [];

  function ladder(title: string, ranks: { slug: string; emoji: string }[], currentIndex: number, rankKeyPrefix: string) {
    return (
      <section className="mt-8">
        <h2 className="font-heading text-xl font-bold">{title}</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-5">
          {ranks.map((rank, i) => {
            const reached = currentIndex >= i;
            const isCurrent = currentIndex === i;
            return (
              <li key={rank.slug} aria-current={isCurrent ? "step" : undefined}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-4 text-center transition-colors ${
                  isCurrent ? "border-kids-primary bg-kids-primary/10" : reached ? "border-kids-green/40 bg-kids-green/5" : "border-border opacity-60"
                }`}>
                <span className="text-3xl" aria-hidden="true">{rank.emoji}</span>
                <span className="text-sm font-bold">{t(`${rankKeyPrefix}.${rank.slug}`)}</span>
                {isCurrent && <span className="text-[10px] font-semibold uppercase tracking-wide text-kids-primary">{t("kids.stem.rewards.youAreHere")}</span>}
              </li>
            );
          })}
        </ol>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <StemHeader emoji="🏆" title={t("kids.stem.nav.rewards")} subtitle={t("kids.stem.rewards.subtitle")} />

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.stem.rewards.signInHint")}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {tiles.map((tile) => (
              <div key={tile.label} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-4 text-center">
                <tile.icon className={`h-7 w-7 ${tile.color}`} aria-hidden="true" />
                <span className="font-heading text-2xl font-extrabold">{tile.value}</span>
                <span className="text-xs font-semibold text-muted-foreground">{tile.label}</span>
              </div>
            ))}
          </div>

          {ladder(t("kids.stem.scienceRank"), SCIENCE_RANKS, sciIndex, "kids.stem.scienceRank")}
          {ladder(t("kids.stem.inventorRank"), INVENTOR_RANKS, invIndex, "kids.stem.inventorRank")}
        </>
      )}
    </div>
  );
}
