import { Navigate, Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { getKidsSectionBySlug } from "@/features/visionkids/data/sections";

/**
 * Generic landing page for any /kids/:sectionSlug route. Renders the
 * section's identity (icon/title/description) plus a "coming soon" state —
 * this is the placeholder each of the 16 sections gets until its own
 * dedicated feature is built; swapping one in later is a route-level change,
 * not a restructure.
 */
export default function VisionKidsSection() {
  const { sectionSlug } = useParams<{ sectionSlug: string }>();
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const section = getKidsSectionBySlug(sectionSlug);

  useDocumentHead({
    title: section ? `${t(section.titleKey)} — VisionKids` : t("kids.meta.title"),
    description: section ? t(section.descKey) : t("kids.meta.description"),
    canonicalPath: `/kids/${sectionSlug ?? ""}`,
  });

  if (!section) return <Navigate to="/kids" replace />;

  const Icon = section.icon;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(reduced)}
      className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-16 text-center sm:py-24"
    >
      <motion.div
        variants={slideUp(reduced)}
        className="flex h-20 w-20 items-center justify-center rounded-3xl bg-kids-primary/10"
        aria-hidden="true"
      >
        <Icon className="h-10 w-10 text-kids-primary" strokeWidth={2} />
      </motion.div>

      <motion.h1 variants={slideUp(reduced)} className="font-heading text-3xl font-extrabold sm:text-4xl">
        <span aria-hidden="true">{section.emoji}</span> {t(section.titleKey)}
      </motion.h1>

      <motion.p variants={fadeIn(reduced)} className="text-lg text-muted-foreground">
        {t(section.descKey)}
      </motion.p>

      <motion.div
        variants={fadeIn(reduced)}
        className="rounded-2xl border-2 border-dashed border-border bg-card px-6 py-4 text-base font-medium text-muted-foreground"
        role="status"
      >
        {t("kids.section.comingSoon")}
      </motion.div>

      <motion.div variants={fadeIn(reduced)} className="flex gap-3 pt-2">
        <Button asChild variant="outline">
          <Link to="/kids">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("kids.section.backHome")}
          </Link>
        </Button>
        <Button asChild>
          <Link to="/">
            <Home className="h-4 w-4" aria-hidden="true" />
            {t("kids.nav.backToVisionex")}
          </Link>
        </Button>
      </motion.div>
    </motion.div>
  );
}
