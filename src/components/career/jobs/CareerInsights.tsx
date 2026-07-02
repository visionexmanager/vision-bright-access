import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { CAREER_INSIGHTS } from "./mockInsights";

export function CareerInsights() {
  const { t } = useLanguage();

  return (
    <div>
      <h2 className="type-heading mb-6">{t("careersPage.insights.title")}</h2>
      <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAREER_INSIGHTS.map((insight) => {
          const Icon = insight.icon;
          return (
            <StaggerItem key={insight.id}>
              <div className="flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="font-bold">{t(insight.titleKey)}</h3>
                <p className="text-sm text-muted-foreground">{t(insight.descKey)}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {insight.items.map((item) => (
                    <li key={item} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerGrid>
    </div>
  );
}
