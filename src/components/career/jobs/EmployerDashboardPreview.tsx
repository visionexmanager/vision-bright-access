import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { useComingSoon } from "@/components/career/useComingSoon";
import { EMPLOYER_DASHBOARD_ACTIONS } from "./mockEmployerDashboard";

export function EmployerDashboardPreview() {
  const { t } = useLanguage();
  const handleComingSoon = useComingSoon();

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
      <h2 className="type-heading mb-2">{t("careersPage.dashboard.employer.title")}</h2>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("careersPage.dashboard.employer.subtitle")}</p>

      <StaggerGrid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EMPLOYER_DASHBOARD_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <StaggerItem key={action.id}>
              <button
                type="button"
                onClick={handleComingSoon}
                className="flex w-full flex-col items-start gap-2 rounded-2xl border border-border/50 bg-background/50 p-4 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {typeof action.value === "number" && <span className="text-lg font-black">{action.value}</span>}
                </div>
                <span className="text-sm font-bold">{t(action.titleKey)}</span>
                <span className="text-xs text-muted-foreground">{t(action.descKey)}</span>
              </button>
            </StaggerItem>
          );
        })}
      </StaggerGrid>
    </div>
  );
}
