import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { IntelSection } from "./IntelSection";
import { COUNTRY_JOB_DATA } from "./mock/mockCountries";
import { SALARY_BY_INDUSTRY, SALARY_BY_EXPERIENCE, SALARY_BY_SKILL, SALARY_INFLATION_TREND, SALARY_FUTURE_PREDICTION } from "./mock/mockSalaryIntel";

const NEON = ["#22d3ee", "#818cf8", "#c084fc", "#34d399", "#fbbf24", "#f87171"];
const axisTick = { fontSize: 11, fill: "hsl(var(--intel-muted))" };
const tooltipStyle = { contentStyle: { background: "hsl(var(--intel-bg-elevated))", border: "1px solid hsl(var(--intel-border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--intel-foreground))" } };
const currencyFormatter = (v: number) => `$${(v / 1000).toFixed(0)}k`;

function SalaryBarCard({ title, data }: { title: string; data: { label: string; amount: number }[] }) {
  return (
    <div className="intel-panel rounded-2xl p-5">
      <p className="mb-3 text-sm font-bold">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--intel-border))" />
          <XAxis dataKey="label" tick={axisTick} interval={0} angle={-15} textAnchor="end" height={50} />
          <YAxis tick={axisTick} tickFormatter={currencyFormatter} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [currencyFormatter(v), ""]} />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={NEON[i % NEON.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalaryEngine() {
  const { t } = useLanguage();
  const byCountry = COUNTRY_JOB_DATA.map((c) => ({ label: c.name, amount: c.avgSalaryUsd })).sort((a, b) => b.amount - a.amount).slice(0, 6);
  const forecastCombined = [...SALARY_INFLATION_TREND, ...SALARY_FUTURE_PREDICTION.slice(1)];

  return (
    <IntelSection id="salary" title={t("intel.salary.title")} subtitle={t("intel.salary.subtitle")}>
      <div className="grid gap-4 lg:grid-cols-2">
        <SalaryBarCard title={t("intel.salary.byCountry")} data={byCountry} />
        <SalaryBarCard title={t("intel.salary.byIndustry")} data={SALARY_BY_INDUSTRY} />
        <SalaryBarCard title={t("intel.salary.byExperience")} data={SALARY_BY_EXPERIENCE} />
        <SalaryBarCard title={t("intel.salary.bySkillStack")} data={SALARY_BY_SKILL} />
      </div>

      <div className="intel-panel rounded-2xl p-5">
        <p className="mb-1 text-sm font-bold">{t("intel.salary.inflationTrend")}</p>
        <p className="intel-muted mb-3 text-xs">{t("intel.salary.forecastNote")}</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={forecastCombined} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--intel-border))" />
            <XAxis dataKey="year" tick={axisTick} />
            <YAxis tick={axisTick} tickFormatter={currencyFormatter} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [currencyFormatter(v), ""]} />
            <Line type="monotone" dataKey="amount" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </IntelSection>
  );
}
