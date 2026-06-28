// Live global metrics strip — auto-refreshes every 5s via polling
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Activity, Zap, Users, TrendingUp, Clock, Shield } from "lucide-react";

interface GlobalMetrics {
  totalRPS:          number;
  p95LatencyMs:      number;
  activeUsers:       number;
  genPerMinute:      number;
  errorRatePct:      number;
  vxConsumedToday:   number;
  healthyRegions:    number;
  totalRegions:      number;
}

// Mock real-time data — replace with Prometheus API calls or SSE
function useLiveMetrics(): GlobalMetrics {
  const [metrics, setMetrics] = useState<GlobalMetrics>({
    totalRPS:        18593,
    p95LatencyMs:    187,
    activeUsers:     142_330,
    genPerMinute:    2847,
    errorRatePct:    0.12,
    vxConsumedToday: 14_820_000,
    healthyRegions:  4,
    totalRegions:    5,
  });

  useEffect(() => {
    const id = setInterval(() => {
      setMetrics((m) => ({
        totalRPS:        m.totalRPS        + Math.round((Math.random() - 0.5) * 300),
        p95LatencyMs:    Math.max(80, m.p95LatencyMs + Math.round((Math.random() - 0.5) * 20)),
        activeUsers:     m.activeUsers     + Math.round((Math.random() - 0.5) * 500),
        genPerMinute:    m.genPerMinute    + Math.round((Math.random() - 0.5) * 100),
        errorRatePct:    Math.max(0, Math.min(5, m.errorRatePct + (Math.random() - 0.5) * 0.05)),
        vxConsumedToday: m.vxConsumedToday + Math.round(Math.random() * 10000),
        healthyRegions:  4,
        totalRegions:    5,
      }));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return metrics;
}

interface Chip {
  label:    string;
  value:    string;
  icon:     React.ElementType;
  warn?:    boolean;
  critical?: boolean;
}

export function LiveMetricsBar() {
  const m = useLiveMetrics();

  const chips: Chip[] = [
    { label: "Global RPS",    value: m.totalRPS.toLocaleString(),                     icon: Activity },
    { label: "P95 Latency",   value: `${m.p95LatencyMs}ms`,                           icon: Clock,        warn: m.p95LatencyMs > 500,  critical: m.p95LatencyMs > 2000 },
    { label: "Active Users",  value: m.activeUsers.toLocaleString(),                   icon: Users },
    { label: "Gens/min",      value: m.genPerMinute.toLocaleString(),                  icon: Zap },
    { label: "Error Rate",    value: `${m.errorRatePct.toFixed(2)}%`,                  icon: TrendingUp,   warn: m.errorRatePct > 1,    critical: m.errorRatePct > 5 },
    { label: "VX Today",      value: `${(m.vxConsumedToday / 1_000_000).toFixed(1)}M`, icon: TrendingUp },
    { label: "Regions",       value: `${m.healthyRegions}/${m.totalRegions}`,          icon: Shield,       warn: m.healthyRegions < m.totalRegions, critical: m.healthyRegions < 3 },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <div
            key={chip.label}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
              chip.critical ? "border-red-500/40 bg-red-500/10"
              : chip.warn   ? "border-yellow-500/40 bg-yellow-500/10"
              :                "border-border bg-card"
            )}
          >
            <Icon className={cn(
              "size-3.5",
              chip.critical ? "text-red-400" : chip.warn ? "text-yellow-400" : "text-muted-foreground"
            )} />
            <span className="text-muted-foreground">{chip.label}</span>
            <span className={cn(
              "font-mono font-bold",
              chip.critical ? "text-red-400" : chip.warn ? "text-yellow-400" : "text-foreground"
            )}>
              {chip.value}
            </span>
          </div>
        );
      })}
      {/* Live dot */}
      <div className="flex items-center gap-1.5 ml-auto text-[10px] text-green-400">
        <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
        LIVE
      </div>
    </div>
  );
}
