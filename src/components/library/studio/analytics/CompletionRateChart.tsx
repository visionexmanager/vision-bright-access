import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

interface CompletionRateChartProps {
  completionRate: number;
  readingMinutes: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--muted))"];

export function CompletionRateChart({ completionRate, readingMinutes }: CompletionRateChartProps) {
  const { t } = useLanguage();
  const data = [
    { name: t("library.studio.analytics.completed"), value: completionRate },
    { name: t("library.studio.analytics.incomplete"), value: Math.max(0, 100 - completionRate) },
  ];

  return (
    <div className="h-64 rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{t("library.studio.analytics.completionRate")}</h3>
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={50} outerRadius={70} startAngle={90} endAngle={-270}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{completionRate}%</span>
        </div>
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">{t("library.studio.analytics.totalReadingMinutes").replace("{minutes}", readingMinutes.toLocaleString())}</p>
    </div>
  );
}
