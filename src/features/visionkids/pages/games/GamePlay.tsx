import { Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useGameBySlug } from "@/features/visionkids/hooks/games/useGameCatalog";
import { resolveGameComponent } from "@/features/visionkids/games/registry";

function PlayLoader() {
  return <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-busy="true" />;
}

export default function GamePlay() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { data: game, isLoading } = useGameBySlug(slug);

  useDocumentHead({ title: game ? `${game.title} — VisionKids` : t("kids.games.meta.title"), description: "", canonicalPath: `/kids/games/play/${slug}` });

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16"><PlayLoader /></div>;

  if (!game) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.games.notFound")}</p>
        <Link to="/kids/games" className="mt-2 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  const GameComponent = resolveGameComponent(game.engine_key);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link to={`/kids/games/game/${game.slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {game.title}
      </Link>
      <Suspense fallback={<PlayLoader />}>
        <GameComponent game={game} />
      </Suspense>
    </div>
  );
}
