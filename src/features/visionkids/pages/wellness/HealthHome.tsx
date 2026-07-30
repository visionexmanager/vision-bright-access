import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useWellnessStats } from "@/features/visionkids/hooks/wellness/useWellnessEngagement";
import { WELLNESS_NAV, WELLNESS_RANK_EMOJI } from "@/features/visionkids/data/wellnessConfig";

export default function HealthHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();
  const { data: stats } = useWellnessStats();

  useDocumentHead({
    title: t("kids.wellness.meta.title"),
    description: t("kids.wellness.meta.description"),
    canonicalPath: "/kids/health",
  });

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(reduced)}
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"
    >
      <motion.section variants={slideUp(reduced)} className="text-center">
        <h1 className="font-heading text-4xl font-extrabold sm:text-5xl">
          <span aria-hidden="true">💚</span> {t("kids.wellness.heroTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">{t("kids.wellness.heroSubtitle")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/kids/health/mood" className="rounded-full bg-gradient-to-r from-kids-primary to-kids-green px-5 py-2.5 font-bold text-white hover:opacity-90">
            🙂 {t("kids.wellness.cta.checkIn")}
          </Link>
          <Link to="/kids/health/companion" className="rounded-full border-2 border-border px-5 py-2.5 font-bold hover:border-kids-primary/50">
            🤖 {t("kids.wellness.nav.companion")}
          </Link>
        </div>
      </motion.section>

      {/* Streak + rank (signed-in) */}
      {user && stats && (
        <motion.section variants={fadeIn(reduced)} className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
            <Flame className="h-8 w-8 shrink-0 text-kids-pink" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.wellness.streak")}</p>
              <p className="font-heading text-2xl font-bold">{stats.streak} {t("kids.wellness.days")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
            <span className="text-3xl" aria-hidden="true">{WELLNESS_RANK_EMOJI[stats.wellness_rank] ?? "🌱"}</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.wellness.rankLabel")}</p>
              <p className="font-heading text-lg font-bold">{t(`kids.wellness.rank.${stats.wellness_rank}`)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
            <span className="text-3xl" aria-hidden="true">✅</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.wellness.todayLabel")}</p>
              <p className="font-heading text-lg font-bold">{stats.habits_today} {t("kids.wellness.habitsDone")}</p>
            </div>
          </div>
        </motion.section>
      )}

      {/* Nav grid */}
      <motion.nav variants={fadeIn(reduced)} aria-label={t("kids.wellness.exploreTitle")} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {WELLNESS_NAV.map((entry) => (
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
    </motion.div>
  );
}
