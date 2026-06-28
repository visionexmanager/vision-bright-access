// Usage analytics — CSS-only chart, no external dependency
import { cn } from "@/lib/utils";
import { useUsageLogs } from "@/hooks/useCredits";
import { OPERATION_ICONS, OPERATION_LABELS, VX_COSTS } from "@/lib/types/billing";
import type { OperationType } from "@/lib/types/billing";

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn("text-2xl font-bold mt-1 tabular-nums", color)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SparkRow({ type, count, totalOps }: { type: OperationType; count: number; totalOps: number }) {
  const pct = totalOps > 0 ? (count / totalOps) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg w-6">{OPERATION_ICONS[type]}</span>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span>{OPERATION_LABELS[type]}</span>
          <span className="text-muted-foreground">{count} ops · {(count * VX_COSTS[type]).toLocaleString()} VX</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function UsageChart() {
  const { data: logs = [], isLoading } = useUsageLogs({ limit: 500, hours: 720 });

  const totalOps     = logs.filter((l) => l.status === "success").length;
  const totalCredits = logs.reduce((s, l) => s + (l.credits_used ?? 0), 0);
  const last24h      = logs.filter((l) => new Date(l.created_at) > new Date(Date.now() - 86_400_000)).length;
  const refunded     = logs.filter((l) => l.status === "refunded").length;

  const byType = {
    tts:           logs.filter((l) => l.operation_type === "tts" && l.status === "success").length,
    voice_cloning: logs.filter((l) => l.operation_type === "voice_cloning" && l.status === "success").length,
    text_to_video: logs.filter((l) => l.operation_type === "text_to_video" && l.status === "success").length,
  };

  // Daily breakdown (last 14 days)
  const dailyCounts: Record<string, number> = {};
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyCounts[key] = 0;
  }
  logs.filter((l) => l.status === "success").forEach((l) => {
    const key = l.created_at.slice(0, 10);
    if (key in dailyCounts) dailyCounts[key]++;
  });

  const dailyKeys   = Object.keys(dailyCounts);
  const maxDaily    = Math.max(...Object.values(dailyCounts), 1);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Operations" value={totalOps.toLocaleString()} sub="all time" />
        <StatCard label="VX Consumed"      value={totalCredits.toLocaleString()} sub="all time" color="text-amber-400" />
        <StatCard label="Last 24 Hours"    value={last24h} sub="operations" />
        <StatCard label="Refunded"         value={refunded} sub="operations" color={refunded > 0 ? "text-blue-400" : undefined} />
      </div>

      {/* Daily bar chart */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">Daily operations — last 14 days</p>
        {isLoading ? (
          <div className="h-16 animate-pulse bg-muted rounded" />
        ) : (
          <div className="flex items-end gap-1 h-16">
            {dailyKeys.map((day) => {
              const count = dailyCounts[day] ?? 0;
              const pct   = (count / maxDaily) * 100;
              const label = new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${label}: ${count} ops`}>
                  <div className="w-full flex items-end justify-center" style={{ height: 56 }}>
                    <div
                      className="w-full rounded-t bg-primary opacity-70 group-hover:opacity-100 transition-all min-h-[2px]"
                      style={{ height: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-muted-foreground rotate-45 origin-left translate-x-1 hidden sm:block">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* By operation type */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Operations by type (30d)</p>
        {(["tts", "voice_cloning", "text_to_video"] as OperationType[]).map((type) => (
          <SparkRow key={type} type={type} count={byType[type]} totalOps={totalOps} />
        ))}
        {totalOps === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No operations yet</p>
        )}
      </div>
    </div>
  );
}
