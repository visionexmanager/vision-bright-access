import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StudioBookAnalyticsSummary } from "@/lib/types/library-studio";

export function ReadersChart({ series }: { series: StudioBookAnalyticsSummary["dailySeries"] }) {
  const { t } = useLanguage();
  return (
    <div className="h-64 rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{t("library.studio.analytics.readersOverTime")}</h3>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={series} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Area type="monotone" dataKey="readers" name={t("library.studio.dashboard.totalReads")} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
          <Area type="monotone" dataKey="downloads" name={t("library.studio.dashboard.downloads")} stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
