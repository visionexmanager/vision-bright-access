import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Trophy, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useGameCategories, useFeaturedGames, useNewGames } from "@/features/visionkids/hooks/games/useGameCatalog";
import { useRecentlyPlayed } from "@/features/visionkids/hooks/games/useGameEngagement";
import { useDailyChallenges } from "@/features/visionkids/hooks/games/useGameChallenges";
import { GameCategoryCard } from "@/features/visionkids/components/games/GameCategoryCard";
import { GameRail } from "@/features/visionkids/components/games/GameRail";
import { LevelBadge } from "@/features/visionkids/components/games/LevelBadge";

export default function GamesHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  useDocumentHead({ title: t("kids.games.meta.title"), description: t("kids.games.meta.description"), canonicalPath: "/kids/games" });

  const { data: categories = [] } = useGameCategories();
  const { data: featured = [] } = useFeaturedGames(10);
  const { data: newGames = [] } = useNewGames(10);
  const { data: recentlyPlayed = [] } = useRecentlyPlayed(10);
  const { data: dailyChallenges = [] } = useDailyChallenges();
  const completedToday = dailyChallenges.filter((c) => c.progress?.completed_at).length;

  return (
    <div>
      <section className="kids-hero-gradient px-4 py-12 text-center sm:py-16">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto flex max-w-2xl flex-col items-center gap-4">
          <motion.h1 variants={slideUp(reduced)} className="font-heading text-3xl font-extrabold sm:text-4xl">
            🎮 {t("kids.games.heroTitle")}
          </motion.h1>
          <motion.p variants={fadeIn(reduced)} className="text-muted-foreground">{t("kids.games.heroSubtitle")}</motion.p>

          {user && (
            <motion.div variants={slideUp(reduced)} className="w-full max-w-xs">
              <LevelBadge />
            </motion.div>
          )}

          <motion.div variants={slideUp(reduced)} className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-kids-primary to-kids-purple text-white hover:opacity-90">
              <Link to="/kids/games/search"><Search className="h-4 w-4" aria-hidden="true" /> {t("kids.games.findGame")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/kids/games/daily-challenges">
                <Trophy className="h-4 w-4" aria-hidden="true" /> {t("kids.games.dailyChallenges")} {dailyChallenges.length > 0 && `(${completedToday}/${dailyChallenges.length})`}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/kids/games/multiplayer"><Swords className="h-4 w-4" aria-hidden="true" /> {t("kids.games.multiplayerLobby")}</Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {user && recentlyPlayed.length > 0 && (
        <GameRail
          title={t("kids.games.recentlyPlayed")}
          games={recentlyPlayed.map((s) => s.game!).filter(Boolean)}
          viewAllHref="/kids/games/recently-played"
          viewAllLabel={t("kids.stories.viewAll")}
        />
      )}

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <h2 className="mx-auto mb-4 max-w-6xl font-heading text-xl font-bold sm:text-2xl">{t("kids.games.browseByCategory")}</h2>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {categories.map((category) => (
            <GameCategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>

      <GameRail title={t("kids.games.featured")} games={featured} />
      <GameRail title={t("kids.games.newGames")} games={newGames} />
    </div>
  );
}
