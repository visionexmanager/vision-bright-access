import { KeyRound, ShieldCheck, Gauge, Ban, EyeOff, ClipboardList } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOpsReports } from "@/features/visionkids/hooks/ops/useOps";
import { SECURITY_PANELS } from "@/features/visionkids/data/opsConfig";
import { OpsHeader, AdminGate, IntegrationNote } from "@/features/visionkids/components/ops/OpsShell";

const ICON: Record<string, typeof KeyRound> = {
  authentication: KeyRound, authorization: ShieldCheck, rateLimiting: Gauge, blocked: Ban, suspicious: EyeOff, permissionAudit: ClipboardList,
};

export default function SecurityCenter() {
  const { t } = useLanguage();
  const { data: reports = [] } = useOpsReports("security");
  const metrics = (reports[0]?.metrics ?? {}) as Record<string, unknown>;

  useDocumentHead({ title: `${t("kids.ops.nav.security")} — VisionKids`, description: t("kids.ops.security.subtitle"), canonicalPath: "/kids/ops/security" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="🛡️" title={t("kids.ops.nav.security")} subtitle={t("kids.ops.security.subtitle")} />
      <AdminGate>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY_PANELS.map((p) => {
            const Icon = ICON[p] ?? ShieldCheck;
            return (
              <div key={p} className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-kids-primary" aria-hidden="true" />
                <div>
                  <p className="font-heading text-sm font-bold">{t(`kids.ops.securityPanel.${p}.title`)}</p>
                  <p className="text-sm text-muted-foreground">{t(`kids.ops.securityPanel.${p}.desc`)}</p>
                  {metrics[p] != null && <p className="mt-1 font-heading text-lg font-bold">{String(metrics[p])}</p>}
                </div>
              </div>
            );
          })}
        </div>
        <IntegrationNote textKey="kids.ops.security.integration" />
      </AdminGate>
    </div>
  );
}
