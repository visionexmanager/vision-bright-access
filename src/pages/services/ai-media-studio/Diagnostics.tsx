import { useState } from "react";
import {
  Activity, RefreshCw, CheckCircle2, XCircle, AlertTriangle, MinusCircle,
  ChevronDown, ChevronUp, Database, Key, HardDrive, Cloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StudioLayout } from "./StudioLayout";
import { callHealthCheck } from "@/lib/api/edgeFunctions";
import type { HealthCheckResponse, HealthCheckComponentStatus } from "@/lib/api/edgeFunctions";
import { cn } from "@/lib/utils";

type ComponentStatus = HealthCheckComponentStatus;

interface GroupedComponent {
  key:   string;
  label: string;
  data:  ComponentStatus;
}

function groupComponents(components: Record<string, ComponentStatus>) {
  const groups: Record<string, GroupedComponent[]> = {
    "Supabase Environment": [],
    "AI Providers":         [],
    "Database Tables":      [],
    "Storage Buckets":      [],
  };

  for (const [key, data] of Object.entries(components)) {
    const item: GroupedComponent = { key, label: keyToLabel(key), data };
    if (key.startsWith("supabase_"))  groups["Supabase Environment"].push(item);
    else if (key.startsWith("db_"))   groups["Database Tables"].push(item);
    else if (key.startsWith("storage_")) groups["Storage Buckets"].push(item);
    else                               groups["AI Providers"].push(item);
  }

  return groups;
}

function keyToLabel(key: string): string {
  return key
    .replace(/^(db_|storage_|supabase_)/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusIcon({ status }: { status: ComponentStatus["status"] }) {
  if (status === "ok")      return <CheckCircle2 className="size-4 text-green-500 shrink-0" />;
  if (status === "warning") return <AlertTriangle className="size-4 text-amber-500 shrink-0" />;
  if (status === "error")   return <XCircle className="size-4 text-destructive shrink-0" />;
  return <MinusCircle className="size-4 text-muted-foreground shrink-0" />;
}

function StatusBadge({ status }: { status: ComponentStatus["status"] }) {
  const variants: Record<ComponentStatus["status"], string> = {
    ok:      "bg-green-500/10 text-green-600 border-green-500/20",
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    error:   "bg-destructive/10 text-destructive border-destructive/20",
    missing: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", variants[status])}>
      {status.toUpperCase()}
    </span>
  );
}

function GroupIcon({ group }: { group: string }) {
  if (group.includes("Supabase")) return <Key className="size-4 text-muted-foreground" />;
  if (group.includes("Provider")) return <Cloud className="size-4 text-muted-foreground" />;
  if (group.includes("Database")) return <Database className="size-4 text-muted-foreground" />;
  return <HardDrive className="size-4 text-muted-foreground" />;
}

function ComponentGroup({ title, items }: { title: string; items: GroupedComponent[] }) {
  const [open, setOpen] = useState(true);
  const allOk     = items.every((i) => i.data.ok);
  const hasErrors = items.some((i) => i.data.status === "error");
  const hasWarn   = items.some((i) => i.data.status === "warning" || i.data.status === "missing");

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center w-full gap-3 p-4 hover:bg-muted/30 transition-colors"
      >
        <GroupIcon group={title} />
        <span className="text-sm font-medium flex-1 text-left">{title}</span>
        <div className="flex items-center gap-2">
          {allOk     && <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">All OK</Badge>}
          {hasErrors && <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">Errors</Badge>}
          {!hasErrors && hasWarn && <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Warnings</Badge>}
          <span className="text-xs text-muted-foreground">{items.length} checks</span>
          {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t divide-y">
          {items.map((item) => (
            <div key={item.key} className="flex items-start gap-3 px-4 py-3">
              <StatusIcon status={item.data.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{item.label}</span>
                  <StatusBadge status={item.data.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {item.data.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Diagnostics() {
  const [result, setResult]   = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await callHealthCheck();
      setResult(res);
      setLastRun(new Date().toLocaleTimeString());
    } catch (e) {
      setError(
        e instanceof Error
          ? `Health check failed: ${e.message}\n\nThis usually means the 'health-check' edge function is not deployed yet. Deploy it via: supabase functions deploy health-check`
          : "Health check failed unexpectedly"
      );
    } finally {
      setLoading(false);
    }
  };

  const groups = result ? groupComponents(result.components) : {};

  return (
    <StudioLayout>
      <div className="flex flex-col max-w-4xl mx-auto p-6 gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Activity className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">System Diagnostics</h1>
              <p className="text-sm text-muted-foreground">
                Verify all AI Media Studio infrastructure components
              </p>
            </div>
          </div>
          <Button onClick={runCheck} disabled={loading} className="gap-2 shrink-0">
            {loading
              ? <><RefreshCw className="size-4 animate-spin" /> Running…</>
              : <><Activity className="size-4" /> Run Diagnostics</>
            }
          </Button>
        </div>

        {/* Not run yet */}
        {!result && !error && !loading && (
          <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center space-y-3">
            <Activity className="size-8 text-muted-foreground mx-auto" />
            <h2 className="text-sm font-medium">Run a full system check</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Tests database tables, API keys, storage buckets, and provider
              connectivity. Use this to diagnose why generation requests are failing.
            </p>
            <Button onClick={runCheck} className="mt-2">Run Diagnostics</Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-xl border bg-card p-8 text-center space-y-3">
            <RefreshCw className="size-8 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">
              Checking all components… This may take 10–15 seconds.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <XCircle className="size-4 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">Diagnostics Error</p>
            </div>
            <pre className="text-xs text-destructive/80 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Summary banner */}
            <div className={cn(
              "rounded-xl border p-4 flex items-start gap-4",
              result.ok
                ? "bg-green-500/5 border-green-500/20"
                : "bg-destructive/5 border-destructive/20"
            )}>
              {result.ok
                ? <CheckCircle2 className="size-5 text-green-500 shrink-0 mt-0.5" />
                : <XCircle className="size-5 text-destructive shrink-0 mt-0.5" />
              }
              <div className="flex-1">
                <p className={cn("text-sm font-semibold", result.ok ? "text-green-600" : "text-destructive")}>
                  {result.ok ? "All systems operational" : "Issues detected — see details below"}
                </p>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span>✓ {result.summary.passing} passing</span>
                  {result.summary.errors   > 0 && <span className="text-destructive">✗ {result.summary.errors} errors</span>}
                  {result.summary.warnings > 0 && <span className="text-amber-500">⚠ {result.summary.warnings} warnings</span>}
                  {result.summary.missing  > 0 && <span className="text-muted-foreground">○ {result.summary.missing} missing</span>}
                  {lastRun && <span>· Last run: {lastRun}</span>}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={runCheck} disabled={loading} className="gap-1.5 shrink-0">
                <RefreshCw className="size-3.5" /> Re-run
              </Button>
            </div>

            {/* Error summary */}
            {(result.summary.error_keys.length > 0 || result.summary.missing_keys.length > 0) && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                <p className="text-sm font-medium text-destructive">Action required</p>
                <ul className="text-xs text-destructive/80 space-y-1">
                  {result.summary.missing_keys.filter((k) => k === "openai").length > 0 && (
                    <li>→ Set <code className="bg-destructive/10 px-1 rounded">OPENAI_API_KEY</code> in Supabase Dashboard → Edge Functions → Secrets</li>
                  )}
                  {result.summary.error_keys.some((k) => k.startsWith("db_")) && (
                    <li>→ Run <code className="bg-destructive/10 px-1 rounded">supabase db push</code> to apply AI Media Studio migrations</li>
                  )}
                  {result.summary.error_keys.some((k) => k.startsWith("storage_")) && (
                    <li>→ Storage buckets missing — run migrations to create them</li>
                  )}
                  {result.summary.error_keys.includes("openai") && (
                    <li>→ OpenAI API key is invalid — regenerate at platform.openai.com/api-keys</li>
                  )}
                </ul>
              </div>
            )}

            {/* Component groups */}
            <div className="space-y-3">
              {Object.entries(groups).map(([title, items]) =>
                items.length > 0 ? (
                  <ComponentGroup key={title} title={title} items={items} />
                ) : null
              )}
            </div>
          </>
        )}
      </div>
    </StudioLayout>
  );
}
