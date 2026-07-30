import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FlaskConical, Lightbulb } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useStemLabs } from "@/features/visionkids/hooks/stem/useStemCatalog";
import { useStemStats } from "@/features/visionkids/hooks/stem/useStemEngagement";
import { STEM_COLOR_CLASSES, SCIENCE_RANK_EMOJI, INVENTOR_RANK_EMOJI } from "@/features/visionkids/data/stemConfig";

/** A lab's card links to its own route; centers/builders share the same
 *  /kids/stem/<slug> route space (all wired statically in App.tsx). */
function labPath(slug: string) {
  return `/kids/stem/${slug}`;
}

export default function StemHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();
  const { data: labs = [], isLoading } = useStemLabs();
  const { data: stats } = useStemStats();

  useDocumentHead({
    title: t("kids.stem.meta.title"),
    description: t("kids.stem.meta.description"),
    canonicalPath: "/kids/stem",
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
          <span aria-hidden="true">🔬</span> {t("kids.stem.heroTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">{t("kids.stem.heroSubtitle")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/kids/stem/innovation" className="rounded-full bg-gradient-to-r from-kids-primary to-kids-purple px-5 py-2.5 font-bold text-white hover:opacity-90">
            💡 {t("kids.stem.nav.innovation")}
          </Link>
          <Link to="/kids/stem/gallery" className="rounded-full border-2 border-border px-5 py-2.5 font-bold hover:border-kids-primary/50">
            🖼️ {t("kids.stem.nav.gallery")}
          </Link>
        </div>
      </motion.section>

      {/* Rank tiles (signed-in) */}
      {user && stats && (
        <motion.section variants={fadeIn(reduced)} className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link to="/kids/stem/rewards" className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 hover:border-kids-primary/50">
            <span className="text-3xl" aria-hidden="true">{SCIENCE_RANK_EMOJI[stats.science_rank] ?? "🌱"}</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.stem.scienceRank")}</p>
              <p className="font-heading text-lg font-bold">{t(`kids.stem.scienceRank.${stats.science_rank}`)}</p>
            </div>
          </Link>
          <Link to="/kids/stem/rewards" className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 hover:border-kids-primary/50">
            <span className="text-3xl" aria-hidden="true">{INVENTOR_RANK_EMOJI[stats.inventor_rank] ?? "🔧"}</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.stem.inventorRank")}</p>
              <p className="font-heading text-lg font-bold">{t(`kids.stem.inventorRank.${stats.inventor_rank}`)}</p>
            </div>
          </Link>
          <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
            <FlaskConical className="h-8 w-8 shrink-0 text-kids-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.stem.experimentsDone")}</p>
              <p className="font-heading text-2xl font-bold">{stats.experiments}</p>
            </div>
          </div>
        </motion.section>
      )}

      {/* Lab grid */}
      {isLoading ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <motion.nav variants={fadeIn(reduced)} aria-label={t("kids.stem.exploreTitle")} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {labs.map((lab) => (
            <Link
              key={lab.slug}
              to={labPath(lab.slug)}
              className={`flex flex-col gap-1 rounded-2xl border-2 p-4 transition-transform hover:scale-[1.03] ${STEM_COLOR_CLASSES[lab.color]}`}
            >
              <span className="text-3xl" aria-hidden="true">{lab.emoji}</span>
              <span className="font-heading text-sm font-bold leading-tight">{lab.title}</span>
              {lab.subtitle && <span className="text-xs text-foreground/60">{lab.subtitle}</span>}
            </Link>
          ))}
        </motion.nav>
      )}

      <motion.p variants={fadeIn(reduced)} className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Lightbulb className="h-4 w-4" aria-hidden="true" /> {t("kids.stem.homeFooter")}
      </motion.p>
    </motion.div>
  );
}
