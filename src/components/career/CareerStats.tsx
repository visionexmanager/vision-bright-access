import { useLanguage } from "@/contexts/LanguageContext";
import { CAREER_STATS } from "./data";

export function CareerStats() {
  const { t } = useLanguage();

  return (
    <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-md sm:grid-cols-5 sm:gap-2">
      {CAREER_STATS.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.id} className="flex flex-col items-center gap-1.5 text-center">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            <dt className="order-2 text-xs font-medium text-muted-foreground sm:text-sm">{t(stat.labelKey)}</dt>
            <dd className="order-1 text-xl font-black text-foreground sm:text-2xl">{stat.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
