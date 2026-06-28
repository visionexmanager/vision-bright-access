import { cn } from "@/lib/utils";
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  TrendingUp, Zap, DollarSign, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProviders } from "@/hooks/useProviders";
import { useAllProviderStats } from "@/hooks/useProviderMetrics";
import { useHealthCheck } from "@/hooks/useProviderHealth";
import { PROVIDER_TYPE_LABELS, STATUS_BG } from "@/lib/types/provider-hub";
import type { Provider } from "@/lib/types/provider-hub";

interface TrafficBarProps {
  providers: Provider[];
  stats:     Record<string, { total_requests?: number }>;
}

function TrafficBar({ providers, stats }: TrafficBarProps) {
  const total = providers.reduce(
    (sum, p) => sum + (stats[p.slug]?.total_requests ?? 0), 0
  );
  if (total === 0) return <p className="text-xs text-muted-foreground">No traffic recorded yet.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{total.toLocaleString()} total requests (24h)</p>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
        {providers
          .filter((p) => (stats[p.slug]?.total_requests ?? 0) > 0)
          .map((p, i) => {
            const req = stats[p.slug]?.total_requests ?? 0;
            const pct = (req / total) * 100;
            const colors = [
              "bg-primary", "bg-blue-500", "bg-purple-500",
              "bg-green-500", "bg-yellow-500", "bg-red-500",
            ];
            return (
              <div
                key={p.slug}
                className={cn("h-full transition-all", colors[i % colors.length])}
                style={{ width: `${pct}%` }}
                title={`${p.name}: ${req} requests (${pct.toFixed(1)}%)`}
              />
            );
          })
        }
      </div>
      <div className="flex flex-wrap gap-2">
        {providers
          .filter((p) => (stats[p.slug]?.total_requests ?? 0) > 0)
          .map((p, i) => {
            const req  = stats[p.slug]?.total_requests ?? 0;
            const pct  = ((req / total) * 100).toFixed(1);
            const colors = ["bg-primary","bg-blue-500","bg-purple-500","bg-green-500","bg-yellow-500","bg-red-500"];
            return (
              <div key={p.slug} className="flex items-center gap-1.5">
                <div className={cn("size-2 rounded-sm", colors[i % colors.length])} />
                <span className="text-[10px] text-muted-foreground">
                  {p.name}: {pct}%
                </span>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex gap-3 items-start">
      <div className={cn("rounded-lg p-2", color)}>
        <Icon className="size-4 text-white" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold leading-none mt-0.5">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

export function ProviderHealthDashboard() {
  const { data: providers = [] } = useProviders();
  const { data: allStats  = {} } = useAllProviderStats(24);
  const { check }               = useHealthCheck();

  const active   = providers.filter((p) => p.status === "active").length;
  const degraded = providers.filter((p) => p.status === "degraded").length;
  const inactive = providers.filter((p) => p.status === "inactive").length;
  const total    = providers.length;

  const totalReq  = Object.values(allStats).reduce((s, v: any) => s + (v?.total_requests ?? 0), 0);
  const totalCost = Object.values(allStats).reduce((s, v: any) => s + (v?.total_cost_usd ?? 0), 0);
  const avgHealth = providers.length
    ? (providers.reduce((s, p) => s + p.health_score, 0) / providers.length).toFixed(0)
    : "—";

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon={CheckCircle2} label="Active Providers"
          value={`${active}/${total}`}
          sub={`${degraded} degraded, ${inactive} inactive`}
          color="bg-green-500"
        />
        <SummaryCard
          icon={Activity} label="Avg Health Score"
          value={`${avgHealth}%`}
          sub="across all providers"
          color="bg-blue-500"
        />
        <SummaryCard
          icon={Zap} label="Requests (24h)"
          value={totalReq.toLocaleString()}
          sub="all providers combined"
          color="bg-purple-500"
        />
        <SummaryCard
          icon={DollarSign} label="Cost (24h)"
          value={totalCost > 0 ? `$${totalCost.toFixed(4)}` : "$0.00"}
          sub="estimated"
          color="bg-orange-500"
        />
      </div>

      {/* Status grid */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Provider Status</h3>
          <Button
            size="sm" variant="outline"
            onClick={() => check.mutate(undefined)}
            disabled={check.isPending}
            className="gap-1.5 h-7"
          >
            <RefreshCw className={cn("size-3", check.isPending && "animate-spin")} />
            {check.isPending ? "Checking…" : "Run Health Check"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => {
            const s = allStats[p.slug] as any;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                  p.status === "active"   && "border-green-500/20 bg-green-500/5",
                  p.status === "degraded" && "border-yellow-500/20 bg-yellow-500/5",
                  p.status === "inactive" && "border-border bg-muted/30 opacity-60",
                  p.status === "error"    && "border-red-500/20 bg-red-500/5",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {p.status === "active"   && <CheckCircle2 className="size-3.5 text-green-400 shrink-0" />}
                  {p.status === "degraded" && <AlertTriangle className="size-3.5 text-yellow-400 shrink-0" />}
                  {p.status === "inactive" && <XCircle       className="size-3.5 text-gray-400 shrink-0" />}
                  {p.status === "error"    && <XCircle       className="size-3.5 text-red-400 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium text-xs truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {PROVIDER_TYPE_LABELS[p.type]}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-[10px] font-medium">{p.health_score.toFixed(0)}%</p>
                  <p className="text-[9px] text-muted-foreground">
                    {s?.total_requests > 0 ? `${s.total_requests} req` : "no traffic"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Traffic distribution */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Traffic Distribution (24h)</h3>
        {/* Group by type */}
        {(["tts", "voice_cloning", "text_to_video"] as const).map((type) => {
          const group = providers.filter((p) => p.type === type);
          if (group.length === 0) return null;
          return (
            <div key={type} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {PROVIDER_TYPE_LABELS[type]}
              </p>
              <TrafficBar providers={group} stats={allStats as any} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
