import { TrendingUp, XCircle, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { IntelSection } from "./IntelSection";
import { FORECAST_ROLES, OBSOLETE_SKILLS } from "./mock/mockForecast";

export function CareerForecastAI() {
  const { t } = useLanguage();

  return (
    <IntelSection id="forecast" title={t("intel.forecast.title")} subtitle={t("intel.forecast.subtitle")}>
      <div className="grid gap-3 lg:grid-cols-2">
        {FORECAST_ROLES.map((r) => (
          <div key={r.role} className="intel-panel flex flex-col gap-2 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="font-bold">{r.role}</p>
              <span className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--intel-positive))]">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                +{r.projectedGrowthPercent}%
              </span>
            </div>
            <p className="intel-muted text-xs">{t("intel.forecast.growthWindow")}: {r.growthWindow} · ${r.projectedSalaryUsd.toLocaleString()} {t("intel.forecast.projectedSalary")}</p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="mb-1 flex justify-between text-[11px]"><span className="intel-muted">{t("intel.forecast.aiReplacementRisk")}</span><span>{r.aiReplacementRisk}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-amber-400" style={{ width: `${r.aiReplacementRisk}%` }} /></div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11px]"><span className="intel-muted">{t("intel.forecast.stabilityIndex")}</span><span>{r.stabilityIndex}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-[hsl(var(--intel-positive))]" style={{ width: `${r.stabilityIndex}%` }} /></div>
              </div>
            </div>
          </div>
        ))}

        <div className="intel-panel rounded-2xl p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><XCircle className="h-4 w-4 text-[hsl(var(--intel-negative))]" aria-hidden="true" />{t("intel.forecast.obsoleteSkills")}</p>
          <ul className="flex flex-col gap-1.5 text-sm intel-muted">
            {OBSOLETE_SKILLS.map((s) => <li key={s}>• {s}</li>)}
          </ul>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-primary"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />{t("intel.forecast.note")}</p>
        </div>
      </div>
    </IntelSection>
  );
}
