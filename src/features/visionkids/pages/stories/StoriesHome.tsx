import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Sparkles, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useStoryCategories, useFeaturedStories, useNewStories, useInteractiveStories } from "@/features/visionkids/hooks/stories/useStoryCatalog";
import { useContinueReading } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { useRecommendedStories } from "@/features/visionkids/hooks/stories/useStoryDiscovery";
import { StoryCategoryCard } from "@/features/visionkids/components/stories/StoryCategoryCard";
import { StoryRail } from "@/features/visionkids/components/stories/StoryRail";
import { StoryCard } from "@/features/visionkids/components/stories/StoryCard";

export default function StoriesHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  useDocumentHead({ title: t("kids.stories.meta.title"), description: t("kids.stories.meta.description"), canonicalPath: "/kids/stories" });

  const { data: categories = [] } = useStoryCategories();
  const { data: featured = [] } = useFeaturedStories(10);
  const { data: newStories = [] } = useNewStories(10);
  const { data: interactive = [] } = useInteractiveStories(8);
  const { data: recommended = [] } = useRecommendedStories(10);
  const { data: continueReading = [] } = useContinueReading();

  return (
    <div>
      <section className="kids-hero-gradient px-4 py-12 text-center sm:py-16">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto flex max-w-2xl flex-col items-center gap-4">
          <motion.h1 variants={slideUp(reduced)} className="font-heading text-3xl font-extrabold sm:text-4xl">
            📚 {t("kids.stories.heroTitle")}
          </motion.h1>
          <motion.p variants={fadeIn(reduced)} className="text-muted-foreground">{t("kids.stories.heroSubtitle")}</motion.p>
          <motion.div variants={slideUp(reduced)} className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-kids-primary to-kids-purple text-white hover:opacity-90">
              <Link to="/kids/stories/search"><Search className="h-4 w-4" aria-hidden="true" /> {t("kids.stories.searchCta")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/kids/stories/ai/create"><Sparkles className="h-4 w-4" aria-hidden="true" /> {t("kids.stories.aiCta")}</Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {user && continueReading.length > 0 && (
        <StoryRail
          title={t("kids.stories.continueReading")}
          stories={continueReading.map((p) => p.story!).filter(Boolean)}
          viewAllHref="/kids/stories/continue-reading"
          viewAllLabel={t("kids.stories.viewAll")}
        />
      )}

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <h2 className="mx-auto mb-4 max-w-6xl font-heading text-xl font-bold sm:text-2xl">{t("kids.stories.browseByCategory")}</h2>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {categories.map((category) => (
            <StoryCategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>

      <StoryRail title={t("kids.stories.recommendedForYou")} stories={recommended} viewAllHref="/kids/stories/recommended" viewAllLabel={t("kids.stories.viewAll")} />
      <StoryRail title={t("kids.stories.featured")} stories={featured} />
      <StoryRail title={t("kids.stories.newStories")} stories={newStories} />

      {interactive.length > 0 && (
        <section className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-1 flex items-center gap-2 font-heading text-xl font-bold sm:text-2xl">
              <GitBranch className="h-5 w-5 text-kids-purple" aria-hidden="true" /> {t("kids.stories.interactiveStories")}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">{t("kids.stories.interactiveStoriesDesc")}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {interactive.map((story) => <StoryCard key={story.id} story={story} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
