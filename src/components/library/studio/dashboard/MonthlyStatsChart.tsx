import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AuthorMonthlyStatPoint } from "@/lib/types/library-studio";

interface MonthlyStatsChartProps {
  data: AuthorMonthlyStatPoint[];
}

export function MonthlyStatsChart({ data }: MonthlyStatsChartProps) {
  const { t } = useLanguage();

  if (data.length === 0) {
    return <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">{t("library.studio.dashboard.monthlyStatsEmpty")}</p>;
  }

  return (
    <div className="h-72 w-full rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{t("library.studio.dashboard.monthlyStatistics")}</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="count" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line yAxisId="count" type="monotone" dataKey="reads" name={t("library.studio.dashboard.totalReads")} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          <Line yAxisId="count" type="monotone" dataKey="downloads" name={t("library.studio.dashboard.downloads")} stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
          <Line yAxisId="revenue" type="monotone" dataKey="revenueUsd" name={t("library.studio.dashboard.revenue")} stroke="#22c55e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
