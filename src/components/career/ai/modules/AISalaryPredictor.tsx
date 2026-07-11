import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_PROFILE } from "@/components/career/dashboard/mock/mockProfile";
import { POPULAR_COUNTRIES } from "@/components/career/jobs/mockLocations";
import { estimateSalary } from "@/components/career/jobs/salaryEstimator";
import { useAiSimulation } from "../useAiSimulation";
import { AIThinkingIndicator } from "../AIThinkingIndicator";
import type { ExperienceLevel } from "@/components/career/jobs/types";
import type { SalaryPredictionResult } from "../types";

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; labelKey: string }[] = [
  { value: "entry", labelKey: "careersPage.filter.experience.entry" },
  { value: "mid", labelKey: "careersPage.filter.experience.mid" },
  { value: "senior", labelKey: "careersPage.filter.experience.senior" },
  { value: "lead", labelKey: "careersPage.filter.experience.lead" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function predictSalary(role: string, experience: ExperienceLevel): SalaryPredictionResult {
  const countrySamples = POPULAR_COUNTRIES.slice(0, 5);
  const byCountry = countrySamples.map((c) => ({
    country: c.name,
    amount: estimateSalary({ job: role, country: c.name, city: c.cities[0]?.name ?? c.name, experience }).median,
  }));
  const overall = estimateSalary({ job: role, country: "United States", city: "Remote", experience });
  const growth = 4 + (hashString(role) % 9);

  return {
    currency: overall.currency,
    low: overall.p25,
    median: overall.median,
    high: overall.p75,
    byCountry: byCountry.sort((a, b) => b.amount - a.amount),
    growthNextYearPercent: growth,
  };
}

export function AISalaryPredictor() {
  const { t } = useLanguage();
  const [role, setRole] = useState(MOCK_PROFILE.experience[0]?.title ?? "");
  const [experience, setExperience] = useState<ExperienceLevel>("senior");
  const { loading, result, run } = useAiSimulation(() => predictSalary(role, experience), 1400);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("aiSuite.salaryPredictor.desc")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sp-role" className="mb-1.5 block text-xs text-muted-foreground">{t("careersPage.salary.job")}</Label>
          <Input id="sp-role" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">{t("careersPage.filter.experience.label")}</Label>
          <Select value={experience} onValueChange={(v) => setExperience(v as ExperienceLevel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPERIENCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={run} disabled={loading} className="self-start">{t("aiSuite.salaryPredictor.predict")}</Button>

      {loading && <AIThinkingIndicator label={t("aiSuite.salaryPredictor.thinking")} />}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <div><p className="text-xs text-muted-foreground">{t("careersPage.salary.p25")}</p><p className="font-bold">{result.currency} {result.low.toLocaleString()}</p></div>
            <div><p className="text-xs text-primary">{t("careersPage.salary.median")}</p><p className="text-lg font-black text-primary">{result.currency} {result.median.toLocaleString()}</p></div>
            <div><p className="text-xs text-muted-foreground">{t("careersPage.salary.p75")}</p><p className="font-bold">{result.currency} {result.high.toLocaleString()}</p></div>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">{t("aiSuite.salaryPredictor.byCountry")}</p>
            <ul className="flex flex-col gap-1.5">
              {result.byCountry.map((c) => (
                <li key={c.country} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c.country}</span>
                  <span className="font-semibold">{result.currency} {c.amount.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            {t("aiSuite.salaryPredictor.growth").replace("{percent}", String(result.growthNextYearPercent))}
          </div>
        </div>
      )}
    </div>
  );
}
