import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { TEST_SUITES } from "@/features/visionkids/data/opsConfig";
import { OpsHeader, AdminGate, IntegrationNote } from "@/features/visionkids/components/ops/OpsShell";

export default function TestingCenter() {
  const { t } = useLanguage();
  useDocumentHead({ title: `${t("kids.ops.nav.testing")} — VisionKids`, description: t("kids.ops.testing.subtitle"), canonicalPath: "/kids/ops/testing" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="🧪" title={t("kids.ops.nav.testing")} subtitle={t("kids.ops.testing.subtitle")} />
      <AdminGate>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEST_SUITES.map((suite) => (
            <div key={suite} className="flex items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card p-4">
              <div>
                <p className="font-heading text-sm font-bold">{t(`kids.ops.testSuite.${suite}`)}</p>
                <p className="text-xs text-muted-foreground">{t("kids.ops.testing.runInCi")}</p>
              </div>
              <span className="text-2xl" aria-hidden="true">🧪</span>
            </div>
          ))}
        </div>
        <IntegrationNote textKey="kids.ops.testing.integration" />
      </AdminGate>
    </div>
  );
}
