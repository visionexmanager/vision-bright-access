import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Blocks, LayoutDashboard, Palette, Bell, Settings, BarChart3 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { usePlatformStats } from "@/features/visionkids/hooks/platform/usePlatform";
import { PLATFORM_ENGINES } from "@/features/visionkids/data/platformConfig";

const QUICK_LINKS = [
  { to: "/kids/platform/marketplace", icon: Blocks, key: "kids.platform.nav.marketplace" },
  { to: "/kids/platform/dashboard", icon: LayoutDashboard, key: "kids.platform.nav.dashboard" },
  { to: "/kids/platform/themes", icon: Palette, key: "kids.platform.nav.themes" },
  { to: "/kids/platform/notifications", icon: Bell, key: "kids.platform.nav.notifications" },
  { to: "/kids/platform/settings", icon: Settings, key: "kids.platform.nav.settings" },
  { to: "/kids/platform/analytics", icon: BarChart3, key: "kids.platform.nav.analytics" },
];

export default function PlatformHub() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();
  const { data: stats } = usePlatformStats();

  useDocumentHead({
    title: t("kids.platform.meta.title"),
    description: t("kids.platform.meta.description"),
    canonicalPath: "/kids/platform",
  });

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)}
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <motion.section variants={slideUp(reduced)} className="text-center">
        <h1 className="font-heading text-4xl font-extrabold sm:text-5xl">
          <span aria-hidden="true">🧩</span> {t("kids.platform.heroTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">{t("kids.platform.heroSubtitle")}</p>
      </motion.section>

      {/* Quick links */}
      <motion.nav variants={fadeIn(reduced)} aria-label={t("kids.platform.quickLinks")} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-border bg-card p-4 text-center transition-transform hover:scale-[1.03] hover:border-kids-primary/50">
            <l.icon className="h-6 w-6 text-kids-primary" aria-hidden="true" />
            <span className="text-xs font-bold">{t(l.key)}</span>
          </Link>
        ))}
      </motion.nav>

      {/* Stats */}
      {user && stats && (
        <motion.section variants={fadeIn(reduced)} className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border-2 border-border bg-card p-4 text-center">
            <p className="font-heading text-2xl font-extrabold">{stats.installed}</p>
            <p className="text-xs font-semibold text-muted-foreground">{t("kids.platform.installedPlugins")}</p>
          </div>
          <div className="rounded-2xl border-2 border-border bg-card p-4 text-center">
            <p className="font-heading text-2xl font-extrabold">{stats.widgets}</p>
            <p className="text-xs font-semibold text-muted-foreground">{t("kids.platform.myWidgets")}</p>
          </div>
          <Link to="/kids/platform/notifications" className="rounded-2xl border-2 border-border bg-card p-4 text-center hover:border-kids-primary/50">
            <p className="font-heading text-2xl font-extrabold text-kids-pink">{stats.unread}</p>
            <p className="text-xs font-semibold text-muted-foreground">{t("kids.platform.unread")}</p>
          </Link>
        </motion.section>
      )}

      {/* Engines */}
      <section className="mt-10">
        <h2 className="font-heading text-2xl font-bold">{t("kids.platform.enginesTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("kids.platform.enginesHint")}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {PLATFORM_ENGINES.map((engine) => (
            <div key={engine.id} className="flex flex-col gap-1 rounded-2xl border-2 border-border bg-card p-4">
              <span className="text-2xl" aria-hidden="true">{engine.emoji}</span>
              <span className="font-heading text-sm font-bold leading-tight">{t(engine.labelKey)}</span>
              <span className={`mt-1 inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${
                engine.status === "core" ? "bg-kids-green/15 text-kids-green"
                  : engine.status === "active" ? "bg-kids-primary/15 text-kids-primary"
                    : "bg-kids-accent/15 text-kids-accent"
              }`}>
                {t(`kids.platform.status.${engine.status}`)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
