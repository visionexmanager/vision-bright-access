import { Zap, EyeOff, FileClock, Repeat, Rocket } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOpsErrors } from "@/features/visionkids/hooks/ops/useOps";
import { INSIGHT_KINDS } from "@/features/visionkids/data/opsConfig";
import { OpsHeader, AdminGate, IntegrationNote } from "@/features/visionkids/components/ops/OpsShell";

const ICON: Record<string, typeof Zap> = {
  slowFeatures: Zap, unusedPages: EyeOff, staleContent: FileClock, recurringIssues: Repeat, perfSuggestions: Rocket,
};

export default function AIInsights() {
  const { t } = useLanguage();
  const { data: errors = [] } = useOpsErrors();

  useDocumentHead({ title: `${t("kids.ops.nav.insights")} — VisionKids`, description: t("kids.ops.insights.subtitle"), canonicalPath: "/kids/ops/insights" });

  // A real, derived insight: the most frequent unresolved error.
  const topError = [...errors].filter((e) => !e.resolved).sort((a, b) => b.count - a.count)[0];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="💡" title={t("kids.ops.nav.insights")} subtitle={t("kids.ops.insights.subtitle")} />
      <AdminGate>
        {topError && (
          <div className="mt-6 rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/5 p-4">
            <p className="text-sm font-semibold">💡 {t("kids.ops.insights.topIssue")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{topError.message} <span className="font-bold">(×{topError.count})</span></p>
          </div>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {INSIGHT_KINDS.map((k) => {
            const Icon = ICON[k] ?? Zap;
            return (
              <div key={k} className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-kids-purple" aria-hidden="true" />
                <div>
                  <p className="font-heading text-sm font-bold">{t(`kids.ops.insight.${k}.title`)}</p>
                  <p className="text-sm text-muted-foreground">{t(`kids.ops.insight.${k}.desc`)}</p>
                </div>
              </div>
            );
          })}
        </div>
        <IntegrationNote textKey="kids.ops.insights.integration" />
      </AdminGate>
    </div>
  );
}
