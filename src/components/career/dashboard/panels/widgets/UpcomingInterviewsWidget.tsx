// Still mock — see InterviewsPanel.tsx (no interview-scheduling table yet).
import { CalendarClock, Video, Phone, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_INTERVIEWS } from "../../mock/mockInterviews";

const TYPE_ICON = { video: Video, phone: Phone, onsite: MapPin };

export function UpcomingInterviewsWidget() {
  const { t } = useLanguage();
  const now = Date.now();
  const upcoming = MOCK_INTERVIEWS.filter((iv) => new Date(iv.date).getTime() >= now).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-bold">{t("careerDash.widget.upcomingInterviews")}</h3>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("careerDash.widget.noUpcomingInterviews")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {upcoming.map((iv) => {
            const Icon = TYPE_ICON[iv.type];
            return (
              <li key={iv.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{iv.jobTitle}</p>
                  <p className="truncate text-xs text-muted-foreground">{iv.companyName} · {iv.date} · {iv.time}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
