import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Map, Coins, Compass, Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useRegions } from "@/features/visionkids/hooks/world/useWorldCatalog";
import { useWorldStats } from "@/features/visionkids/hooks/world/useWorldProgress";
import { WORLD_COLOR_CLASSES } from "@/features/visionkids/data/worldConfig";

export default function WorldHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();
  const { data: regions = [], isLoading } = useRegions();
  const { data: stats } = useWorldStats();

  useDocumentHead({
    title: t("kids.world.meta.title"),
    description: t("kids.world.meta.description"),
    canonicalPath: "/kids/world",
  });

  const places = regions.filter((r) => r.kind !== "island");

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(reduced)}
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"
    >
      <motion.section variants={slideUp(reduced)} className="text-center">
        <h1 className="font-heading text-4xl font-extrabold sm:text-5xl">
          <span aria-hidden="true">🌍</span> {t("kids.world.heroTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">{t("kids.world.heroSubtitle")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/kids/world/map" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-kids-primary to-kids-green px-5 py-2.5 font-bold text-white hover:opacity-90">
            <Map className="h-5 w-5" aria-hidden="true" /> {t("kids.world.nav.map")}
          </Link>
          <Link to="/kids/world/passport" className="inline-flex items-center gap-1.5 rounded-full border-2 border-border px-5 py-2.5 font-bold hover:border-kids-primary/50">
            🛂 {t("kids.world.nav.passport")}
          </Link>
        </div>
      </motion.section>

      {user && stats && (
        <motion.section variants={fadeIn(reduced)} className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
            <Coins className="h-8 w-8 shrink-0 text-kids-accent" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.world.coins")}</p>
              <p className="font-heading text-2xl font-bold">{stats.coins.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
            <Compass className="h-8 w-8 shrink-0 text-kids-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.world.regionsDiscovered")}</p>
              <p className="font-heading text-2xl font-bold">{stats.regions}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
            <Trophy className="h-8 w-8 shrink-0 text-kids-pink" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.world.questsDone")}</p>
              <p className="font-heading text-2xl font-bold">{stats.quests}</p>
            </div>
          </div>
        </motion.section>
      )}

      {isLoading ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <motion.nav variants={fadeIn(reduced)} aria-label={t("kids.world.exploreTitle")} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {places.map((r) => (
            <Link
              key={r.slug}
              to={r.route ?? `/kids/world/region/${r.slug}`}
              className={`flex flex-col gap-1 rounded-2xl border-2 p-4 transition-transform hover:scale-[1.03] ${WORLD_COLOR_CLASSES[r.color]}`}
            >
              <span className="text-3xl" aria-hidden="true">{r.emoji}</span>
              <span className="font-heading text-sm font-bold leading-tight">{r.title}</span>
              {r.subtitle && <span className="text-xs text-foreground/60">{r.subtitle}</span>}
            </Link>
          ))}
        </motion.nav>
      )}
    </motion.div>
  );
}
