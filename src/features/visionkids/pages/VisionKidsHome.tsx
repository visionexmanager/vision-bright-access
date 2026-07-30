import { motion } from "framer-motion";
import { ArrowDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { FloatingIcons } from "@/features/visionkids/components/FloatingIcons";
import { SectionCard } from "@/features/visionkids/components/SectionCard";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { kidsSections } from "@/features/visionkids/data/sections";

export default function VisionKidsHome() {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();

  useDocumentHead({
    title: t("kids.meta.title"),
    description: t("kids.meta.description"),
    canonicalPath: "/kids",
  });

  return (
    <div>
      <section className="kids-hero-gradient relative overflow-hidden px-4 py-16 text-center sm:py-24">
        <FloatingIcons />
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer(reduced)}
          className="relative mx-auto flex max-w-3xl flex-col items-center gap-6"
        >
          <motion.h1
            variants={slideUp(reduced)}
            className="font-heading text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl"
          >
            <span aria-hidden="true">🌈</span> {t("kids.hero.title")}
          </motion.h1>

          <motion.p variants={fadeIn(reduced)} className="max-w-xl text-lg text-muted-foreground sm:text-xl">
            {t("kids.hero.subtitle")}
          </motion.p>

          <motion.div variants={slideUp(reduced)} className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-kids-primary to-kids-purple text-base font-bold text-white hover:opacity-90"
            >
              <a href="#kids-sections">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                {t("kids.hero.ctaStart")}
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base font-bold">
              <a href="#kids-sections">
                {t("kids.hero.ctaExplore")}
                <ArrowDown className="h-5 w-5" aria-hidden="true" />
              </a>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <section id="kids-sections" className="px-4 pb-20 pt-4 sm:px-6 lg:px-8" aria-label={t("kids.sections.title")}>
        <h2 className="mx-auto mb-6 max-w-6xl font-heading text-2xl font-bold sm:text-3xl">
          {t("kids.sections.title")}
        </h2>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer(reduced)}
          className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {kidsSections.map((section, i) => (
            <SectionCard key={section.id} section={section} index={i} />
          ))}
        </motion.div>
      </section>
    </div>
  );
}
