import { Link } from "react-router-dom";
import { Heart, BookOpen, GitBranch, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { cardHover, cardTap } from "@/features/visionkids/utils/animations";
import { useIsFavorite, useToggleFavorite } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { RatingStars } from "@/features/visionkids/components/stories/RatingStars";
import type { Story } from "@/features/visionkids/types/stories.types";

const COVER_GRADIENTS = [
  "from-kids-primary/30 to-kids-purple/30",
  "from-kids-pink/30 to-kids-accent/30",
  "from-kids-secondary/30 to-kids-green/30",
];

function coverGradient(seed: string) {
  const idx = seed.charCodeAt(0) % COVER_GRADIENTS.length;
  return COVER_GRADIENTS[idx];
}

interface StoryCardProps {
  story: Story;
}

export function StoryCard({ story }: StoryCardProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();
  const { data: isFav } = useIsFavorite(user ? story.id : undefined);
  const toggleFav = useToggleFavorite(story.id);

  const handleFavClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    toggleFav.mutate(!isFav);
  };

  return (
    <motion.div whileHover={cardHover(reduced)} whileTap={cardTap(reduced)}>
      <Link
        to={`/kids/stories/story/${story.slug}`}
        className="group block overflow-hidden rounded-2xl border-2 border-border bg-card transition-colors hover:border-kids-primary/50"
        aria-label={`${story.title}${story.subtitle ? ` — ${story.subtitle}` : ""}`}
      >
        <div className={`relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br ${coverGradient(story.title)}`}>
          {story.cover_image_url ? (
            <img src={story.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <BookOpen className="h-10 w-10 text-foreground/40" aria-hidden="true" />
          )}
          {story.is_interactive && (
            <span className="absolute start-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold text-kids-purple">
              <GitBranch className="h-3 w-3" aria-hidden="true" /> {t("kids.stories.interactive")}
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
          <h3 className="line-clamp-1 font-heading text-sm font-bold text-foreground">{story.title}</h3>
          {story.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{story.subtitle}</p>}
          <div className="mt-2 flex items-center justify-between">
            <RatingStars value={story.rating_avg} size={12} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-1.5 py-0.5">{story.age_group}</span>
              {story.reading_time_minutes && (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" aria-hidden="true" /> {story.reading_time_minutes}m
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
