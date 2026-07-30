import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyTalentResult } from "@/features/visionkids/hooks/talent/useAssessment";
import { useTalentDomains, useTalentTracks } from "@/features/visionkids/hooks/talent/useTalentCatalog";
import { useTalentStats } from "@/features/visionkids/hooks/talent/useTrackProgress";
import { TALENT_COLOR_CLASSES } from "@/features/visionkids/data/talentConfig";
import { TalentHeader } from "@/features/visionkids/components/talent/TalentHeader";
import { RankBadge } from "@/features/visionkids/components/talent/RankBadge";
import { TrackCard } from "@/features/visionkids/components/talent/TrackCard";

export default function MyTalents() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: result, isLoading } = useMyTalentResult();
  const { data: domains = [] } = useTalentDomains();
  const { data: tracks = [] } = useTalentTracks();
  const { data: stats } = useTalentStats();

  useDocumentHead({
    title: `${t("kids.talent.nav.myTalents")} — VisionKids`,
    description: t("kids.talent.myTalents.subtitle"),
    canonicalPath: "/kids/talent/my-talents",
  });

  const scores = result?.domain_scores ?? {};
  const maxScore = Math.max(1, ...Object.values(scores));
  const ranked = domains
    .map((d) => ({ domain: d, score: scores[d.slug] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const topDomains = result?.top_domains ?? [];
  const recommended = tracks.filter((tr) => tr.primary_domain && topDomains.includes(tr.primary_domain));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <TalentHeader emoji="🌟" title={t("kids.talent.nav.myTalents")} subtitle={t("kids.talent.myTalents.subtitle")} showSubNav activeId="my-talents" />

      {user && stats && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <RankBadge rank={stats.talent_rank} kind="talent" label={t("kids.talent.talentRank")} />
          <RankBadge rank={stats.innovation_rank} kind="innovation" label={t("kids.talent.innovationRankLabel")} />
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 h-64 animate-pulse rounded-3xl bg-muted" aria-busy="true" />
      ) : !result ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
          <p className="text-4xl" aria-hidden="true">🧭</p>
          <p className="mt-2 font-heading text-lg font-bold">{t("kids.talent.myTalents.empty")}</p>
          <Link to="/kids/talent/assessment" className="mt-4 inline-block rounded-full bg-kids-primary px-5 py-2.5 font-bold text-white hover:opacity-90">
            {t("kids.talent.cta.discover")}
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="font-heading text-xl font-bold">{t("kids.talent.myTalents.profileTitle")}</h2>
            <ul className="mt-3 space-y-2">
              {ranked.map(({ domain, score }) => (
                <li key={domain.slug} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm font-semibold">
                    <span aria-hidden="true">{domain.emoji}</span> {domain.title}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${TALENT_COLOR_CLASSES[domain.color]}`} style={{ width: `${(score / maxScore) * 100}%`, opacity: score === 0 ? 0.3 : 1 }} />
                  </div>
                  <span className="w-6 shrink-0 text-end text-sm tabular-nums text-muted-foreground">{score}</span>
                </li>
              ))}
            </ul>
            <Link to="/kids/talent/assessment" className="mt-4 inline-block text-sm font-semibold text-kids-primary hover:underline">
              ↻ {t("kids.talent.myTalents.retake")}
            </Link>
          </section>

          {recommended.length > 0 && (
            <section className="mt-8">
              <h2 className="font-heading text-xl font-bold">✨ {t("kids.talent.recommendedTitle")}</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {recommended.map((tr) => <TrackCard key={tr.slug} track={tr} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
