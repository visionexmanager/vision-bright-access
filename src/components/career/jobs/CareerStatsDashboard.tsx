import { Briefcase, Building2, FileStack, Globe, Accessibility } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCareerJobs } from "@/hooks/career/useCareerJobs";
import { AnimatedCounter } from "./AnimatedCounter";

/**
 * Totals are counted from the active listings the page can actually read.
 * They used to be fixed numbers (48,210 jobs, 186,400 applications…) that
 * contradicted an empty job board; a figure that no row backs does not belong
 * on a public page. With nothing listed the section is not drawn at all.
 */
export function CareerStatsDashboard() {
  const { t } = useLanguage();
  const { jobs, isLoading } = useCareerJobs({ limit: 1000 });

  if (isLoading || jobs.length === 0) return null;

  const stats = [
    { id: "jobs", icon: Briefcase, value: jobs.length, labelKey: "careersPage.stats.jobs" },
    { id: "companies", icon: Building2, value: new Set(jobs.map((j) => j.company_id)).size, labelKey: "careersPage.stats.companies" },
    { id: "applications", icon: FileStack, value: jobs.reduce((n, j) => n + (j.applicant_count ?? 0), 0), labelKey: "careersPage.stats.applications" },
    { id: "remoteJobs", icon: Globe, value: jobs.filter((j) => j.remote).length, labelKey: "careersPage.stats.remoteJobs" },
    { id: "accessibleJobs", icon: Accessibility, value: jobs.filter((j) => j.accessibility_friendly).length, labelKey: "careersPage.stats.accessibleJobs" },
  ];

  return (
    <div className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-md sm:p-8">
      <h2 className="type-heading mb-6 text-center">{t("careersPage.stats.title")}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.id} className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 bg-background/50 p-4 text-center">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <AnimatedCounter value={stat.value} className="text-xl font-black sm:text-2xl" />
              <span className="text-xs font-medium text-muted-foreground">{t(stat.labelKey)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
