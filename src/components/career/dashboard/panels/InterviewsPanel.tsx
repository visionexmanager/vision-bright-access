// Still mock — no interview-scheduling table exists yet (applications.status
// includes "interview" but there's no date/time/round record). Future phase.
import { useMemo, useState } from "react";
import { Video, Phone, MapPin, Bell } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MOCK_INTERVIEWS } from "../mock/mockInterviews";

const TYPE_ICON = { video: Video, phone: Phone, onsite: MapPin };

function InterviewListItem({ iv }: { iv: (typeof MOCK_INTERVIEWS)[number] }) {
  const Icon = TYPE_ICON[iv.type];
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{iv.jobTitle}</p>
        <p className="truncate text-xs text-muted-foreground">{iv.companyName} · {iv.round}</p>
      </div>
      <div className="text-end text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">{iv.date}</p>
        <p>{iv.time}</p>
      </div>
    </li>
  );
}

function MiniMonthCalendar({ interviews }: { interviews: typeof MOCK_INTERVIEWS }) {
  const { t } = useLanguage();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();

  const interviewDays = useMemo(() => {
    const map = new Map<number, number>();
    interviews.forEach((iv) => {
      const d = new Date(iv.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        map.set(d.getDate(), (map.get(d.getDate()) ?? 0) + 1);
      }
    });
    return map;
  }, [interviews, year, month]);

  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="mb-4 text-center text-sm font-bold">{firstDay.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="py-1 font-semibold">{d}</div>)}
        {cells.map((day, i) => {
          const hasInterview = day ? interviewDays.has(day) : false;
          const isToday = day === today.getDate();
          return (
            <div
              key={i}
              className={`flex h-9 flex-col items-center justify-center rounded-lg text-xs ${
                day === null ? "" : isToday ? "bg-primary text-primary-foreground font-bold" : hasInterview ? "bg-primary/10 font-semibold text-primary" : "text-foreground"
              }`}
            >
              {day}
              {hasInterview && !isToday && <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
        {t("careerDash.interviews.reminderNote")}
      </p>
    </div>
  );
}

export function InterviewsPanel() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("list");
  const sorted = [...MOCK_INTERVIEWS].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.interviews")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.interviews.subtitle")}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list">{t("careerDash.interviews.listView")}</TabsTrigger>
          <TabsTrigger value="calendar">{t("careerDash.interviews.calendarView")}</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("careerDash.widget.noUpcomingInterviews")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sorted.map((iv) => <InterviewListItem key={iv.id} iv={iv} />)}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <MiniMonthCalendar interviews={sorted} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
