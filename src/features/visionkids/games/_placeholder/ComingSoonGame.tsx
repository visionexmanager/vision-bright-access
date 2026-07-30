import { Link } from "react-router-dom";
import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Game } from "@/features/visionkids/types/games.types";

/** Rendered by the registry for any game whose engine_key isn't implemented
 *  yet (kids_games.engine_key IS NULL) — same pattern as VisionKidsSection
 *  did for the 16 home sections in Phase 1. Fully participates in
 *  navigation/details/categories; only the play screen is a placeholder. */
export function ComingSoonGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
      <Hammer className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h2 className="font-heading text-xl font-bold">{game.title}</h2>
      <p className="text-muted-foreground">{t("kids.games.comingSoonDesc")}</p>
      <Button asChild variant="outline">
        <Link to="/kids/games">{t("kids.games.moreGames")}</Link>
      </Button>
    </div>
  );
}

export default ComingSoonGame;
