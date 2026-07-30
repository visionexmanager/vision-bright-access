import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOpsReports } from "@/features/visionkids/hooks/ops/useOps";
import { PERF_METRICS } from "@/features/visionkids/data/opsConfig";
import { OpsHeader, AdminGate, IntegrationNote } from "@/features/visionkids/components/ops/OpsShell";

export default function PerformanceCenter() {
  const { t } = useLanguage();
  const { data: reports = [] } = useOpsReports("performance");
  const metrics = (reports[0]?.metrics ?? {}) as Record<string, unknown>;

  useDocumentHead({ title: `${t("kids.ops.nav.performance")} — VisionKids`, description: t("kids.ops.performance.subtitle"), canonicalPath: "/kids/ops/performance" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="⚡" title={t("kids.ops.nav.performance")} subtitle={t("kids.ops.performance.subtitle")} />
      <AdminGate>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PERF_METRICS.map((m) => (
            <div key={m} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-4 text-center">
              <span className="font-heading text-xl font-extrabold">{String(metrics[m] ?? "—")}</span>
              <span className="text-[11px] font-semibold text-muted-foreground">{t(`kids.ops.perfMetric.${m}`)}</span>
            </div>
          ))}
        </div>
        <IntegrationNote textKey="kids.ops.performance.integration" />
      </AdminGate>
    </div>
  );
}
