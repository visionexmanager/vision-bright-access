import { Check, X, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOpsReviews, useDecideReview } from "@/features/visionkids/hooks/ops/useOps";
import { OpsHeader, AdminGate } from "@/features/visionkids/components/ops/OpsShell";

export default function ContentReview() {
  const { t } = useLanguage();
  const { data: reviews = [], isLoading } = useOpsReviews("pending");
  const decide = useDecideReview();

  useDocumentHead({ title: `${t("kids.ops.nav.content")} — VisionKids`, description: t("kids.ops.content.subtitle"), canonicalPath: "/kids/ops/content" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="🔍" title={t("kids.ops.nav.content")} subtitle={t("kids.ops.content.subtitle")} />
      <AdminGate>
        {isLoading ? (
          <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : reviews.length === 0 ? (
          <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.ops.content.empty")}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border-2 border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-heading font-bold leading-tight">{r.title}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(`kids.ops.reviewKind.${r.content_kind}`)}</p>
                  </div>
                </div>
                {r.flags.length > 0 && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-kids-pink"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {r.flags.join(", ")}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => decide.mutate({ id: r.id, approve: true })} disabled={decide.isPending}
                    className="inline-flex items-center gap-1 rounded-full bg-kids-green px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.ops.content.approve")}
                  </button>
                  <button type="button" onClick={() => decide.mutate({ id: r.id, approve: false })} disabled={decide.isPending}
                    className="inline-flex items-center gap-1 rounded-full bg-kids-pink px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.ops.content.reject")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminGate>
    </div>
  );
}
