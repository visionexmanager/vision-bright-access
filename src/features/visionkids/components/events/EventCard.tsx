import { Link } from "react-router-dom";
import { Calendar, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { KidsEvent } from "@/features/visionkids/types/events.types";

const TYPE_COLOR: Record<string, string> = {
  live: "border-kids-pink/40 bg-kids-pink/10 text-kids-pink",
  workshop: "border-kids-secondary/40 bg-kids-secondary/10 text-kids-secondary",
  competition: "border-kids-accent/40 bg-kids-accent/10 text-kids-accent",
  seasonal: "border-kids-purple/40 bg-kids-purple/10 text-kids-purple",
};

export function EventCard({ event }: { event: KidsEvent }) {
  const { t } = useLanguage();

  return (
    <Link
      to={`/kids/events/detail/${event.slug}`}
      className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-4 transition-colors hover:border-kids-primary/50"
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl" aria-hidden="true">{event.emoji}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TYPE_COLOR[event.event_type]}`}>
          {t(`kids.events.type.${event.event_type}`)}
        </span>
      </div>
      <p className="font-heading font-bold">{event.title}</p>
      {event.description && <p className="line-clamp-2 text-sm text-muted-foreground">{event.description}</p>}
      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" aria-hidden="true" /> {new Date(event.starts_at).toLocaleDateString()}</span>
        {event.capacity && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {event.capacity}</span>}
      </div>
    </Link>
  );
}
