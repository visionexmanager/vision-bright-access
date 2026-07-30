import { Link } from "react-router-dom";
import { ChevronLeft, ListChecks } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyRegistrations } from "@/features/visionkids/hooks/events/useRegistration";
import { useEventsByIds } from "@/features/visionkids/hooks/events/useEvents";
import { EventCard } from "@/features/visionkids/components/events/EventCard";

export default function MyEvents() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: registrations = [], isLoading } = useMyRegistrations();
  const activeRegs = registrations.filter((r) => r.status !== "cancelled");
  const { data: events = [] } = useEventsByIds(activeRegs.map((r) => r.event_id));

  useDocumentHead({ title: `${t("kids.events.nav.myEvents")} — VisionKids`, description: t("kids.events.meta.description"), canonicalPath: "/kids/events/my-events" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link to="/kids/events" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.events.heroTitle")}
      </Link>

      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold"><ListChecks className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.events.nav.myEvents")}</h1>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : events.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.events.myEvents.empty")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {events.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
