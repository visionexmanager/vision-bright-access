import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { staggerContainer } from "@/features/visionkids/utils/animations";
import { useGameCategories } from "@/features/visionkids/hooks/games/useGameCatalog";
import { GameCategoryCard } from "@/features/visionkids/components/games/GameCategoryCard";

export default function GameCategories() {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const { data: categories = [], isLoading } = useGameCategories();

  useDocumentHead({ title: t("kids.games.categoriesTitle"), description: t("kids.games.meta.description"), canonicalPath: "/kids/games/categories" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-extrabold">{t("kids.games.categoriesTitle")}</h1>
      <p className="mt-1 text-muted-foreground">{t("kids.games.categoriesSubtitle")}</p>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-busy="true">
          {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {categories.map((category) => (
            <GameCategoryCard key={category.id} category={category} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
