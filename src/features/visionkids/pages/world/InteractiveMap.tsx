import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { useRegions } from "@/features/visionkids/hooks/world/useWorldCatalog";
import { useWorldSettings, useVisitedRegions } from "@/features/visionkids/hooks/world/useWorldProgress";
import { WEATHER_BACKDROP } from "@/features/visionkids/data/worldConfig";
import { WorldHeader } from "@/features/visionkids/components/world/WorldHeader";
import type { WeatherKind } from "@/features/visionkids/types/world.types";

function resolveWeather(pref: WeatherKind | undefined): keyof typeof WEATHER_BACKDROP {
  if (!pref || pref === "auto") {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 6 ? "night" : "day";
  }
  return pref;
}

export default function InteractiveMap() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const reduced = useKidsReducedMotion();
  const { data: regions = [], isLoading } = useRegions();
  const { data: settings } = useWorldSettings();
  const { data: visited = [] } = useVisitedRegions();

  useDocumentHead({
    title: `${t("kids.world.nav.map")} — VisionKids`,
    description: t("kids.world.map.subtitle"),
    canonicalPath: "/kids/world/map",
  });

  const weather = resolveWeather(settings?.weather);
  const backdrop = WEATHER_BACKDROP[weather];
  const visitedSet = new Set(visited);
  // Islands are reached from the Adventure Islands hub, not placed on the world map.
  const pins = regions.filter((r) => r.kind !== "island");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <WorldHeader emoji="🗺️" title={t("kids.world.nav.map")} subtitle={t("kids.world.map.subtitle")} />

      {isLoading ? (
        <div className="mt-6 aspect-[16/10] w-full animate-pulse rounded-3xl bg-muted" aria-busy="true" />
      ) : (
        <div
          className={`relative mt-6 aspect-[16/10] w-full overflow-hidden rounded-3xl border-2 border-border bg-gradient-to-b ${backdrop.gradient}`}
          role="group"
          aria-label={t("kids.world.map.label")}
        >
          {backdrop.overlay && (
            <span className="pointer-events-none absolute right-4 top-4 text-4xl opacity-80" aria-hidden="true">{backdrop.overlay}</span>
          )}
          {pins.map((r) => {
            const isVisited = visitedSet.has(r.slug);
            return (
              <motion.button
                key={r.slug}
                type="button"
                onClick={() => navigate(r.route ?? `/kids/world/region/${r.slug}`)}
                initial={reduced ? undefined : { scale: 0 }}
                animate={reduced ? undefined : { scale: 1 }}
                whileHover={reduced ? undefined : { scale: 1.12 }}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-kids-primary"
                style={{ left: `${r.map_x}%`, top: `${r.map_y}%` }}
                aria-label={`${r.title}${isVisited ? " ✓" : ""}`}
              >
                <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-white/70 bg-card text-2xl shadow-md">{r.emoji}</span>
                <span className="max-w-[7rem] truncate rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-bold shadow-sm">
                  {isVisited && <span aria-hidden="true">✓ </span>}{r.title}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-center text-sm text-muted-foreground">{t("kids.world.map.hint")}</p>
    </div>
  );
}
