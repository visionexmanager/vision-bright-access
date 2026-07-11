import { useLanguage } from "@/contexts/LanguageContext";
import { SalaryExplorer } from "@/components/career/jobs/SalaryExplorer";

export function SalaryInsightsPanel() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.salaryInsights")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.salaryInsights.subtitle")}</p>
      </div>
      <SalaryExplorer />
    </div>
  );
}
