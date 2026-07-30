import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useEvents } from "@/features/visionkids/hooks/events/useEvents";
import { EventCard } from "@/features/visionkids/components/events/EventCard";
import type { EventType } from "@/features/visionkids/types/events.types";

interface ListConfig {
  eventType: EventType;
  titleKey: string;
  emoji: string;
  categories: string[];
}

const CONFIGS: Record<string, ListConfig> = {
  live: { eventType: "live", titleKey: "kids.events.nav.liveEvents", emoji: "📡", categories: [] },
  workshops: {
    eventType: "workshop", titleKey: "kids.events.nav.workshops", emoji: "🎓",
    categories: ["drawing", "coding", "robotics", "science", "music", "stories", "english", "ai", "mental_math"],
  },
  competitions: {
    eventType: "competition", titleKey: "kids.events.nav.competitions", emoji: "🏆",
    categories: ["reading", "drawing", "coding", "math", "puzzles", "science", "music", "stories"],
  },
  seasonal: {
    eventType: "seasonal", titleKey: "kids.events.nav.seasonal", emoji: "✨",
    categories: ["ramadan", "eid", "summer", "back_to_school", "spring", "child_day", "book_day", "environment_day"],
  },
};

/** Generic event-list page shared by Live Events, Workshops, Competitions,
 *  and Seasonal Events — driven by the :listType URL param, same "one
 *  page + a config lookup" discipline as Explorer's WorldListPage
 *  (Phase 6) and Social's ClubListPage (Phase 7). */
export default function EventListPage() {
  const { listType } = useParams<{ listType: string }>();
  const { t } = useLanguage();
  const config = listType ? CONFIGS[listType] : undefined;
  const [category, setCategory] = useState("all");

  const { data: eventsList = [], isLoading } = useEvents(config?.eventType, { category: category === "all" ? undefined : category });

  useDocumentHead({
    title: config ? `${t(config.titleKey)} — VisionKids` : t("kids.events.meta.title"),
    description: t("kids.events.meta.description"),
    canonicalPath: `/kids/events/${listType}`,
  });

  if (!config) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.events.notFound")}</p>
        <Link to="/kids/events" className="mt-4 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link to="/kids/events" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.events.heroTitle")}
      </Link>

      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <span aria-hidden="true">{config.emoji}</span> {t(config.titleKey)}
      </h1>

      {config.categories.length > 0 && (
        <Tabs value={category} onValueChange={setCategory} className="mt-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="all" className="rounded-full border-2 border-border data-[state=active]:border-kids-primary data-[state=active]:bg-kids-primary/10">{t("kids.explorer.categoryAll")}</TabsTrigger>
            {config.categories.map((c) => (
              <TabsTrigger key={c} value={c} className="rounded-full border-2 border-border data-[state=active]:border-kids-primary data-[state=active]:bg-kids-primary/10">
                {t(`kids.events.category.${c}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : eventsList.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.events.noneFound")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {eventsList.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
