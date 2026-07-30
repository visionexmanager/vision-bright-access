import { Link } from "react-router-dom";
import { Heart, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useGameFavorites, useRecentlyPlayed } from "@/features/visionkids/hooks/games/useGameEngagement";
import { GameCard } from "@/features/visionkids/components/games/GameCard";
import type { Game } from "@/features/visionkids/types/games.types";

export type GameListKind = "favorites" | "recently-played";

const ICONS = { favorites: Heart, "recently-played": Clock };

export function GameUserListPage({ kind }: { kind: GameListKind }) {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const favorites = useGameFavorites();
  const recentlyPlayed = useRecentlyPlayed(48);

  const titleKey = `kids.games.list.${kind}.title`;
  const emptyKey = `kids.games.list.${kind}.empty`;
  const Icon = ICONS[kind];

  useDocumentHead({ title: t(titleKey), description: t("kids.games.meta.description"), canonicalPath: `/kids/games/${kind}` });

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Icon className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  const games: Game[] =
    kind === "favorites"
      ? ((favorites.data ?? []).map((f) => f.game).filter(Boolean) as Game[])
      : ((recentlyPlayed.data ?? []).map((s) => s.game).filter(Boolean) as Game[]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-2xl font-extrabold">
        <Icon className="h-6 w-6 text-kids-primary" aria-hidden="true" /> {t(titleKey)}
      </h1>
      <div className="mt-6">
        {games.length === 0 ? (
          <p className="text-center text-muted-foreground">{t(emptyKey)}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {games.map((g) => <GameCard key={g.id} game={g} />)}
          </div>
        )}
      </div>
    </div>
  );
}
