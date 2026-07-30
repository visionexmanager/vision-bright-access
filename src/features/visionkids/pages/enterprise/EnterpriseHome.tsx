import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, ShieldCheck, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { ORG_KINDS } from "@/features/visionkids/data/enterpriseConfig";

const HIGHLIGHTS = [
  { icon: Building2, key: "multitenant" },
  { icon: ShieldCheck, key: "isolation" },
  { icon: Users, key: "scale" },
];

export default function EnterpriseHome() {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();

  useDocumentHead({
    title: t("kids.enterprise.meta.title"),
    description: t("kids.enterprise.meta.description"),
    canonicalPath: "/kids/enterprise",
  });

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)}
      className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <motion.section variants={slideUp(reduced)} className="text-center">
        <h1 className="font-heading text-4xl font-extrabold sm:text-5xl">
          <span aria-hidden="true">🏫</span> {t("kids.enterprise.heroTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">{t("kids.enterprise.heroSubtitle")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/kids/enterprise/schools" className="rounded-full bg-gradient-to-r from-kids-primary to-kids-secondary px-5 py-2.5 font-bold text-white hover:opacity-90">
            {t("kids.enterprise.openPortal")}
          </Link>
          <Link to="/kids/enterprise/verify" className="rounded-full border-2 border-border px-5 py-2.5 font-bold hover:border-kids-primary/50">
            {t("kids.enterprise.verifyCertificate")}
          </Link>
        </div>
      </motion.section>

      <motion.div variants={fadeIn(reduced)} className="mt-10 grid gap-3 sm:grid-cols-3">
        {HIGHLIGHTS.map(({ icon: Icon, key }) => (
          <div key={key} className="rounded-2xl border-2 border-border bg-card p-5 text-center">
            <Icon className="mx-auto h-8 w-8 text-kids-primary" aria-hidden="true" />
            <p className="mt-2 font-heading font-bold">{t(`kids.enterprise.highlight.${key}.title`)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t(`kids.enterprise.highlight.${key}.desc`)}</p>
          </div>
        ))}
      </motion.div>

      <motion.section variants={fadeIn(reduced)} className="mt-10">
        <h2 className="text-center font-heading text-xl font-bold">{t("kids.enterprise.whoFor")}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {ORG_KINDS.map((k) => (
            <div key={k.kind} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-4 text-center">
              <span className="text-3xl" aria-hidden="true">{k.emoji}</span>
              <span className="text-sm font-semibold">{t(k.labelKey)}</span>
            </div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
