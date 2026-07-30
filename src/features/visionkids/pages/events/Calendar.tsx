import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useEventsInRange } from "@/features/visionkids/hooks/events/useEvents";
import { CalendarGrid } from "@/features/visionkids/components/events/CalendarGrid";

export default function Calendar() {
  const { t } = useLanguage();
  const [cursor, setCursor] = useState(() => new Date());
  const [ageGroup, setAgeGroup] = useState("all");
  const [level, setLevel] = useState("all");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const from = useMemo(() => new Date(year, month, 1).toISOString(), [year, month]);
  const to = useMemo(() => new Date(year, month + 1, 1).toISOString(), [year, month]);

  const { data: events = [], isLoading } = useEventsInRange(from, to, { ageGroup, level });

  useDocumentHead({ title: `${t("kids.events.nav.calendar")} — VisionKids`, description: t("kids.events.meta.description"), canonicalPath: "/kids/events/calendar" });

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/kids/events" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.events.heroTitle")}
      </Link>

      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold"><CalendarDays className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.events.nav.calendar")}</h1>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label={t("kids.events.calendar.prevMonth")}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <p className="min-w-[10rem] text-center font-semibold">{monthLabel}</p>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label={t("kids.events.calendar.nextMonth")}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={ageGroup} onValueChange={setAgeGroup}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("kids.events.calendar.allAges")}</SelectItem>
              <SelectItem value="3-5">3-5</SelectItem>
              <SelectItem value="6-8">6-8</SelectItem>
              <SelectItem value="9-12">9-12</SelectItem>
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("kids.events.calendar.allLevels")}</SelectItem>
              <SelectItem value="beginner">{t("kids.events.level.beginner")}</SelectItem>
              <SelectItem value="intermediate">{t("kids.events.level.intermediate")}</SelectItem>
              <SelectItem value="advanced">{t("kids.events.level.advanced")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 h-96 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
      ) : (
        <div className="mt-4">
          <CalendarGrid year={year} month={month} events={events} />
        </div>
      )}
    </div>
  );
}
