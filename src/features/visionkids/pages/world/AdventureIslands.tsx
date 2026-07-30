import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useRegions } from "@/features/visionkids/hooks/world/useWorldCatalog";
import { useVisitedRegions } from "@/features/visionkids/hooks/world/useWorldProgress";
import { WORLD_COLOR_CLASSES } from "@/features/visionkids/data/worldConfig";
import { WorldHeader } from "@/features/visionkids/components/world/WorldHeader";

export default function AdventureIslands() {
  const { t } = useLanguage();
  const { data: regions = [], isLoading } = useRegions();
  const { data: visited = [] } = useVisitedRegions();

  useDocumentHead({
    title: `${t("kids.world.region.adventure-islands.title")} — VisionKids`,
    description: t("kids.world.adventureIslands.subtitle"),
    canonicalPath: "/kids/world/adventure-islands",
  });

  const islands = regions.filter((r) => r.parent_slug === "adventure-islands");
  const visitedSet = new Set(visited);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <WorldHeader emoji="🏝️" title={t("kids.world.region.adventure-islands.title")} subtitle={t("kids.world.adventureIslands.subtitle")} />

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {islands.map((r) => (
            <Link key={r.slug} to={`/kids/world/region/${r.slug}`}
              className={`relative flex flex-col gap-1 rounded-2xl border-2 p-4 transition-transform hover:scale-[1.03] ${WORLD_COLOR_CLASSES[r.color]}`}>
              {visitedSet.has(r.slug) && <span className="absolute end-2 top-2 text-xs" aria-label={t("kids.world.visited")}>✓</span>}
              <span className="text-3xl" aria-hidden="true">{r.emoji}</span>
              <span className="font-heading text-sm font-bold leading-tight">{r.title}</span>
              {r.subtitle && <span className="text-xs text-foreground/60">{r.subtitle}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
