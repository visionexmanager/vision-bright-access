import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SubjectPerformance } from "@/features/visionkids/services/academy/analytics";

export function SubjectPerformanceChart({ data }: { data: SubjectPerformance[] }) {
  const { t } = useLanguage();

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("kids.academy.noDataYet")}</p>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="subjectName" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number) => [`${value}%`, t("kids.academy.averageScore")]}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="averageScore" fill="var(--kids-primary, #4F46E5)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
