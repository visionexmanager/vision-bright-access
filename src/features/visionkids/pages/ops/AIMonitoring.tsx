import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOpsHealth } from "@/features/visionkids/hooks/ops/useOps";
import { AI_SERVICES } from "@/features/visionkids/data/opsConfig";
import { OpsHeader, AdminGate, IntegrationNote } from "@/features/visionkids/components/ops/OpsShell";

export default function AIMonitoring() {
  const { t } = useLanguage();
  const { data: snapshots = [] } = useOpsHealth();

  useDocumentHead({ title: `${t("kids.ops.nav.ai")} — VisionKids`, description: t("kids.ops.ai.subtitle"), canonicalPath: "/kids/ops/ai" });

  // Latest status per AI service (from health snapshots named "ai:<service>").
  const statusByService = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of snapshots) {
      const key = s.service.replace(/^ai:/, "");
      if (!map.has(key)) map.set(key, s.status);
    }
    return map;
  }, [snapshots]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="🤖" title={t("kids.ops.nav.ai")} subtitle={t("kids.ops.ai.subtitle")} />
      <AdminGate>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {AI_SERVICES.map((svc) => {
            const status = statusByService.get(svc) ?? "unknown";
            return (
              <div key={svc} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-4 text-center">
                <span className="text-3xl" aria-hidden="true">🤖</span>
                <span className="text-sm font-bold">{t(`kids.ops.aiService.${svc}`)}</span>
                <span className="text-xs">{status === "operational" ? "🟢" : status === "degraded" ? "🟡" : status === "down" ? "🔴" : "⚪"} {t(`kids.ops.status.${status === "unknown" ? "unknown" : status}`)}</span>
              </div>
            );
          })}
        </div>
        <IntegrationNote textKey="kids.ops.ai.integration" />
      </AdminGate>
    </div>
  );
}
