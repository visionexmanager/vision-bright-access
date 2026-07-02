import { Globe, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { useComingSoon } from "@/components/career/useComingSoon";
import { POPULAR_COUNTRIES } from "./mockLocations";

export function PopularLocations() {
  const { t } = useLanguage();
  const handleComingSoon = useComingSoon();
  const topCities = POPULAR_COUNTRIES.flatMap((country) =>
    country.cities.map((city) => ({ ...city, countryName: country.name }))
  ).sort((a, b) => b.jobCount - a.jobCount);

  return (
    <div>
      <h2 className="type-heading mb-6">{t("careersPage.locations.title")}</h2>

      <StaggerGrid className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {POPULAR_COUNTRIES.map((country) => (
          <StaggerItem key={country.id}>
            <button
              type="button"
              onClick={handleComingSoon}
              className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-4 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Globe className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{country.name}</span>
                <span className="block text-xs text-muted-foreground">{country.jobCount.toLocaleString()} {t("careersPage.category.jobsSuffix")}</span>
              </span>
            </button>
          </StaggerItem>
        ))}
      </StaggerGrid>

      <p className="mb-3 text-sm font-medium text-muted-foreground">{t("careersPage.locations.popularCities")}</p>
      <div className="flex flex-wrap gap-2">
        {topCities.map((city) => (
          <button
            key={city.id}
            type="button"
            onClick={handleComingSoon}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            {city.name}, {city.countryName}
            <span className="text-xs text-muted-foreground">({city.jobCount.toLocaleString()})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
