import { useLanguage } from "@/contexts/LanguageContext";
import type { CareerServiceCardData } from "./types";
import { useComingSoon } from "./useComingSoon";

interface CareerServiceCardProps {
  card: CareerServiceCardData;
}

export function CareerServiceCard({ card }: CareerServiceCardProps) {
  const { t } = useLanguage();
  const handleActivate = useComingSoon();
  const Icon = card.icon;

  return (
    <button
      type="button"
      onClick={handleActivate}
      className="group relative w-full rounded-2xl bg-gradient-to-br from-border via-border to-border p-px text-start transition-all duration-300 hover:from-primary/50 hover:via-accent/40 hover:to-primary/50 hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:from-primary/50 focus-visible:via-accent/40 focus-visible:to-primary/50 focus-visible:outline-none"
    >
      <span className="relative flex h-full flex-col gap-3 rounded-2xl bg-card/80 p-6 shadow-sm backdrop-blur-md transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-primary/10 group-focus-visible:shadow-xl group-focus-visible:shadow-primary/10 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-base font-bold text-foreground">{t(card.titleKey)}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">{t(card.descKey)}</span>
        </span>
      </span>
    </button>
  );
}
