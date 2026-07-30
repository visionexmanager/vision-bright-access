import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Gamepad2, Heart, Clock, Users, Play, GitBranch, Accessibility as AccessibilityIcon, Sparkles, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useGameBySlug } from "@/features/visionkids/hooks/games/useGameCatalog";
import { useIsGameFavorite, useToggleGameFavorite, useMyGameRating, useRateGame } from "@/features/visionkids/hooks/games/useGameEngagement";
import { RatingStars } from "@/features/visionkids/components/stories/RatingStars";

export default function GameDetails() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  const { data: game, isLoading } = useGameBySlug(slug);
  const { data: isFav } = useIsGameFavorite(user ? game?.id : undefined);
  const toggleFav = useToggleGameFavorite(game?.id ?? "");
  const { data: myRating } = useMyGameRating(game?.id);
  const rateGame = useRateGame(game?.id ?? "");
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  useDocumentHead({
    title: game ? `${game.title} — VisionKids` : t("kids.games.meta.title"),
    description: game?.description ?? t("kids.games.meta.description"),
    canonicalPath: `/kids/games/game/${slug}`,
  });

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!game) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.games.notFound")}</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/kids/games">{t("kids.section.backHome")}</Link></Button>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div variants={slideUp(reduced)} className="flex flex-col gap-6 sm:flex-row">
        <div className="flex aspect-[4/3] w-full shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-kids-primary/30 to-kids-purple/30 sm:w-56">
          {game.thumbnail_url ? <img src={game.thumbnail_url} alt="" className="h-full w-full rounded-2xl object-cover" /> : <Gamepad2 className="h-16 w-16 text-foreground/40" aria-hidden="true" />}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{game.age_range}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold capitalize">{game.difficulty}</span>
            {game.is_multiplayer && (
              <span className="flex items-center gap-1 rounded-full bg-kids-purple/10 px-2 py-0.5 text-xs font-semibold text-kids-purple">
                <GitBranch className="h-3 w-3" aria-hidden="true" /> {t("kids.games.multiplayer")}
              </span>
            )}
          </div>

          <h1 className="mt-2 font-heading text-2xl font-extrabold sm:text-3xl">{game.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" /> {game.estimated_minutes}m</span>
            <span className="flex items-center gap-1"><Users className="h-4 w-4" aria-hidden="true" /> {game.players_count.toLocaleString()} {t("kids.games.players")}</span>
          </div>

          <div className="mt-3"><RatingStars value={game.rating_avg} count={game.rating_count} /></div>

          <div className="mt-4 flex items-center gap-4 text-sm font-semibold">
            <span className="flex items-center gap-1 text-kids-accent"><Sparkles className="h-4 w-4" aria-hidden="true" /> {game.xp_reward} XP</span>
            <span className="flex items-center gap-1 text-kids-secondary"><Coins className="h-4 w-4" aria-hidden="true" /> {game.coins_reward} {t("kids.games.coins")}</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
              <Link to={`/kids/games/play/${game.slug}`}><Play className="h-4 w-4" aria-hidden="true" /> {t("kids.games.play")}</Link>
            </Button>
            {user && (
              <Button variant="outline" size="icon" onClick={() => toggleFav.mutate(!isFav)} aria-pressed={!!isFav} aria-label={isFav ? t("kids.stories.removeFavorite") : t("kids.stories.addFavorite")}>
                <Heart className={isFav ? "h-4 w-4 fill-kids-pink text-kids-pink" : "h-4 w-4"} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {game.description && <motion.p variants={fadeIn(reduced)} className="mt-6 leading-relaxed text-foreground">{game.description}</motion.p>}

      {game.gallery.length > 0 && (
        <motion.div variants={fadeIn(reduced)} className="mt-6">
          <h2 className="mb-2 font-heading text-lg font-bold">{t("kids.stories.gallery")}</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {game.gallery.map((src, i) => <img key={i} src={src} alt="" className="h-28 w-28 shrink-0 rounded-xl object-cover" loading="lazy" />)}
          </div>
        </motion.div>
      )}

      {game.accessibility_features.length > 0 && (
        <motion.div variants={fadeIn(reduced)} className="mt-6 rounded-xl bg-kids-green/10 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-bold text-kids-green">
            <AccessibilityIcon className="h-4 w-4" aria-hidden="true" /> {t("kids.stories.accessibilityFeatures")}
          </h2>
          <ul className="flex flex-wrap gap-2 text-xs text-foreground">
            {game.accessibility_features.map((f) => <li key={f} className="rounded-full bg-background px-2 py-1">{f.replace(/_/g, " ")}</li>)}
          </ul>
        </motion.div>
      )}

      {user && (
        <motion.div variants={fadeIn(reduced)} className="mt-6 rounded-2xl border-2 border-border p-4">
          <p className="font-heading font-bold">{t("kids.games.rateThisGame")}</p>
          <div className="mt-2" onMouseLeave={() => setHoverRating(null)}>
            <RatingStars value={hoverRating ?? myRating?.rating ?? 0} onChange={(v) => rateGame.mutate(v)} size={24} />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
