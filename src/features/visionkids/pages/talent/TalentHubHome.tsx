import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useTalentTracks } from "@/features/visionkids/hooks/talent/useTalentCatalog";
import { useTalentStats } from "@/features/visionkids/hooks/talent/useTrackProgress";
import { useMyModuleProgress } from "@/features/visionkids/hooks/talent/useTrackProgress";
import { useMyTalentResult } from "@/features/visionkids/hooks/talent/useAssessment";
import { TALENT_NAV } from "@/features/visionkids/data/talentConfig";
import { TrackCard } from "@/features/visionkids/components/talent/TrackCard";
import { RankBadge } from "@/features/visionkids/components/talent/RankBadge";

export default function TalentHubHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  const { data: tracks = [], isLoading } = useTalentTracks();
  const { data: stats } = useTalentStats();
  const { data: moduleProgress = [] } = useMyModuleProgress();
  const { data: result } = useMyTalentResult();

  useDocumentHead({
    title: t("kids.talent.meta.title"),
    description: t("kids.talent.meta.description"),
    canonicalPath: "/kids/talent",
  });

  const doneByTrack = moduleProgress.reduce<Record<string, number>>((acc, p) => {
    acc[p.track_slug] = (acc[p.track_slug] ?? 0) + 1;
    return acc;
  }, {});

  const topDomains = result?.top_domains ?? [];
  const recommended = topDomains.length
    ? tracks.filter((tr) => tr.primary_domain && topDomains.includes(tr.primary_domain))
    : [];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(reduced)}
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"
    >
      <motion.section variants={slideUp(reduced)} className="text-center">
        <h1 className="font-heading text-4xl font-extrabold sm:text-5xl">
          <span aria-hidden="true">🌟</span> {t("kids.talent.heroTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">{t("kids.talent.heroSubtitle")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/kids/talent/assessment" className="rounded-full bg-gradient-to-r from-kids-primary to-kids-purple px-5 py-2.5 font-bold text-white hover:opacity-90">
            🧭 {t("kids.talent.cta.discover")}
          </Link>
          <Link to="/kids/talent/skill-tree" className="rounded-full border-2 border-border px-5 py-2.5 font-bold hover:border-kids-primary/50">
            🌳 {t("kids.talent.nav.skillTree")}
          </Link>
        </div>
      </motion.section>

      {/* Ranks (signed-in only) */}
      {user && stats && (
        <motion.section variants={fadeIn(reduced)} className="mt-8 grid gap-3 sm:grid-cols-2">
          <RankBadge rank={stats.talent_rank} kind="talent" label={t("kids.talent.talentRank")} />
          <RankBadge rank={stats.innovation_rank} kind="innovation" label={t("kids.talent.innovationRankLabel")} />
        </motion.section>
      )}

      {/* Quick nav */}
      <motion.nav variants={fadeIn(reduced)} aria-label={t("kids.talent.exploreTitle")} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TALENT_NAV.map((entry) => (
          <Link
            key={entry.id}
            to={entry.to}
            className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border p-4 text-center transition-transform hover:scale-[1.03] hover:border-kids-primary/50"
          >
            <span className="text-3xl" aria-hidden="true">{entry.emoji}</span>
            <span className="text-sm font-semibold">{t(entry.labelKey)}</span>
          </Link>
        ))}
      </motion.nav>

      {/* Recommended (based on assessment) */}
      {recommended.length > 0 && (
        <motion.section variants={fadeIn(reduced)} className="mt-10">
          <h2 className="font-heading text-xl font-bold">✨ {t("kids.talent.recommendedTitle")}</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((tr) => (
              <TrackCard key={tr.slug} track={tr} progress={{ done: doneByTrack[tr.slug] ?? 0, total: 0 }} />
            ))}
          </div>
        </motion.section>
      )}

      {/* All academies */}
      <motion.section variants={fadeIn(reduced)} className="mt-10">
        <h2 className="font-heading text-xl font-bold">🎓 {t("kids.talent.academiesTitle")}</h2>
        {isLoading ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((tr) => (
              <TrackCard key={tr.slug} track={tr} />
            ))}
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
