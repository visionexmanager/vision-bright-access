import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  fetchExternalProviders, fetchStoredProviderHealth, runExternalProviderHealthCheck,
  type ProviderHealth, type ProviderSummary, type UnsupportedProvider,
} from "@/services/library/externalContent";

const STATUS_VARIANT: Record<ProviderSummary["status"], "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  configuration_required: "outline",
  unsupported: "secondary",
};

const keyed = (rows: ProviderHealth[]) => Object.fromEntries(rows.map((h) => [h.provider, h]));

const HEALTH_VARIANT: Record<ProviderHealth["state"], "default" | "secondary" | "destructive" | "outline"> = {
  healthy: "default",
  degraded: "secondary",
  down: "destructive",
  not_configured: "outline",
};

/**
 * Library admin: every external content provider, its state on this server,
 * what it can do, and its last live check. Env var *names* are shown so an
 * admin knows which secret to add; values never leave the server.
 */
export function ExternalSourcesAdminPanel() {
  const { t, lang } = useLanguage();
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [unsupported, setUnsupported] = useState<UnsupportedProvider[]>([]);
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);


  // Loads once on mount; a changing `t` must not refetch.
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchExternalProviders(), fetchStoredProviderHealth().catch(() => [])])
      .then(([list, stored]) => {
        if (cancelled) return;
        setProviders(list.providers);
        setUnsupported(list.unsupported);
        setHealth(keyed(stored));
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const check = async () => {
    setChecking(true);
    setMessage(t("library.admin.externalSources.checking"));
    try {
      const rows = await runExternalProviderHealthCheck();
      setHealth(keyed(rows));
      const healthy = rows.filter((r) => r.state === "healthy").length;
      setMessage(t("library.admin.externalSources.checkDone").replace("{healthy}", String(healthy)).replace("{total}", String(rows.length)));
    } catch {
      setMessage(t("library.admin.externalSources.checkFailed"));
    } finally {
      setChecking(false);
    }
  };

  const ready = providers.filter((p) => p.status === "ready").length;
  const when = (iso: string) => new Date(iso).toLocaleString(lang);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{t("library.admin.externalSources.heading")}</CardTitle>
          <Button size="sm" onClick={() => void check()} disabled={checking || loading} className="gap-1.5">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Activity className="h-4 w-4" aria-hidden="true" />}
            {t("library.admin.externalSources.runCheck")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("library.admin.externalSources.intro")}</p>
          <p role="status" aria-live="polite" className="min-h-5 text-sm">
            {loading ? t("library.admin.externalSources.loading") : loadFailed ? t("library.admin.externalSources.loadFailed") : message || t("library.admin.externalSources.readyCount").replace("{ready}", String(ready)).replace("{total}", String(providers.length))}
          </p>
          {!loading && providers.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableCaption className="sr-only">{t("library.admin.externalSources.heading")}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t("library.admin.externalSources.col.provider")}</TableHead>
                    <TableHead scope="col">{t("library.admin.externalSources.col.status")}</TableHead>
                    <TableHead scope="col">{t("library.admin.externalSources.col.auth")}</TableHead>
                    <TableHead scope="col">{t("library.admin.externalSources.col.capabilities")}</TableHead>
                    <TableHead scope="col">{t("library.admin.externalSources.col.health")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((p) => {
                    const h = health[p.id];
                    const caps = (["search", "preview", "embed", "download"] as const).filter((c) => p.capabilities[c]);
                    const env = p.auth.kind === "none" ? [] : p.auth.env;
                    return (
                      <TableRow key={p.id}>
                        <TableHead scope="row" className="align-top font-medium text-foreground">
                          <a href={p.docs} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                            {p.name}
                            <span className="sr-only"> ({t("library.researchAssistant.external.opensInNewTab")})</span>
                          </a>
                          <div className="text-xs font-normal text-muted-foreground">{p.categories.map((c) => t(`library.openSources.category.${c}`)).join(", ")}</div>
                        </TableHead>
                        <TableCell className="align-top">
                          <Badge variant={STATUS_VARIANT[p.status]}>{t(`library.admin.externalSources.status.${p.status}`)}</Badge>
                        </TableCell>
                        <TableCell className="align-top text-xs">
                          {t(`library.admin.externalSources.auth.${p.auth.kind}`)}
                          {env.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {env.map((name) => (
                                <li key={name}>
                                  <code className="rounded bg-muted px-1">{name}</code>
                                  {p.missingEnv.includes(name) && <span className="text-muted-foreground"> — {t("library.admin.externalSources.notSet")}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-xs">{caps.map((c) => t(`library.admin.externalSources.cap.${c}`)).join(", ")}</TableCell>
                        <TableCell className="align-top text-xs">
                          {h ? (
                            <div className="space-y-0.5">
                              <Badge variant={HEALTH_VARIANT[h.state]}>{t(`library.admin.externalSources.health.${h.state}`)}</Badge>
                              <div className="text-muted-foreground">
                                {[
                                  h.latencyMs !== null ? `${h.latencyMs} ms` : "",
                                  h.errorCode && h.errorCode !== "not_configured" ? t(`library.admin.externalSources.error.${h.errorCode}`) : "",
                                  when(h.checkedAt),
                                ].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{t("library.admin.externalSources.health.never")}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {unsupported.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("library.admin.externalSources.unsupportedHeading")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {unsupported.map((u) => (
                <li key={u.id}>
                  <span className="font-medium">{u.name}</span>
                  <span className="text-muted-foreground"> — {u.reason}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
