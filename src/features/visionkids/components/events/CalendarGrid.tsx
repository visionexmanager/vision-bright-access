import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import type { KidsEvent } from "@/features/visionkids/types/events.types";

interface CalendarGridProps {
  year: number;
  month: number; // 0-indexed
  events: KidsEvent[];
}

function eventsOnDay(events: KidsEvent[], day: Date): KidsEvent[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return events.filter((e) => new Date(e.starts_at) < dayEnd && new Date(e.ends_at) >= dayStart);
}

export function CalendarGrid({ year, month, events }: CalendarGridProps) {
  const { t } = useLanguage();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-1">
      {weekdayKeys.map((k) => (
        <div key={k} className="pb-1 text-center text-xs font-bold text-muted-foreground">{t(`kids.events.calendar.weekday.${k}`)}</div>
      ))}
      {cells.map((date, i) => {
        if (!date) return <div key={`empty-${i}`} />;
        const dayEvents = eventsOnDay(events, date);
        const isToday = date.toDateString() === today.toDateString();
        return (
          <div key={date.toISOString()} className={`min-h-[72px] rounded-xl border-2 p-1 text-start ${isToday ? "border-kids-primary" : "border-border"}`}>
            <p className={`text-xs font-semibold ${isToday ? "text-kids-primary" : "text-muted-foreground"}`}>{date.getDate()}</p>
            <div className="mt-0.5 flex flex-col gap-0.5">
              {dayEvents.slice(0, 2).map((e) => (
                <Link key={e.id} to={`/kids/events/detail/${e.slug}`} className="truncate rounded bg-kids-primary/10 px-1 py-0.5 text-[10px] font-semibold text-kids-primary hover:bg-kids-primary/20">
                  {e.emoji} {e.title}
                </Link>
              ))}
              {dayEvents.length > 2 && <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
