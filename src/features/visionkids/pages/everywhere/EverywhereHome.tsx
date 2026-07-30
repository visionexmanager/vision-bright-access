import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Smartphone, Download, CloudOff, Wifi, Tv, Settings } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { registerCurrentDevice, touchCurrentDevice } from "@/features/visionkids/everywhere/service";
import { hydrateModes } from "@/features/visionkids/everywhere/modes";
import { flush } from "@/features/visionkids/everywhere/syncEngine";
import { useConnection } from "@/features/visionkids/everywhere/useConnection";
import { EverywhereHeader, ConnectionBadge } from "@/features/visionkids/components/everywhere/EverywhereShell";

const SECTIONS = [
  { to: "/kids/everywhere/devices", icon: Smartphone, key: "kids.everywhere.nav.devices" },
  { to: "/kids/everywhere/downloads", icon: Download, key: "kids.everywhere.nav.downloads" },
  { to: "/kids/everywhere/offline", icon: CloudOff, key: "kids.everywhere.nav.offline" },
  { to: "/kids/everywhere/connection", icon: Wifi, key: "kids.everywhere.nav.connection" },
  { to: "/kids/everywhere/tv", icon: Tv, key: "kids.everywhere.nav.tv" },
  { to: "/kids/everywhere/accessibility", icon: Settings, key: "kids.everywhere.nav.accessibility" },
];

export default function EverywhereHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();
  const { online } = useConnection();
  const registered = useRef(false);

  useDocumentHead({ title: t("kids.everywhere.meta.title"), description: t("kids.everywhere.meta.description"), canonicalPath: "/kids/everywhere" });

  // Apply device modes, register this device, and flush any queued offline changes.
  useEffect(() => {
    hydrateModes();
    if (user && online && !registered.current) {
      registered.current = true;
      registerCurrentDevice().then(() => touchCurrentDevice()).catch(() => {});
      flush().catch(() => {});
    }
  }, [user, online]);

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <motion.div variants={slideUp(reduced)} className="flex flex-wrap items-start justify-between gap-3">
        <EverywhereHeader emoji="🌐" title={t("kids.everywhere.heroTitle")} subtitle={t("kids.everywhere.heroSubtitle")} backTo="/kids" backLabelKey="kids.nav.home" />
        <div className="mt-8"><ConnectionBadge /></div>
      </motion.div>

      <motion.nav variants={fadeIn(reduced)} aria-label={t("kids.everywhere.sections")} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to} className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-border bg-card p-5 text-center transition-transform hover:scale-[1.03] hover:border-kids-primary/50">
            <s.icon className="h-7 w-7 text-kids-primary" aria-hidden="true" />
            <span className="text-sm font-bold">{t(s.key)}</span>
          </Link>
        ))}
      </motion.nav>

      <motion.p variants={fadeIn(reduced)} className="mt-8 rounded-2xl border-2 border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t("kids.everywhere.pwaHint")}
      </motion.p>
    </motion.div>
  );
}
