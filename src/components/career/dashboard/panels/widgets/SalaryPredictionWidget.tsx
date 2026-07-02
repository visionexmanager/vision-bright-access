import { LineChart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { estimateSalary } from "@/components/career/jobs/salaryEstimator";
import { MOCK_PROFILE } from "../../mock/mockProfile";

export function SalaryPredictionWidget() {
  const { t } = useLanguage();
  const [city, country] = MOCK_PROFILE.location.split(",").map((s) => s.trim());
  const role = MOCK_PROFILE.experience[0]?.title ?? "Software Engineer";
  const result = estimateSalary({ job: role, country: country ?? "Remote", city: city ?? "Remote", experience: "senior" });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <LineChart className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-bold">{t("careerDash.widget.salaryPrediction")}</h3>
      </div>
      <p className="mb-1 text-xs text-muted-foreground">{role} · {MOCK_PROFILE.location}</p>
      <p className="text-2xl font-black text-primary">{result.currency} {result.median.toLocaleString()}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {result.currency} {result.p25.toLocaleString()} – {result.p75.toLocaleString()}
      </p>
    </div>
  );
}
