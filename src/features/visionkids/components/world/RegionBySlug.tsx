import { useLanguage } from "@/contexts/LanguageContext";
import { useRegion } from "@/features/visionkids/hooks/world/useWorldCatalog";
import { WorldHeader } from "@/features/visionkids/components/world/WorldHeader";
import { RegionPage } from "@/features/visionkids/components/world/RegionPage";

/** Renders the generic RegionPage for a given region slug, pulling the title /
 *  subtitle / emoji / color straight from the catalog. Both the district
 *  wrapper pages and the /kids/world/region/:slug route use this — so a new
 *  region is a catalog row with no per-region i18n or code. */
export function RegionBySlug({ slug }: { slug: string | undefined }) {
  const { t } = useLanguage();
  const { data: region, isLoading } = useRegion(slug);

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-10"><div className="h-96 animate-pulse rounded-3xl bg-muted" /></div>;
  if (!region) return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <WorldHeader emoji="🗺️" title={t("kids.world.notFound")} />
    </div>
  );

  const fromIslands = region.parent_slug === "adventure-islands";
  return (
    <RegionPage
      region={region.slug}
      emoji={region.emoji}
      title={region.title}
      subtitle={region.subtitle ?? undefined}
      canonicalPath={region.route ?? `/kids/world/region/${region.slug}`}
      color={region.color}
      backTo={fromIslands ? "/kids/world/adventure-islands" : "/kids/world"}
      backLabelKey={fromIslands ? "kids.world.nav.adventureIslands" : "kids.world.heroTitle"}
    />
  );
}
