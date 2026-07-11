import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingDown, Bot, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { IntelSection } from "./IntelSection";
import { IN_DEMAND_JOBS, DECLINING_CAREERS, EMERGING_AI_JOBS, AUTOMATION_RISK_JOBS } from "./mock/mockTrends";

const NEON = ["#22d3ee", "#818cf8", "#c084fc", "#34d399", "#fbbf24", "#f87171"];
const axisTick = { fontSize: 11, fill: "hsl(var(--intel-muted))" };
const tooltipStyle = { contentStyle: { background: "hsl(var(--intel-bg-elevated))", border: "1px solid hsl(var(--intel-border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--intel-foreground))" } };

export function TrendAnalytics() {
  const { t } = useLanguage();

  return (
    <IntelSection id="trends" title={t("intel.trends.title")} subtitle={t("intel.trends.subtitle")}>
      <div className="intel-panel rounded-2xl p-5">
        <p className="mb-3 text-sm font-bold">{t("intel.trends.inDemandJobs")}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={IN_DEMAND_JOBS} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--intel-border))" />
            <XAxis dataKey="label" tick={axisTick} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={axisTick} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {IN_DEMAND_JOBS.map((_, i) => <Cell key={i} fill={NEON[i % NEON.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="intel-panel rounded-2xl p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><TrendingDown className="h-4 w-4 text-[hsl(var(--intel-negative))]" aria-hidden="true" />{t("intel.trends.decliningCareers")}</p>
          <ul className="flex flex-col gap-2.5">
            {DECLINING_CAREERS.map((c) => (
              <li key={c.role} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.role}</span>
                  <span className="font-bold text-[hsl(var(--intel-negative))]">-{c.declinePercent}%</span>
                </div>
                <p className="intel-muted text-xs">{c.reason}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="intel-panel rounded-2xl p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Bot className="h-4 w-4 text-primary" aria-hidden="true" />{t("intel.trends.emergingAiJobs")}</p>
          <ul className="flex flex-col gap-2.5">
            {EMERGING_AI_JOBS.map((j) => (
              <li key={j.role} className="flex items-center justify-between text-sm">
                <span className="font-medium">{j.role}</span>
                <span className="font-bold text-[hsl(var(--intel-positive))]">+{j.growthPercent}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="intel-panel rounded-2xl p-5">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden="true" />{t("intel.trends.automationRisk")}</p>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {AUTOMATION_RISK_JOBS.map((j) => (
            <li key={j.role} className="flex items-center justify-between rounded-xl border intel-border px-3 py-2 text-sm">
              <span className="font-medium">{j.role}</span>
              <span className="font-bold text-amber-400">{j.automationRisk}/100</span>
            </li>
          ))}
        </ul>
      </div>
    </IntelSection>
  );
}
