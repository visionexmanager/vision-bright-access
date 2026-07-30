import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCities, useMyCityVisits } from "@/features/visionkids/hooks/events/useUniverse";

const COLOR_CLASSES: Record<string, string> = {
  primary: "border-kids-primary/30 bg-kids-primary/10 text-kids-primary",
  secondary: "border-kids-secondary/30 bg-kids-secondary/10 text-kids-secondary",
  accent: "border-kids-accent/30 bg-kids-accent/10 text-kids-accent",
  pink: "border-kids-pink/30 bg-kids-pink/10 text-kids-pink",
  green: "border-kids-green/30 bg-kids-green/10 text-kids-green",
  purple: "border-kids-purple/30 bg-kids-purple/10 text-kids-purple",
};

/** Same winding-path "level map" pattern as Explorer's Virtual World
 *  (Phase 6) — node positions are computed from the city count so adding
 *  a 9th city later just extends the path. */
export default function UniverseMap() {
  const { t } = useLanguage();
  const { data: cities = [], isLoading } = useCities();
  const { data: visits = [] } = useMyCityVisits();
  const visitedSlugs = new Set(visits.map((v) => v.city_slug));

  const n = cities.length;

  useDocumentHead({ title: `${t("kids.universe.title")} — VisionKids`, description: t("kids.universe.meta.description"), canonicalPath: "/kids/universe" });

  const points = cities.map((_, i) => ({
    x: i % 2 === 0 ? 22 : 78,
    y: n > 1 ? ((i + 0.5) / n) * 100 : 50,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/kids/events" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.events.heroTitle")}
      </Link>

      <h1 className="font-heading text-3xl font-extrabold">🗺️ {t("kids.universe.title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("kids.universe.subtitle")}</p>

      {isLoading ? (
        <div className="mt-8 h-96 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
      ) : (
        <div className="relative mt-8" style={{ height: `${Math.max(n, 1) * 130}px` }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <path d={pathD} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 3" className="text-border" />
          </svg>

          <ol className="contents">
            {cities.map((city, i) => {
              const visited = visitedSlugs.has(city.slug);
              return (
                <li key={city.slug} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${points[i].x}%`, top: `${points[i].y}%` }}>
                  <Link
                    to={`/kids/universe/${city.slug}`}
                    className={`flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-full border-2 text-center shadow-sm transition-transform hover:scale-105 ${COLOR_CLASSES[city.color]}`}
                  >
                    <span className="text-2xl" aria-hidden="true">{city.emoji}</span>
                    {visited && <span aria-hidden="true">✅</span>}
                  </Link>
                  <p className="mt-1 text-center text-xs font-semibold">{city.name}</p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
