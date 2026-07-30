import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOpsHealth } from "@/features/visionkids/hooks/ops/useOps";
import { STATUS_COLOR, OPS_COLOR_CLASSES } from "@/features/visionkids/data/opsConfig";
import { OpsHeader, AdminGate, IntegrationNote } from "@/features/visionkids/components/ops/OpsShell";

export default function SystemHealth() {
  const { t } = useLanguage();
  const { data: snapshots = [], isLoading } = useOpsHealth();

  useDocumentHead({ title: `${t("kids.ops.nav.health")} — VisionKids`, description: t("kids.ops.health.subtitle"), canonicalPath: "/kids/ops/health" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="💓" title={t("kids.ops.nav.health")} subtitle={t("kids.ops.health.subtitle")} />
      <AdminGate>
        {isLoading ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : snapshots.length === 0 ? (
          <p className="mt-6 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.ops.health.empty")}</p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {snapshots.map((s) => (
              <div key={s.id} className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-4 ${OPS_COLOR_CLASSES[STATUS_COLOR[s.status]]}`}>
                <div>
                  <p className="font-heading font-bold">{s.service}</p>
                  <p className="text-xs opacity-80">{t(`kids.ops.status.${s.status}`)}{s.latency_ms != null && ` · ${s.latency_ms}ms`}</p>
                </div>
                <span className="text-2xl" aria-hidden="true">{s.status === "operational" ? "🟢" : s.status === "degraded" ? "🟡" : "🔴"}</span>
              </div>
            ))}
          </div>
        )}
        <IntegrationNote textKey="kids.ops.health.integration" />
      </AdminGate>
    </div>
  );
}
