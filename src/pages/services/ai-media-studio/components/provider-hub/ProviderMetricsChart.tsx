// Metrics visualization — no external charting dependency
// Uses CSS bar charts for minimal footprint

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ProviderMetricRow, ProviderStats } from "@/lib/types/provider-hub";

interface ProviderMetricsChartProps {
  rows:    ProviderMetricRow[];
  stats?:  ProviderStats;
  height?: number;
}

function SparkBar({ value, max, colorClass }: {
  value: number; max: number; colorClass: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex flex-col items-center justify-end" style={{ height: 48 }}>
      <div
        className={cn("w-full rounded-t-sm min-h-[2px] transition-all", colorClass)}
        style={{ height: `${pct}%` }}
      />
    </div>
  );
}

function StatBox({ label, value, sub, trend }: {
  label: string; value: string; sub?: string;
  trend?: "up" | "down" | "flat";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold leading-none tabular-nums">{value}</p>
      {(sub || trend) && (
        <div className="flex items-center gap-1">
          {trend === "up"   && <TrendingUp   className="size-3 text-green-400" />}
          {trend === "down" && <TrendingDown  className="size-3 text-red-400" />}
          {trend === "flat" && <Minus         className="size-3 text-muted-foreground" />}
          {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        </div>
      )}
    </div>
  );
}

export function ProviderMetricsChart({ rows, stats }: ProviderMetricsChartProps) {
  const recent = rows.slice(-30); // last 30 data points
  const maxReq = Math.max(...recent.map((r) => r.requests), 1);

  const totalReq  = stats?.total_requests  ?? 0;
  const totalFail = stats?.total_failures  ?? 0;
  const avgLat    = stats?.avg_latency_ms  ?? 0;
  const costTotal = stats?.total_cost_usd  ?? 0;
  const rate      = stats?.success_rate    ?? 100;

  return (
    <div className="space-y-4">
      {/* Stat boxes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox
          label="Requests (24h)"
          value={totalReq.toLocaleString()}
          sub="total calls"
        />
        <StatBox
          label="Success Rate"
          value={`${rate.toFixed(1)}%`}
          sub={`${totalFail} failures`}
          trend={rate >= 95 ? "up" : rate >= 80 ? "flat" : "down"}
        />
        <StatBox
          label="Avg Latency"
          value={avgLat > 0 ? `${avgLat}ms` : "—"}
          sub="per request"
          trend={avgLat < 500 ? "up" : avgLat < 1500 ? "flat" : "down"}
        />
        <StatBox
          label="Cost (24h)"
          value={costTotal > 0 ? `$${costTotal.toFixed(4)}` : "$0.00"}
          sub="estimated"
        />
      </div>

      {/* Sparkline bar chart */}
      {recent.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Requests per minute — last {recent.length} periods
          </p>
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `repeat(${recent.length}, 1fr)` }}
          >
            {recent.map((row, i) => (
              <div key={i} title={`${row.requests} requests at ${new Date(row.period_start).toLocaleTimeString()}`}>
                <SparkBar
                  value={row.requests}
                  max={maxReq}
                  colorClass={
                    row.failures > 0 && row.failures === row.requests
                      ? "bg-red-500"
                      : row.failures > 0
                      ? "bg-yellow-500"
                      : "bg-primary"
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-4 text-[9px] text-muted-foreground">
            <div className="flex items-center gap-1"><span className="size-2 rounded-sm bg-primary inline-block" /> Success</div>
            <div className="flex items-center gap-1"><span className="size-2 rounded-sm bg-yellow-500 inline-block" /> Partial</div>
            <div className="flex items-center gap-1"><span className="size-2 rounded-sm bg-red-500 inline-block" /> All failed</div>
          </div>
        </div>
      )}

      {/* Failure breakdown */}
      {totalFail > 0 && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
          <p className="text-xs font-medium text-yellow-400 mb-1">Failure breakdown</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-red-500"
                style={{ width: `${(totalFail / Math.max(totalReq, 1)) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {totalFail}/{totalReq} ({((totalFail / Math.max(totalReq, 1)) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
