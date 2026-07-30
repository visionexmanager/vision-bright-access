import { Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { staggerContainer } from "@/features/visionkids/utils/animations";
import { useAllAchievements, useMyAchievements } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { AchievementBadge } from "@/features/visionkids/components/games/AchievementBadge";

export default function Achievements() {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const { data: all = [], isLoading } = useAllAchievements();
  const { data: earned = [] } = useMyAchievements();

  useDocumentHead({ title: t("kids.games.achievementsTitle"), description: t("kids.games.meta.description"), canonicalPath: "/kids/games/achievements" });

  const earnedMap = new Map(earned.map((e) => [e.achievement_id, e.earned_at]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Trophy className="h-7 w-7 text-kids-accent" aria-hidden="true" /> {t("kids.games.achievementsTitle")}
      </h1>
      <p className="mt-1 text-muted-foreground">{earned.length} / {all.length} {t("kids.games.unlocked")}</p>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {all.map((achievement) => (
            <AchievementBadge key={achievement.id} achievement={achievement} earned={earnedMap.has(achievement.id)} earnedAt={earnedMap.get(achievement.id)} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
