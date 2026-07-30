import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useExplorerWorld, useLocationsByWorld } from "@/features/visionkids/hooks/explorer/useExplorerWorlds";
import { useStampWorld } from "@/features/visionkids/hooks/explorer/useExplorerPassport";
import { CONTENT_WORLD_CONFIG } from "@/features/visionkids/data/explorerWorlds";
import { LocationCard } from "@/features/visionkids/components/explorer/LocationCard";
import { useAuth } from "@/contexts/AuthContext";

/** Generic list page shared by all 9 "browse and learn" worlds — driven
 *  entirely by CONTENT_WORLD_CONFIG[worldSlug] (category tabs) and the
 *  kids_explorer_locations rows for that world_slug. Adding a 10th content
 *  world means a DB row + a config entry, never a new page. */
export default function WorldListPage() {
  const { worldSlug } = useParams<{ worldSlug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [category, setCategory] = useState("all");

  const { data: world, isLoading: worldLoading } = useExplorerWorld(worldSlug);
  const { data: locations = [], isLoading } = useLocationsByWorld(worldSlug, category);
  const stampWorld = useStampWorld();

  const config = worldSlug ? CONTENT_WORLD_CONFIG[worldSlug] : undefined;

  useDocumentHead({
    title: world ? `${world.title} — VisionKids Explorer` : t("kids.explorer.meta.title"),
    description: world?.description ?? t("kids.explorer.meta.description"),
    canonicalPath: `/kids/explorer/world/${worldSlug}`,
  });

  useEffect(() => {
    if (user && worldSlug) stampWorld.mutate(worldSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, worldSlug]);

  if (worldLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-16" aria-busy="true"><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div>;
  }

  if (!world) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.explorer.worldNotFound")}</p>
        <Link to="/kids/explorer" className="mt-4 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/kids/explorer" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.explorer.homeTitle")}
      </Link>

      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <span aria-hidden="true">{world.emoji}</span> {world.title}
      </h1>
      {world.description && <p className="mt-1 text-muted-foreground">{world.description}</p>}

      {config && config.categories.length > 1 && (
        <Tabs value={category} onValueChange={setCategory} className="mt-6">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {config.categories.map((c) => (
              <TabsTrigger key={c.value} value={c.value} className="rounded-full border-2 border-border data-[state=active]:border-kids-primary data-[state=active]:bg-kids-primary/10">
                {t(c.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : locations.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.explorer.noLocations")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {locations.map((loc) => <LocationCard key={loc.id} worldSlug={world.slug} location={loc} />)}
        </div>
      )}
    </div>
  );
}
