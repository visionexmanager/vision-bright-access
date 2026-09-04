import { Link } from "react-router-dom";
import { Gamepad2, Play, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ArcadeGame } from "./catalog";
import { localizeGame } from "./catalog";
import { categoryLabel, difficultyLabel } from "./labels";
import { ArcadeVisual } from "./visual/ArcadeVisual";
import { visualForGame } from "./visual/visualRegistry";

export function ArcadeGameCard({ game, lang, priority = false }: { game: ArcadeGame; lang: string; priority?: boolean }) {
  const { t } = useLanguage();
  const copy = localizeGame(game, lang, t);
  return (
    <article className="arcade-game-card group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e1224] shadow-[0_16px_48px_rgba(0,0,0,.28)] transition duration-300 hover:-translate-y-1 hover:border-violet-400/60 focus-within:ring-2 focus-within:ring-violet-300">
      <div className="relative aspect-video overflow-hidden bg-slate-900">
        <ArcadeVisual asset={visualForGame(game, "thumbnail")} className="arcade-game-card__image h-full w-full object-cover transition duration-500 group-hover:scale-105" width={800} height={450} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1224] via-transparent to-black/10" aria-hidden="true" />
        <Badge className="absolute start-3 top-3 border-white/15 bg-black/65 text-white backdrop-blur">{categoryLabel(t, game.categories[0])}</Badge>
        <div className="absolute end-3 top-3 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-xs font-semibold text-amber-300 backdrop-blur" aria-label={game.rating ? t("arcade.card.rated").replace("{rating}", String(game.rating)) : t("arcade.card.notRated")}><Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />{game.rating || t("arcade.card.new")}</div>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <h3 className="line-clamp-1 text-lg font-bold text-white">{copy.title}</h3>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-300">{copy.description}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-xs text-slate-300">
          <div><dt className="sr-only">{t("games.difficulty.select")}</dt><dd>{difficultyLabel(t, game.difficulty)}</dd></div>
          <div><dt className="sr-only">{t("games.stat.players")}</dt><dd className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{game.players}</dd></div>
          <div><dt className="sr-only">{t("games.stat.plays")}</dt><dd className="flex items-center justify-end gap-1"><Gamepad2 className="h-3.5 w-3.5" aria-hidden="true" />{game.plays ? new Intl.NumberFormat(lang, { notation:"compact" }).format(game.plays) : "—"}</dd></div>
        </dl>
        <Button asChild className="arcade-pressable w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-950/40 hover:from-violet-500 hover:to-indigo-500">
          {/* Both of these were English everywhere: the label an en/ar ternary,
              the aria-label a template. On a card that repeats a hundred and
              sixteen times, that is the most-heard string on the page. */}
          <Link to={game.to} aria-label={t("arcade.card.playAria").replace("{game}", copy.title)}><Play className="me-2 h-4 w-4 fill-current" aria-hidden="true" />{t("arcade.card.play")}</Link>
        </Button>
      </div>
    </article>
  );
}
