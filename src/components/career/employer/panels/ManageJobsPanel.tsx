import { Users, MoreVertical } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useComingSoon } from "@/components/career/useComingSoon";
import { useEmployerDashboard } from "@/contexts/EmployerDashboardContext";
import { MOCK_EMPLOYER_JOBS } from "../mock/mockJobs";
import type { JobStatus } from "../types";

const STATUS_STYLES: Record<JobStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  draft: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  closed: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export function ManageJobsPanel() {
  const { t } = useLanguage();
  const { setActiveSection } = useEmployerDashboard();
  const handleAction = useComingSoon();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("employerDash.nav.manageJobs")}</h1>
          <p className="text-sm text-muted-foreground">{t("employerDash.manageJobs.subtitle")}</p>
        </div>
        <Button onClick={() => setActiveSection("postJob")}>{t("employerDash.manageJobs.postNew")}</Button>
      </div>

      <div className="flex flex-col gap-3">
        {MOCK_EMPLOYER_JOBS.map((job) => (
          <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4">
            <div>
              <p className="text-sm font-bold">{job.title}</p>
              <p className="text-xs text-muted-foreground">{job.location} · {job.type} · {t("employerDash.manageJobs.posted")} {job.postedDate}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection("candidates")}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {job.applicantCount} {t("employerDash.manageJobs.applicants")}
              </button>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}>{t(`employerDash.manageJobs.status.${job.status}`)}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("employerDash.manageJobs.actions")}>
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleAction}>{t("employerDash.manageJobs.edit")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleAction}>{t("employerDash.manageJobs.pause")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleAction}>{t("employerDash.manageJobs.close")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
