import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { staggerContainer } from "@/features/visionkids/utils/animations";
import { useStoryCategories } from "@/features/visionkids/hooks/stories/useStoryCatalog";
import { StoryCategoryCard } from "@/features/visionkids/components/stories/StoryCategoryCard";

export default function StoryCategories() {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const { data: categories = [], isLoading } = useStoryCategories();

  useDocumentHead({ title: t("kids.stories.categoriesTitle"), description: t("kids.stories.meta.description"), canonicalPath: "/kids/stories/categories" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-extrabold">{t("kids.stories.categoriesTitle")}</h1>
      <p className="mt-1 text-muted-foreground">{t("kids.stories.categoriesSubtitle")}</p>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer(reduced)}
          className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        >
          {categories.map((category) => (
            <StoryCategoryCard key={category.id} category={category} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
