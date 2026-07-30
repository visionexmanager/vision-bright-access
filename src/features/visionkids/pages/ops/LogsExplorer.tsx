import { useState } from "react";
import { Search, Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOpsLogs } from "@/features/visionkids/hooks/ops/useOps";
import { OpsHeader, AdminGate } from "@/features/visionkids/components/ops/OpsShell";
import type { LogLevel } from "@/features/visionkids/types/ops.types";

const LEVELS: (LogLevel | "all")[] = ["all", "debug", "info", "warn", "error"];
const LEVEL_COLOR: Record<string, string> = { debug: "text-muted-foreground", info: "text-kids-primary", warn: "text-kids-accent", error: "text-kids-pink" };

export default function LogsExplorer() {
  const { t } = useLanguage();
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const { data: logs = [], isLoading } = useOpsLogs(level === "all" ? undefined : level, query);

  useDocumentHead({ title: `${t("kids.ops.nav.logs")} — VisionKids`, description: t("kids.ops.logs.subtitle"), canonicalPath: "/kids/ops/logs" });

  function exportCsv() {
    const rows = [["time", "level", "source", "message"], ...logs.map((l) => [l.created_at, l.level, l.source ?? "", l.message.replace(/"/g, "'")])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "visionkids-logs.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <OpsHeader emoji="📜" title={t("kids.ops.nav.logs")} subtitle={t("kids.ops.logs.subtitle")} />
      <AdminGate>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:right-3" aria-hidden="true" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQuery(term)}
              placeholder={t("kids.ops.logs.search")} className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 ps-9 text-sm" />
          </div>
          <button type="button" onClick={() => setQuery(term)} className="rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90">{t("kids.ops.logs.go")}</button>
          <button type="button" onClick={exportCsv} disabled={logs.length === 0} className="inline-flex items-center gap-1 rounded-full border-2 border-border px-4 py-2 text-sm font-bold hover:border-kids-primary/50 disabled:opacity-50">
            <Download className="h-4 w-4" aria-hidden="true" /> {t("kids.ops.logs.export")}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l} type="button" onClick={() => setLevel(l)} aria-current={level === l ? "true" : undefined}
              className={`rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors ${level === l ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
              {t(`kids.ops.logLevel.${l}`)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
        ) : logs.length === 0 ? (
          <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.ops.logs.empty")}</p>
        ) : (
          <ul className="mt-6 divide-y divide-border rounded-2xl border-2 border-border bg-card font-mono text-xs">
            {logs.map((l) => (
              <li key={l.id} className="flex gap-2 p-2.5">
                <span className="shrink-0 text-muted-foreground">{new Date(l.created_at).toLocaleTimeString()}</span>
                <span className={`shrink-0 font-bold uppercase ${LEVEL_COLOR[l.level]}`}>{l.level}</span>
                {l.source && <span className="shrink-0 text-muted-foreground">[{l.source}]</span>}
                <span className="min-w-0 break-words">{l.message}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminGate>
    </div>
  );
}
