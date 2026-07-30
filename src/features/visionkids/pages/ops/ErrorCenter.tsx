import { useState } from "react";
import { Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOpsErrors, useResolveError } from "@/features/visionkids/hooks/ops/useOps";
import { OpsHeader, AdminGate } from "@/features/visionkids/components/ops/OpsShell";
import type { ErrorKind } from "@/features/visionkids/types/ops.types";

const KINDS: (ErrorKind | "all")[] = ["all", "javascript", "api", "database", "ai", "network"];

export default function ErrorCenter() {
  const { t } = useLanguage();
  const [kind, setKind] = useState<ErrorKind | "all">("all");
  const { data: errors = [], isLoading } = useOpsErrors(kind === "all" ? undefined : kind);
  const resolve = useResolveError();

  useDocumentHead({ title: `${t("kids.ops.nav.errors")} — VisionKids`, description: t("kids.ops.errors.subtitle"), canonicalPath: "/kids/ops/errors" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="🐞" title={t("kids.ops.nav.errors")} subtitle={t("kids.ops.errors.subtitle")} />
      <AdminGate>
        <div className="mt-5 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} aria-current={kind === k ? "true" : undefined}
              className={`rounded-full border-2 px-3 py-1 text-sm font-semibold transition-colors ${kind === k ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
              {t(`kids.ops.errorKind.${k}`)}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : errors.length === 0 ? (
          <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.ops.errors.empty")}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {errors.map((e) => (
              <li key={e.id} className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${e.resolved ? "border-border opacity-60" : "border-kids-pink/40"}`}>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{t(`kids.ops.errorKind.${e.kind}`)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.message}</p>
                  <p className="text-[10px] text-muted-foreground">×{e.count} · {new Date(e.last_seen).toLocaleString()}</p>
                </div>
                {!e.resolved && (
                  <button type="button" onClick={() => resolve.mutate(e.id)} disabled={resolve.isPending}
                    className="inline-flex items-center gap-1 rounded-full bg-kids-green px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.ops.errors.resolve")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </AdminGate>
    </div>
  );
}
