import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { cardHover, cardTap } from "@/features/visionkids/utils/animations";
import { getGameCategoryIcon, isKidsColor } from "@/features/visionkids/data/gameCategoryIcons";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GameCategory } from "@/features/visionkids/types/games.types";

const COLOR_STYLES: Record<string, { iconBg: string; iconText: string; border: string }> = {
  primary: { iconBg: "bg-kids-primary/10", iconText: "text-kids-primary", border: "hover:border-kids-primary/60" },
  secondary: { iconBg: "bg-kids-secondary/10", iconText: "text-kids-secondary", border: "hover:border-kids-secondary/60" },
  accent: { iconBg: "bg-kids-accent/10", iconText: "text-kids-accent", border: "hover:border-kids-accent/60" },
  pink: { iconBg: "bg-kids-pink/10", iconText: "text-kids-pink", border: "hover:border-kids-pink/60" },
  green: { iconBg: "bg-kids-green/10", iconText: "text-kids-green", border: "hover:border-kids-green/60" },
  purple: { iconBg: "bg-kids-purple/10", iconText: "text-kids-purple", border: "hover:border-kids-purple/60" },
};

export function GameCategoryCard({ category }: { category: GameCategory }) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const Icon = getGameCategoryIcon(category.icon);
  const styles = COLOR_STYLES[isKidsColor(category.color) ? category.color : "primary"];

  return (
    <motion.div whileHover={cardHover(reduced)} whileTap={cardTap(reduced)}>
      <Link
        to={`/kids/games/category/${category.slug}`}
        className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-4 text-center transition-colors ${styles.border}`}
        aria-label={`${category.name} — ${category.game_count} ${t("kids.games.gamesCount")}`}
      >
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${styles.iconBg}`} aria-hidden="true">
          <Icon className={`h-6 w-6 ${styles.iconText}`} strokeWidth={2.25} />
        </div>
        <span className="text-sm font-bold text-foreground">{category.name}</span>
        <span className="text-xs text-muted-foreground">{category.game_count} {t("kids.games.gamesCount")}</span>
      </Link>
    </motion.div>
  );
}
