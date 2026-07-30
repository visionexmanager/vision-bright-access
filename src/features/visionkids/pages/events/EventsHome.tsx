import { Link } from "react-router-dom";
import { Radio, GraduationCap, Trophy, Sparkles, CalendarDays, Award, PlayCircle, Bell, ListChecks, Globe2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useUpcomingEvents } from "@/features/visionkids/hooks/events/useEvents";
import { EventCard } from "@/features/visionkids/components/events/EventCard";

const LINKS = [
  { to: "/kids/events/live", icon: Radio, color: "text-kids-pink", labelKey: "kids.events.nav.liveEvents" },
  { to: "/kids/events/workshops", icon: GraduationCap, color: "text-kids-secondary", labelKey: "kids.events.nav.workshops" },
  { to: "/kids/events/competitions", icon: Trophy, color: "text-kids-accent", labelKey: "kids.events.nav.competitions" },
  { to: "/kids/events/seasonal", icon: Sparkles, color: "text-kids-purple", labelKey: "kids.events.nav.seasonal" },
  { to: "/kids/events/calendar", icon: CalendarDays, color: "text-kids-primary", labelKey: "kids.events.nav.calendar" },
  { to: "/kids/events/rewards", icon: Award, color: "text-kids-accent", labelKey: "kids.events.nav.rewards" },
  { to: "/kids/events/replays", icon: PlayCircle, color: "text-kids-green", labelKey: "kids.events.nav.replays" },
  { to: "/kids/events/my-events", icon: ListChecks, color: "text-kids-primary", labelKey: "kids.events.nav.myEvents" },
  { to: "/kids/events/notifications", icon: Bell, color: "text-kids-secondary", labelKey: "kids.events.nav.notifications" },
  { to: "/kids/universe", icon: Globe2, color: "text-kids-purple", labelKey: "kids.events.nav.universe" },
];

export default function EventsHome() {
  const { t } = useLanguage();
  const { data: upcoming = [], isLoading } = useUpcomingEvents(6);

  useDocumentHead({ title: t("kids.events.meta.title"), description: t("kids.events.meta.description"), canonicalPath: "/kids/events" });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">🎪 {t("kids.events.heroTitle")}</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{t("kids.events.heroSubtitle")}</p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-4 text-center transition-transform hover:scale-[1.03]">
            <link.icon className={`h-7 w-7 ${link.color}`} aria-hidden="true" />
            <p className="font-heading text-xs font-bold">{t(link.labelKey)}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 font-heading text-xl font-bold">{t("kids.events.upcomingTitle")}</h2>
      {isLoading ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : upcoming.length === 0 ? (
        <p className="mt-4 text-center text-muted-foreground">{t("kids.events.noUpcoming")}</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {upcoming.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
