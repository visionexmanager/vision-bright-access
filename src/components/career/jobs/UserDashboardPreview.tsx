import { Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { useComingSoon } from "@/components/career/useComingSoon";
import { USER_DASHBOARD_STATS, MOCK_PROFILE_COMPLETION, MOCK_CAREER_SCORE, MOCK_CAREER_SCORE_MAX } from "./mockUserDashboard";

export function UserDashboardPreview() {
  const { t } = useLanguage();
  const handleComingSoon = useComingSoon();

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
      <h2 className="type-heading mb-2">{t("careersPage.dashboard.user.title")}</h2>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("careersPage.dashboard.user.subtitle")}</p>

      <StaggerGrid className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {USER_DASHBOARD_STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <StaggerItem key={stat.id}>
              <button
                type="button"
                onClick={handleComingSoon}
                className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-border/50 bg-background/50 p-4 text-center transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="text-lg font-black">{stat.value}</span>
                <span className="text-xs text-muted-foreground">{t(stat.labelKey)}</span>
              </button>
            </StaggerItem>
          );
        })}
      </StaggerGrid>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/50 p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{t("careersPage.dashboard.user.profileCompletion")}</span>
            <span className="text-sm font-bold text-primary">{MOCK_PROFILE_COMPLETION}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={MOCK_PROFILE_COMPLETION} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${MOCK_PROFILE_COMPLETION}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/50 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">{t("careersPage.dashboard.user.careerScore")}</p>
            <p className="text-lg font-black">{MOCK_CAREER_SCORE} <span className="text-sm font-normal text-muted-foreground">/ {MOCK_CAREER_SCORE_MAX}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
