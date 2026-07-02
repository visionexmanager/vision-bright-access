import { Briefcase, Building2, FileStack, Globe, Accessibility, Flag } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnimatedCounter } from "./AnimatedCounter";

const STATS = [
  { id: "jobs", icon: Briefcase, value: 48210, labelKey: "careersPage.stats.jobs" },
  { id: "companies", icon: Building2, value: 3120, labelKey: "careersPage.stats.companies" },
  { id: "applications", icon: FileStack, value: 186400, labelKey: "careersPage.stats.applications" },
  { id: "remoteJobs", icon: Globe, value: 15870, labelKey: "careersPage.stats.remoteJobs" },
  { id: "accessibleJobs", icon: Accessibility, value: 4290, labelKey: "careersPage.stats.accessibleJobs" },
  { id: "countries", icon: Flag, value: 64, labelKey: "careersPage.stats.countries" },
];

export function CareerStatsDashboard() {
  const { t } = useLanguage();

  return (
    <div className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-md sm:p-8">
      <h2 className="type-heading mb-6 text-center">{t("careersPage.stats.title")}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {STATS.map((stat) => {
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
