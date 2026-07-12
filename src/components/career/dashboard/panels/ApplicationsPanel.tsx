import { useLanguage } from "@/contexts/LanguageContext";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { useCareerApplications } from "@/hooks/career/useCareerApplications";
import { CareerErrorState } from "../../ui/CareerErrorState";
import { colorFromString } from "@/lib/utils/stringColor";
import type { CareerApplicationStatus } from "@/lib/types/career";

const STATUS_STYLES: Record<CareerApplicationStatus, string> = {
  applied: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  reviewing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  interview: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  offer: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  accepted: "bg-primary/10 text-primary",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
  withdrawn: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

export function ApplicationsPanel() {
  const { t } = useLanguage();
  const { applications, isLoading, error, refetch } = useCareerApplications();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.applications")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.applications.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="h-48 rounded-2xl border border-border/60 bg-card animate-pulse" aria-hidden="true" />
      ) : error ? (
        <CareerErrorState message={error} onRetry={refetch} className="rounded-2xl border border-border/60 bg-card" />
      ) : applications.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("careerDash.applications.empty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("careerDash.applications.job")}</TableHead>
                <TableHead>{t("careerDash.applications.location")}</TableHead>
                <TableHead>{t("careerDash.applications.appliedDate")}</TableHead>
                <TableHead>{t("careerDash.applications.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => {
                const companyName = app.job?.company?.name ?? "";
                return (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <CompanyAvatar name={companyName || "?"} color={colorFromString(companyName || app.job_id)} size="sm" />
                        <div>
                          <p className="text-sm font-semibold">{app.job?.title ?? ""}</p>
                          <p className="text-xs text-muted-foreground">{companyName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{app.job?.location ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(app.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[app.status]}`}>
                        {t(`careerDash.applications.statusValue.${app.status}`)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
