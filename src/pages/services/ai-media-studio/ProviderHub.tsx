import { useState } from "react";
import { StudioLayout } from "./StudioLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Search, RefreshCw, Shield, Activity,
  Cpu, GitBranch, Clock, CheckCircle2, XCircle,
  AlertTriangle, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProviderCard } from "./components/provider-hub/ProviderCard";
import { ProviderMetricsChart } from "./components/provider-hub/ProviderMetricsChart";
import { AddProviderDialog } from "./components/provider-hub/AddProviderDialog";
import { ProviderHealthDashboard } from "./components/provider-hub/ProviderHealthDashboard";
import { useProviders, useProviderMutations } from "@/hooks/useProviders";
import { useProviderStats, useProviderTimeSeries, useProviderLogs, useFailovers } from "@/hooks/useProviderMetrics";
import { useHubConfig, useHubConfigMutation } from "@/hooks/useProviderHealth";
import {
  PROVIDER_TYPE_LABELS, STATUS_BG,
} from "@/lib/types/provider-hub";
import type {
  Provider, CreateProviderInput, UpdateProviderInput, ProviderType,
} from "@/lib/types/provider-hub";

// ── Logs table ────────────────────────────────────────────────────────────────

function LogsTab() {
  const [typeFilter, setTypeFilter] = useState<ProviderType | "">("");
  const { data: logs = [], isLoading } = useProviderLogs({
    job_type: typeFilter || undefined,
    limit:    100,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ProviderType | "")}>
          <SelectTrigger className="h-8 w-48 text-sm"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            {(Object.entries(PROVIDER_TYPE_LABELS) as [ProviderType, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{logs.length} entries</span>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Time</TableHead>
              <TableHead className="text-xs">Provider</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Latency</TableHead>
              <TableHead className="text-xs">Cost</TableHead>
              <TableHead className="text-xs">Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><div className="h-3 bg-muted animate-pulse rounded w-16" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">
                  No log entries yet
                </TableCell>
              </TableRow>
            ) : logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-[11px] font-mono whitespace-nowrap">
                  {new Date(log.created_at).toLocaleTimeString()}
                </TableCell>
                <TableCell className="text-[11px]">{log.provider_slug ?? "—"}</TableCell>
                <TableCell className="text-[11px]">{log.job_type ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={cn("text-[10px]",
                    log.status === "success" ? STATUS_BG.active :
                    log.status === "failure" ? STATUS_BG.error  :
                    STATUS_BG.degraded
                  )}>
                    {log.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-[11px]">
                  {log.latency_ms != null ? `${log.latency_ms}ms` : "—"}
                </TableCell>
                <TableCell className="text-[11px]">
                  {log.cost_usd != null ? `$${log.cost_usd.toFixed(5)}` : "—"}
                </TableCell>
                <TableCell className="text-[11px] text-red-400 max-w-48 truncate">
                  {log.error_message ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Failovers tab ─────────────────────────────────────────────────────────────

function FailoversTab() {
  const { data: failovers = [], isLoading } = useFailovers(100);

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Time</TableHead>
            <TableHead className="text-xs">From</TableHead>
            <TableHead className="text-xs">To</TableHead>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs">Reason</TableHead>
            <TableHead className="text-xs">Resolved</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <TableCell key={j}><div className="h-3 bg-muted animate-pulse rounded w-20" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : failovers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                No failovers recorded
              </TableCell>
            </TableRow>
          ) : failovers.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="text-[11px] font-mono">
                {new Date(f.created_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-[11px] font-mono text-red-400">{f.from_slug ?? "—"}</TableCell>
              <TableCell className="text-[11px] font-mono text-green-400">{f.to_slug ?? "—"}</TableCell>
              <TableCell className="text-[11px]">{f.job_type ?? "—"}</TableCell>
              <TableCell className="text-[11px] max-w-40 truncate text-muted-foreground">{f.reason ?? "—"}</TableCell>
              <TableCell>
                {f.resolved
                  ? <CheckCircle2 className="size-3.5 text-green-400" />
                  : <XCircle className="size-3.5 text-muted-foreground" />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const { data: config } = useHubConfig();
  const saveMutation     = useHubConfigMutation();
  const [form, setForm]  = useState<Record<string, unknown>>({});

  const merged = { ...config, ...form };

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <GitBranch className="size-4" /> Routing Strategy
        </h3>
        <div className="space-y-1.5">
          <Select
            value={String(merged.routing_strategy ?? "smart")}
            onValueChange={(v) => set("routing_strategy", v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="smart">Smart (recommended)</SelectItem>
              <SelectItem value="priority">Priority order</SelectItem>
              <SelectItem value="least_latency">Least latency</SelectItem>
              <SelectItem value="cheapest">Cheapest first</SelectItem>
              <SelectItem value="round_robin">Round robin</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Smart routing weighs latency, cost, health, and priority to select the best provider.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="size-4" /> Failover & Health
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Automatic Failover</p>
            <p className="text-[11px] text-muted-foreground">Switch to next provider on failure</p>
          </div>
          <button
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              merged.failover_enabled ? "bg-primary" : "bg-muted"
            )}
            onClick={() => set("failover_enabled", !merged.failover_enabled)}
          >
            <span className={cn(
              "inline-block size-3.5 rounded-full bg-white shadow transition-transform",
              merged.failover_enabled ? "translate-x-4" : "translate-x-0.5"
            )} />
          </button>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Max consecutive failures before degraded</label>
          <Input
            type="number"
            value={Number(merged.max_consecutive_failures ?? 3)}
            onChange={(e) => set("max_consecutive_failures", parseInt(e.target.value))}
            min={1} max={20}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Health check interval (seconds)</label>
          <Input
            type="number"
            value={Number(merged.health_check_interval_sec ?? 60)}
            onChange={(e) => set("health_check_interval_sec", parseInt(e.target.value))}
            min={30} max={3600}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="size-4" /> Monitoring
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Cost Tracking</p>
            <p className="text-[11px] text-muted-foreground">Track estimated cost per request</p>
          </div>
          <button
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              merged.cost_tracking_enabled ? "bg-primary" : "bg-muted"
            )}
            onClick={() => set("cost_tracking_enabled", !merged.cost_tracking_enabled)}
          >
            <span className={cn(
              "inline-block size-3.5 rounded-full bg-white shadow transition-transform",
              merged.cost_tracking_enabled ? "translate-x-4" : "translate-x-0.5"
            )} />
          </button>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Metrics retention (hours)</label>
          <Input
            type="number"
            value={Number(merged.metrics_retention_hours ?? 168)}
            onChange={(e) => set("metrics_retention_hours", parseInt(e.target.value))}
            min={24} max={720}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate(merged as Parameters<typeof saveMutation.mutate>[0])}
        disabled={saveMutation.isPending || Object.keys(form).length === 0}
      >
        {saveMutation.isPending ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}

// ── Provider detail side-panel (metrics) ─────────────────────────────────────

function ProviderDetailPanel({ provider, onClose }: { provider: Provider; onClose: () => void }) {
  const { data: stats } = useProviderStats(provider.id, 24);
  const { data: series = [] } = useProviderTimeSeries(provider.id, 24);

  return (
    <div className="h-full overflow-y-auto border-l border-border bg-card/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{provider.name}</h3>
          <p className="text-xs text-muted-foreground font-mono">{provider.slug}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
      </div>
      <ProviderMetricsChart rows={series} stats={stats} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProviderHub() {
  const [tab,            setTab]            = useState("overview");
  const [search,         setSearch]         = useState("");
  const [typeFilter,     setTypeFilter]     = useState<ProviderType | "">("");
  const [addOpen,        setAddOpen]        = useState(false);
  const [editing,        setEditing]        = useState<Provider | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<Provider | null>(null);
  const [detailProvider, setDetailProvider] = useState<Provider | null>(null);

  const { data: providers = [], isLoading, refetch } = useProviders(typeFilter || undefined);
  const { create, update, remove, toggleStatus, setPriority, test } = useProviderMutations();

  const filtered = providers.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
  });

  const handleSave = (input: CreateProviderInput | { id: string; patch: UpdateProviderInput }) => {
    if ("id" in input) {
      update.mutate(input, { onSuccess: () => { setAddOpen(false); setEditing(null); } });
    } else {
      create.mutate(input, { onSuccess: () => setAddOpen(false) });
    }
  };

  const handlePriority = (p: Provider, dir: "up" | "down") => {
    const delta = dir === "up" ? -10 : 10;
    setPriority.mutate({ id: p.id, priority: Math.max(1, Math.min(100, p.priority + delta)) });
  };

  const providerCounts = {
    all:    providers.length,
    active: providers.filter((p) => p.status === "active").length,
    issue:  providers.filter((p) => ["degraded","error"].includes(p.status)).length,
  };

  return (
    <StudioLayout>
      <div className={cn(
        "flex h-full overflow-hidden",
        detailProvider ? "gap-0" : ""
      )}>
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Cpu className="size-5 text-primary" />
              <div>
                <h1 className="text-sm font-bold leading-tight">AI Provider Hub</h1>
                <p className="text-[10px] text-muted-foreground">
                  {providerCounts.active}/{providerCounts.all} active
                  {providerCounts.issue > 0 && (
                    <span className="ml-1 text-yellow-400">
                      · {providerCounts.issue} need attention
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8 gap-1">
                <RefreshCw className="size-3" />
                Refresh
              </Button>
              <Button size="sm" className="h-8 gap-1" onClick={() => { setEditing(null); setAddOpen(true); }}>
                <Plus className="size-3.5" />
                Add Provider
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
            <div className="border-b border-border px-4">
              <TabsList className="h-9 bg-transparent gap-1">
                {[
                  { value: "overview",  label: "Overview",   icon: Activity },
                  { value: "providers", label: "Providers",  icon: Cpu },
                  { value: "logs",      label: "Logs",       icon: Clock },
                  { value: "failovers", label: "Failovers",  icon: AlertTriangle },
                  { value: "settings",  label: "Settings",   icon: Settings },
                ].map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="h-8 gap-1.5 text-xs data-[state=active]:bg-background"
                  >
                    <Icon className="size-3" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-4">

              {/* Overview */}
              <TabsContent value="overview" className="mt-0">
                <ProviderHealthDashboard />
              </TabsContent>

              {/* Providers grid */}
              <TabsContent value="providers" className="mt-0 space-y-4">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-40">
                    <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search providers…"
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ProviderType | "")}>
                    <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder="All types" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All types</SelectItem>
                      {(Object.entries(PROVIDER_TYPE_LABELS) as [ProviderType, string][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="text-xs">
                    {filtered.length} providers
                  </Badge>
                </div>

                {/* Cards grid */}
                {isLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
                    No providers found
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setDetailProvider(p)}
                        className="cursor-pointer"
                      >
                        <ProviderCard
                          provider={p}
                          isTesting={test.isPending && test.variables === p.id}
                          onEdit={(pr) => { setEditing(pr); setAddOpen(true); }}
                          onDelete={setDeleteTarget}
                          onToggle={(pr, active) => toggleStatus.mutate({ id: pr.id, active })}
                          onTest={(pr) => test.mutate(pr.id)}
                          onPriority={handlePriority}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Logs */}
              <TabsContent value="logs" className="mt-0">
                <LogsTab />
              </TabsContent>

              {/* Failovers */}
              <TabsContent value="failovers" className="mt-0">
                <FailoversTab />
              </TabsContent>

              {/* Settings */}
              <TabsContent value="settings" className="mt-0">
                <SettingsTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Detail side panel */}
        {detailProvider && (
          <div className="w-96 shrink-0">
            <ProviderDetailPanel
              provider={detailProvider}
              onClose={() => setDetailProvider(null)}
            />
          </div>
        )}
      </div>

      {/* Add/Edit dialog */}
      <AddProviderDialog
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditing(null); }}
        onSave={handleSave}
        editing={editing}
        isPending={create.isPending || update.isPending}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete provider "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the provider and all its metrics data.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) { remove.mutate(deleteTarget.id); setDeleteTarget(null); } }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StudioLayout>
  );
}
