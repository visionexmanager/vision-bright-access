import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Coins, Star, Gift } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useEconomySummary } from "@/features/visionkids/hooks/economy/useEconomy";
import { ECONOMY_SECTIONS } from "@/features/visionkids/data/economyConfig";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";

export default function EconomyHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();
  const { data: s } = useEconomySummary();

  useDocumentHead({ title: t("kids.economy.meta.title"), description: t("kids.economy.meta.description"), canonicalPath: "/kids/economy" });

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <motion.div variants={slideUp(reduced)}>
        <EconomyHeader emoji="🪙" title={t("kids.economy.heroTitle")} subtitle={t("kids.economy.heroSubtitle")} backTo="/kids" backLabelKey="kids.nav.home" />
      </motion.div>

      {user && s && (
        <motion.section variants={fadeIn(reduced)} className="mt-6 grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
            <Coins className="h-8 w-8 shrink-0 text-kids-accent" aria-hidden="true" />
            <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.economy.coins")}</p><p className="font-heading text-2xl font-bold">{s.coins.toLocaleString()}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
            <Star className="h-8 w-8 shrink-0 text-kids-primary" aria-hidden="true" /><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.economy.badges")}</p><p className="font-heading text-2xl font-bold">{s.badges}</p></div>
          </div>
          <Link to="/kids/economy/gifts" className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 hover:border-kids-primary/50">
            <Gift className="h-8 w-8 shrink-0 text-kids-pink" aria-hidden="true" /><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kids.economy.pendingGifts")}</p><p className="font-heading text-2xl font-bold">{s.pending_gifts}</p></div>
          </Link>
        </motion.section>
      )}

      <motion.nav variants={fadeIn(reduced)} aria-label={t("kids.economy.sections")} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ECONOMY_SECTIONS.map((sec) => (
          <Link key={sec.id} to={sec.to} className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-border bg-card p-4 text-center transition-transform hover:scale-[1.03] hover:border-kids-primary/50">
            <span className="text-3xl" aria-hidden="true">{sec.emoji}</span>
            <span className="text-sm font-bold">{t(sec.labelKey)}</span>
          </Link>
        ))}
      </motion.nav>
    </motion.div>
  );
}
