import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Images, Trophy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { STUDIO_TOOLS } from "@/features/visionkids/data/studioTools";
import { ToolCard } from "@/features/visionkids/components/studio/ToolCard";
import { useMyProjects } from "@/features/visionkids/hooks/studio/useStudioProjects";
import { useThisWeeksChallenges } from "@/features/visionkids/hooks/studio/useStudioChallenges";
import { ProjectCard } from "@/features/visionkids/components/studio/ProjectCard";

export default function StudioHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  useDocumentHead({ title: t("kids.studio.meta.title"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio" });

  const { data: myProjects = [] } = useMyProjects();
  const { data: challenges = [] } = useThisWeeksChallenges();

  return (
    <div>
      <section className="kids-hero-gradient px-4 py-12 text-center sm:py-16">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto flex max-w-2xl flex-col items-center gap-4">
          <motion.h1 variants={slideUp(reduced)} className="font-heading text-3xl font-extrabold sm:text-4xl">
            🎨 {t("kids.studio.heroTitle")}
          </motion.h1>
          <motion.p variants={fadeIn(reduced)} className="text-muted-foreground">{t("kids.studio.heroSubtitle")}</motion.p>
          <motion.div variants={slideUp(reduced)} className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-kids-primary to-kids-purple text-white hover:opacity-90">
              <Link to="/kids/studio/my-projects"><Images className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.myProjectsTitle")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/kids/studio/challenges"><Trophy className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.challengesTitle")} {challenges.length > 0 && `(${challenges.length})`}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/kids/studio/gallery"><Sparkles className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.galleryTitle")}</Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <h2 className="mx-auto mb-4 max-w-6xl font-heading text-xl font-bold sm:text-2xl">{t("kids.studio.toolsTitle")}</h2>
        <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {STUDIO_TOOLS.map((tool) => <ToolCard key={tool.type} tool={tool} />)}
        </motion.div>
      </section>

      {user && myProjects.length > 0 && (
        <section className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold">{t("kids.studio.recentProjects")}</h2>
              <Link to="/kids/studio/my-projects" className="text-sm font-semibold text-kids-primary hover:underline">{t("kids.stories.viewAll")}</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {myProjects.slice(0, 5).map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
