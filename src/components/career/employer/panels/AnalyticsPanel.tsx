import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { TIME_TO_HIRE, BEST_SOURCES, CANDIDATE_QUALITY_TREND, SALARY_TRENDS, JOB_PERFORMANCE, AI_RECOMMENDATIONS } from "../mock/mockAnalytics";
import type { ChartPoint } from "../types";

const COLORS = ["hsl(var(--primary))", "hsl(142 71% 45%)", "hsl(217 91% 60%)", "hsl(280 68% 60%)", "hsl(45 93% 47%)"];

const tooltipStyle = {
  contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" },
};

const axisTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="mb-3 text-sm font-bold">{title}</p>
      {children}
    </div>
  );
}

function TrendLine({ data, unit }: { data: ChartPoint[]; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={axisTick} />
        <YAxis tick={axisTick} />
        <Tooltip {...tooltipStyle} formatter={(value: number) => [`${value}${unit ?? ""}`, ""]} />
        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TrendBar({ data, formatter }: { data: ChartPoint[]; formatter?: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={axisTick} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis tick={axisTick} />
        <Tooltip {...tooltipStyle} formatter={(value: number) => [formatter ? formatter(value) : value, ""]} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsPanel() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("employerDash.nav.analytics")}</h1>
        <p className="text-sm text-muted-foreground">{t("employerDash.analytics.subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("employerDash.analytics.timeToHire")}><TrendLine data={TIME_TO_HIRE} unit=" d" /></ChartCard>
        <ChartCard title={t("employerDash.analytics.bestSources")}><TrendBar data={BEST_SOURCES} /></ChartCard>
        <ChartCard title={t("employerDash.analytics.candidateQuality")}><TrendLine data={CANDIDATE_QUALITY_TREND} /></ChartCard>
        <ChartCard title={t("employerDash.analytics.salaryTrends")}><TrendBar data={SALARY_TRENDS} formatter={(v) => `$${(v / 1000).toFixed(0)}k`} /></ChartCard>
      </div>

      <ChartCard title={t("employerDash.analytics.jobPerformance")}><TrendBar data={JOB_PERFORMANCE} /></ChartCard>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-bold">{t("employerDash.analytics.aiRecommendations")}</p>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {AI_RECOMMENDATIONS.map((rec) => <li key={rec.id}>• {rec.text}</li>)}
        </ul>
      </div>
    </div>
  );
}
