import { useLanguage } from "@/contexts/LanguageContext";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { MOCK_APPLICATIONS } from "../mock/mockApplications";
import type { ApplicationStatus } from "../types";

const STATUS_STYLES: Record<ApplicationStatus, string> = {
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.applications")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.applications.subtitle")}</p>
      </div>

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
            {MOCK_APPLICATIONS.map((app) => (
              <TableRow key={app.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <CompanyAvatar name={app.companyName} color={app.companyColor} size="sm" />
                    <div>
                      <p className="text-sm font-semibold">{app.jobTitle}</p>
                      <p className="text-xs text-muted-foreground">{app.companyName}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{app.location}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{app.appliedDate}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[app.status]}`}>
                    {t(`careerDash.applications.statusValue.${app.status}`)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
