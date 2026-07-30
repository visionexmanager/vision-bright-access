import { Link } from "react-router-dom";
import { Map, Stamp, CalendarDays, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useExplorerWorlds } from "@/features/visionkids/hooks/explorer/useExplorerWorlds";
import { WORLD_COLOR_CLASSES } from "@/features/visionkids/data/explorerWorlds";
import type { ExplorerWorld } from "@/features/visionkids/types/explorer.types";

function worldHref(world: ExplorerWorld): string {
  if (world.kind === "hub") return "/kids/explorer/virtual-world";
  if (world.kind === "simulator") return `/kids/explorer/${world.slug}`;
  return `/kids/explorer/world/${world.slug}`;
}

function WorldCard({ world }: { world: ExplorerWorld }) {
  return (
    <Link
      to={worldHref(world)}
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-transform hover:scale-[1.03] ${WORLD_COLOR_CLASSES[world.color]}`}
    >
      <span className="text-4xl" aria-hidden="true">{world.emoji}</span>
      <p className="font-heading text-sm font-bold">{world.title}</p>
    </Link>
  );
}

export default function ExplorerHome() {
  const { t } = useLanguage();
  const { data: worlds = [], isLoading } = useExplorerWorlds();

  useDocumentHead({ title: t("kids.explorer.meta.title"), description: t("kids.explorer.meta.description"), canonicalPath: "/kids/explorer" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">🧭 {t("kids.explorer.heroTitle")}</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{t("kids.explorer.heroSubtitle")}</p>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline" className="gap-1.5">
          <Link to="/kids/explorer/virtual-world"><Map className="h-4 w-4" aria-hidden="true" /> {t("kids.explorer.virtualWorldTitle")}</Link>
        </Button>
        <Button asChild variant="outline" className="gap-1.5">
          <Link to="/kids/explorer/passport"><Stamp className="h-4 w-4" aria-hidden="true" /> {t("kids.explorer.passportTitle")}</Link>
        </Button>
        <Button asChild variant="outline" className="gap-1.5">
          <Link to="/kids/games/daily-challenges"><CalendarDays className="h-4 w-4" aria-hidden="true" /> {t("kids.games.dailyChallenges")}</Link>
        </Button>
        <Button asChild variant="outline" className="gap-1.5">
          <Link to="/kids/games/weekly-challenges"><Trophy className="h-4 w-4" aria-hidden="true" /> {t("kids.games.weeklyChallenges")}</Link>
        </Button>
      </div>

      <h2 className="mt-10 font-heading text-xl font-bold">{t("kids.explorer.worldsTitle")}</h2>
      {isLoading ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-busy="true">
          {Array.from({ length: 14 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {worlds.map((w) => <WorldCard key={w.slug} world={w} />)}
        </div>
      )}
    </div>
  );
}
