import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { rpcResult } from "@/integrations/supabase/json";

const DAYS = 7;

export type LearningSummary = {
  days: number;
  requests: number;
  tokens: number;
  avg_latency_ms: number | null;
  signals: Record<string, number>;
  failures_by_channel: Record<string, number>;
  providers: { provider: string; model: string; requests: number; avg_latency_ms: number | null; p95_latency_ms: number | null; tokens: number }[];
  provider_failures: Record<string, number>;
  candidates: Record<string, number>;
  regressions: number;
  eval_cases: Record<string, number>;
  security_events: number;
};

const total = (counts: Record<string, number> | undefined) =>
  Object.values(counts ?? {}).reduce((sum, n) => sum + Number(n), 0);

/**
 * Counts from ai_learning_dashboard(): how the assistants are doing and what
 * is waiting for review. No message, excerpt or fingerprint is read here.
 */
export function AILearningPanel() {
  const { t } = useLanguage();
  const [data, setData] = useState<LearningSummary | null>(null);
  const [isError, setIsError] = useState(false);
  const isLoading = !data && !isError;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: summary, error } = await supabase.rpc("ai_learning_dashboard", { _days: DAYS });
        if (error) throw error;
        if (!cancelled) setData(rpcResult<LearningSummary>(summary));
      } catch {
        if (!cancelled) setIsError(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const format = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString());
  const rows: [string, number | null | undefined][] = data
    ? [
        ["owner.learning.requests", data.requests],
        ["owner.learning.tokens", data.tokens],
        ["owner.learning.avgLatency", data.avg_latency_ms],
        ["owner.learning.helpful", data.signals.thumbs_up ?? 0],
        ["owner.learning.notHelpful", (data.signals.thumbs_down ?? 0) + (data.signals.correction ?? 0) + (data.signals.hallucination_report ?? 0)],
        ["owner.learning.failures", total(data.failures_by_channel)],
        ["owner.learning.fallbacks", data.signals.fallback ?? 0],
        ["owner.learning.candidates", (data.candidates.new ?? 0) + (data.candidates.investigating ?? 0) + (data.candidates.fix_proposed ?? 0)],
        ["owner.learning.regressions", data.regressions],
        ["owner.learning.evalCases", total(data.eval_cases)],
        ["owner.learning.securityEvents", data.security_events],
      ]
    : [];

  return (
    <section aria-labelledby="owner-learning-heading" className="mb-8">
      <h2 id="owner-learning-heading" className="mb-1 text-xl font-bold">{t("owner.learning.title")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        {t("owner.learning.period").replace("{days}", String(DAYS))} · {t("owner.learning.intro")}
      </p>
      {isLoading && <p role="status" className="text-sm">{t("common.loading")}</p>}
      {isError && <p role="alert" className="text-sm text-destructive">{t("owner.learning.loadError")}</p>}
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardContent className="p-0">
            <Table>
              <caption className="sr-only">{t("owner.learning.title")}</caption>
              <TableBody>
                {rows.map(([key, value]) => (
                  <TableRow key={key}>
                    <TableHead scope="row" className="font-normal">{t(key)}</TableHead>
                    <TableCell className="text-end tabular-nums">{format(value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <caption className="sr-only">{t("owner.learning.providers")}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("owner.learning.provider")}</TableHead>
                  <TableHead scope="col">{t("owner.learning.model")}</TableHead>
                  <TableHead scope="col" className="text-end">{t("owner.learning.requests")}</TableHead>
                  <TableHead scope="col" className="text-end">{t("owner.learning.avgLatency")}</TableHead>
                  <TableHead scope="col" className="text-end">{t("owner.learning.p95")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.providers.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>{t("owner.learning.none")}</TableCell></TableRow>
                ) : data.providers.map((p) => (
                  <TableRow key={`${p.provider}/${p.model}`}>
                    <TableCell>{p.provider}</TableCell>
                    <TableCell className="break-all">{p.model}</TableCell>
                    <TableCell className="text-end tabular-nums">{format(p.requests)}</TableCell>
                    <TableCell className="text-end tabular-nums">{format(p.avg_latency_ms)}</TableCell>
                    <TableCell className="text-end tabular-nums">{format(p.p95_latency_ms)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </div>
      )}
    </section>
  );
}
