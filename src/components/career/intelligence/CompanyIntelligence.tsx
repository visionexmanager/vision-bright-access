import { useLanguage } from "@/contexts/LanguageContext";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { IntelSection } from "./IntelSection";
import { COMPANY_INTEL } from "./mock/mockCompanyIntel";

export function CompanyIntelligence() {
  const { t } = useLanguage();

  return (
    <IntelSection id="companies" title={t("intel.companies.title")} subtitle={t("intel.companies.subtitle")}>
      <div className="intel-panel overflow-x-auto rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("intel.companies.company")}</TableHead>
              <TableHead>{t("intel.companies.growthScore")}</TableHead>
              <TableHead>{t("intel.companies.hiringVelocity")}</TableHead>
              <TableHead>{t("intel.companies.retention")}</TableHead>
              <TableHead>{t("intel.companies.salaryCompetitiveness")}</TableHead>
              <TableHead>{t("intel.companies.cultureScore")}</TableHead>
              <TableHead>{t("intel.companies.riskScore")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {COMPANY_INTEL.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <CompanyAvatar name={c.name} color={c.color} size="sm" />
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="intel-muted text-xs">{c.industry}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-bold text-primary">{c.growthScore}</TableCell>
                <TableCell>{c.hiringVelocity}</TableCell>
                <TableCell>{c.retentionScore}</TableCell>
                <TableCell>{c.salaryCompetitiveness}</TableCell>
                <TableCell>{c.cultureScore}</TableCell>
                <TableCell className={c.riskScore > 18 ? "font-semibold text-amber-400" : ""}>{c.riskScore}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </IntelSection>
  );
}
