import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOpsAudit } from "@/features/visionkids/hooks/ops/useOps";
import { OpsHeader, AdminGate } from "@/features/visionkids/components/ops/OpsShell";

export default function AuditCenter() {
  const { t } = useLanguage();
  const { data: rows = [], isLoading } = useOpsAudit();

  useDocumentHead({ title: `${t("kids.ops.nav.audit")} — VisionKids`, description: t("kids.ops.audit.subtitle"), canonicalPath: "/kids/ops/audit" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="📒" title={t("kids.ops.nav.audit")} subtitle={t("kids.ops.audit.subtitle")} />
      <AdminGate>
        {isLoading ? (
          <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
        ) : rows.length === 0 ? (
          <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.ops.audit.empty")}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-1.5">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-3 text-sm">
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{r.action}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{JSON.stringify(r.detail)}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminGate>
    </div>
  );
}
