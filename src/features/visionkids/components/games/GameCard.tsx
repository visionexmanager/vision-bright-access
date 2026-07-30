import { Link } from "react-router-dom";
import { Gamepad2, Heart, Clock, Users as UsersIcon, GitBranch } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { cardHover, cardTap } from "@/features/visionkids/utils/animations";
import { useIsGameFavorite, useToggleGameFavorite } from "@/features/visionkids/hooks/games/useGameEngagement";
import { RatingStars } from "@/features/visionkids/components/stories/RatingStars";
import type { Game } from "@/features/visionkids/types/games.types";

const COVER_GRADIENTS = ["from-kids-primary/30 to-kids-purple/30", "from-kids-pink/30 to-kids-accent/30", "from-kids-secondary/30 to-kids-green/30"];
function coverGradient(seed: string) {
  return COVER_GRADIENTS[seed.charCodeAt(0) % COVER_GRADIENTS.length];
}

export function GameCard({ game }: { game: Game }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();
  const { data: isFav } = useIsGameFavorite(user ? game.id : undefined);
  const toggleFav = useToggleGameFavorite(game.id);

  const handleFavClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    toggleFav.mutate(!isFav);
  };

  return (
    <motion.div whileHover={cardHover(reduced)} whileTap={cardTap(reduced)}>
      <Link
        to={`/kids/games/game/${game.slug}`}
        className="group block overflow-hidden rounded-2xl border-2 border-border bg-card transition-colors hover:border-kids-primary/50"
        aria-label={`${game.title}${game.description ? ` — ${game.description}` : ""}`}
      >
        <div className={`relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br ${coverGradient(game.title)}`}>
          {game.thumbnail_url ? (
            <img src={game.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Gamepad2 className="h-10 w-10 text-foreground/40" aria-hidden="true" />
          )}
          {!game.engine_key && (
            <span className="absolute inset-x-0 bottom-0 bg-background/90 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {t("kids.games.comingSoon")}
            </span>
          )}
          {game.is_multiplayer && (
            <span className="absolute start-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold text-kids-purple">
              <GitBranch className="h-3 w-3" aria-hidden="true" /> {t("kids.games.multiplayer")}
            </span>
          )}
          {user && (
            <button
              type="button"
              onClick={handleFavClick}
              aria-pressed={!!isFav}
              aria-label={isFav ? t("kids.stories.removeFavorite") : t("kids.stories.addFavorite")}
              className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Heart className={`h-4 w-4 ${isFav ? "fill-kids-pink text-kids-pink" : "text-muted-foreground"}`} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-1 font-heading text-sm font-bold text-foreground">{game.title}</h3>
          <div className="mt-2 flex items-center justify-between">
            <RatingStars value={game.rating_avg} size={12} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-1.5 py-0.5">{game.age_range}</span>
              <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" aria-hidden="true" /> {game.estimated_minutes}m</span>
            </div>
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <UsersIcon className="h-3 w-3" aria-hidden="true" /> {game.players_count.toLocaleString()} {t("kids.games.players")}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
