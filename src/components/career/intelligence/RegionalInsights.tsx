import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { IntelSection } from "./IntelSection";
import { REGIONAL_INSIGHTS } from "./mock/mockRegional";
import type { RegionalInsight } from "./types";

const TREND_ICON: Record<RegionalInsight["hiringTrend"], typeof TrendingUp> = { up: TrendingUp, flat: Minus, down: TrendingDown };
const TREND_COLOR: Record<RegionalInsight["hiringTrend"], string> = { up: "hsl(var(--intel-positive))", flat: "#94a3b8", down: "hsl(var(--intel-negative))" };
const COMPETITION_COLOR: Record<RegionalInsight["competitionLevel"], string> = { low: "hsl(var(--intel-positive))", medium: "#fbbf24", high: "hsl(var(--intel-negative))" };

export function RegionalInsights() {
  const { t } = useLanguage();

  return (
    <IntelSection id="regional" title={t("intel.regional.title")} subtitle={t("intel.regional.subtitle")}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REGIONAL_INSIGHTS.map((r) => {
          const TrendIcon = TREND_ICON[r.hiringTrend];
          return (
            <div key={r.region} className="intel-panel flex flex-col gap-3 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <p className="font-bold">{r.region}</p>
                <TrendIcon className="h-4 w-4" style={{ color: TREND_COLOR[r.hiringTrend] }} aria-hidden="true" />
              </div>
              <p className="text-xl font-black text-primary">${r.avgSalaryUsd.toLocaleString()}</p>
              <div>
                <p className="intel-muted mb-1 text-[11px]">{t("intel.regional.topJobs")}</p>
                <p className="text-xs">{r.topJobs.join(", ")}</p>
              </div>
              <div>
                <p className="intel-muted mb-1 text-[11px]">{t("intel.regional.topSkills")}</p>
                <div className="flex flex-wrap gap-1">
                  {r.topSkills.map((s) => <span key={s} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px]">{s}</span>)}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="intel-muted">{t("intel.regional.remoteAvailability")}: <span className="font-semibold">{r.remoteAvailability}%</span></span>
                <span className="font-semibold" style={{ color: COMPETITION_COLOR[r.competitionLevel] }}>{t(`intel.regional.competition.${r.competitionLevel}`)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </IntelSection>
  );
}
