import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOpsReports } from "@/features/visionkids/hooks/ops/useOps";
import { A11Y_CHECKS } from "@/features/visionkids/data/opsConfig";
import { OpsHeader, AdminGate, IntegrationNote } from "@/features/visionkids/components/ops/OpsShell";

export default function AccessibilityCenter() {
  const { t } = useLanguage();
  const { data: reports = [] } = useOpsReports("accessibility");
  const latest = reports[0];
  const metrics = (latest?.metrics ?? {}) as Record<string, unknown>;

  useDocumentHead({ title: `${t("kids.ops.nav.accessibility")} — VisionKids`, description: t("kids.ops.accessibility.subtitle"), canonicalPath: "/kids/ops/accessibility" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="♿" title={t("kids.ops.nav.accessibility")} subtitle={t("kids.ops.accessibility.subtitle")} />
      <AdminGate>
        {latest && (
          <div className="mt-6 rounded-2xl border-2 border-kids-green/40 bg-kids-green/5 p-5 text-center">
            <p className="font-heading text-4xl font-extrabold text-kids-green">{latest.score ?? "—"}%</p>
            <p className="text-sm font-semibold text-muted-foreground">{t("kids.ops.accessibility.wcagScore")}</p>
          </div>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {A11Y_CHECKS.map((c) => (
            <div key={c} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-4 text-center">
              <span className="font-heading text-2xl font-extrabold">{String(metrics[c] ?? "—")}</span>
              <span className="text-xs font-semibold text-muted-foreground">{t(`kids.ops.a11yCheck.${c}`)}</span>
            </div>
          ))}
        </div>
        <IntegrationNote textKey="kids.ops.accessibility.integration" />
      </AdminGate>
    </div>
  );
}
