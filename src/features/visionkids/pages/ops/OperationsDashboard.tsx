import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, Bug, FileSearch, Flag, Building2, Package } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useOpsOverview } from "@/features/visionkids/hooks/ops/useOps";
import { OPS_SECTIONS } from "@/features/visionkids/data/opsConfig";
import { OpsHeader, AdminGate } from "@/features/visionkids/components/ops/OpsShell";

export default function OperationsDashboard() {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();

  useDocumentHead({
    title: t("kids.ops.meta.title"),
    description: t("kids.ops.meta.description"),
    canonicalPath: "/kids/ops",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <OpsHeader emoji="🛰️" title={t("kids.ops.heroTitle")} subtitle={t("kids.ops.heroSubtitle")} backTo="/kids" backLabelKey="kids.nav.home" />
      <AdminGate>
        <Overview />
        <motion.nav initial="hidden" animate="visible" variants={staggerContainer(reduced)}
          aria-label={t("kids.ops.sections")} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {OPS_SECTIONS.map((s) => (
            <motion.div key={s.id} variants={fadeIn(reduced)}>
              <Link to={s.to} className="flex h-full flex-col items-center gap-1.5 rounded-2xl border-2 border-border bg-card p-4 text-center transition-transform hover:scale-[1.03] hover:border-kids-primary/50">
                <span className="text-3xl" aria-hidden="true">{s.emoji}</span>
                <span className="text-sm font-bold">{t(s.labelKey)}</span>
              </Link>
            </motion.div>
          ))}
        </motion.nav>
      </AdminGate>
    </div>
  );
}

function Overview() {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const { data: o } = useOpsOverview();
  if (!o) return null;

  const tiles = [
    { icon: AlertTriangle, label: t("kids.ops.overview.openIncidents"), value: o.open_incidents, danger: o.critical_incidents > 0 },
    { icon: Bug, label: t("kids.ops.overview.errors"), value: o.unresolved_errors, danger: o.unresolved_errors > 0 },
    { icon: FileSearch, label: t("kids.ops.overview.pendingReviews"), value: o.pending_reviews },
    { icon: Flag, label: t("kids.ops.overview.activeFlags"), value: o.active_flags },
    { icon: Building2, label: t("kids.ops.overview.organizations"), value: o.organizations },
    { icon: Package, label: t("kids.ops.overview.products"), value: o.published_products },
  ];

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn(reduced)} className="mt-6">
      {o.maintenance && (
        <p className="mb-3 rounded-xl border-2 border-kids-accent/50 bg-kids-accent/10 p-3 text-sm font-semibold text-kids-accent">🛠️ {t("kids.ops.overview.maintenanceOn")}</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className={`flex flex-col items-center gap-1 rounded-2xl border-2 bg-card p-4 text-center ${tile.danger ? "border-kids-pink/50" : "border-border"}`}>
            <tile.icon className={`h-6 w-6 ${tile.danger ? "text-kids-pink" : "text-kids-primary"}`} aria-hidden="true" />
            <span className="font-heading text-2xl font-extrabold">{tile.value}</span>
            <span className="text-[10px] font-semibold text-muted-foreground">{tile.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
