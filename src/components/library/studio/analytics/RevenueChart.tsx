import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StudioBookAnalyticsSummary } from "@/lib/types/library-studio";

export function RevenueChart({ series }: { series: StudioBookAnalyticsSummary["dailySeries"] }) {
  const { t } = useLanguage();
  return (
    <div className="h-64 rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{t("library.studio.dashboard.revenue")}</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={series} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="revenueUsd" name="USD" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
