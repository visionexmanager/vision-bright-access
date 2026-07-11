import { Sparkles, Award, Send, MessageSquare, Trophy, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_TIMELINE } from "../../mock/mockTimeline";
import type { TimelineEventKind } from "../../types";

const KIND_ICON: Record<TimelineEventKind, LucideIcon> = {
  skill: Sparkles,
  certificate: Award,
  application: Send,
  interview: MessageSquare,
  offer: Trophy,
  promotion: TrendingUp,
};

export function RecentActivityWidget() {
  const { t } = useLanguage();
  const events = [...MOCK_TIMELINE].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <h3 className="mb-4 text-sm font-bold">{t("careerDash.widget.recentActivity")}</h3>
      <ol className="flex flex-col gap-4">
        {events.map((event, i) => {
          const Icon = KIND_ICON[event.kind];
          return (
            <li key={event.id} className="relative flex gap-3 ps-1">
              {i < events.length - 1 && (
                <span className="absolute start-[15px] top-7 h-[calc(100%+0.25rem)] w-px bg-border" aria-hidden="true" />
              )}
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="pb-1">
                <p className="text-sm font-medium leading-snug">{event.title}</p>
                <p className="text-xs text-muted-foreground">{event.date}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
