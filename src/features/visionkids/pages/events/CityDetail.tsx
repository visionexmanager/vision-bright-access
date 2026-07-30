import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Users, Calendar, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCityBySlug, useCharacters, useVisitCity } from "@/features/visionkids/hooks/events/useUniverse";
import { useEvents } from "@/features/visionkids/hooks/events/useEvents";
import { CITY_EVENT_CATEGORIES, CITY_CROSS_LINK } from "@/features/visionkids/data/universeCities";
import { EventCard } from "@/features/visionkids/components/events/EventCard";
import { StampBanner } from "@/features/visionkids/components/explorer/StampBanner";

export default function CityDetail() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: city, isLoading } = useCityBySlug(citySlug);
  const { data: characters = [] } = useCharacters(citySlug);
  const visitCity = useVisitCity();

  const categories = citySlug ? CITY_EVENT_CATEGORIES[citySlug] ?? [] : [];
  const { data: liveEvents = [] } = useEvents("live", categories[0] ? { category: categories[0] } : {});
  const { data: workshops = [] } = useEvents("workshop", categories[0] ? { category: categories[0] } : {});
  const { data: competitions = [] } = useEvents("competition", categories[0] ? { category: categories[0] } : {});
  const cityEvents = categories.length > 0 ? [...liveEvents, ...workshops, ...competitions].filter((e) => categories.includes(e.category)) : [];
  const crossLink = citySlug ? CITY_CROSS_LINK[citySlug] : undefined;

  useDocumentHead({
    title: city ? `${city.name} — VisionKids Universe` : t("kids.universe.title"),
    description: city?.description ?? t("kids.universe.meta.description"),
    canonicalPath: `/kids/universe/${citySlug}`,
  });

  useEffect(() => {
    if (user && citySlug) visitCity.mutate(citySlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, citySlug]);

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!city) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.universe.cityNotFound")}</p>
        <Link to="/kids/universe" className="mt-4 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/kids/universe" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.universe.title")}
      </Link>

      <StampBanner show={!!visitCity.data} />

      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold"><span aria-hidden="true">{city.emoji}</span> {city.name}</h1>
      {city.description && <p className="mt-1 text-muted-foreground">{city.description}</p>}

      <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><Users className="h-5 w-5" aria-hidden="true" /> {t("kids.universe.characters")}</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {characters.map((c) => (
          <div key={c.id} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-3 text-center">
            <span className="text-3xl" aria-hidden="true">{c.emoji}</span>
            <p className="text-sm font-semibold">{c.name}</p>
            {c.bio && <p className="text-xs text-muted-foreground">{c.bio}</p>}
          </div>
        ))}
      </div>

      <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><Calendar className="h-5 w-5" aria-hidden="true" /> {t("kids.universe.eventsHere")}</h2>
      {cityEvents.length > 0 ? (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cityEvents.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("kids.universe.noEventsHere")}</p>
      )}

      {crossLink && (
        <Link to={crossLink.href} className="mt-4 flex items-center justify-between rounded-2xl border-2 border-kids-primary/40 bg-kids-primary/10 p-4">
          <span className="font-semibold text-kids-primary">{t(crossLink.labelKey)}</span>
          <ExternalLink className="h-4 w-4 text-kids-primary" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
