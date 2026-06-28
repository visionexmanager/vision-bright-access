import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, Activity } from "lucide-react";

export interface RegionStatus {
  id:           string;
  label:        string;
  flag:         string;
  health:       number;          // 0-100
  rps:          number;
  latencyP95ms: number;
  workers:      number;
  queueDepth:   number;
  status:       "healthy" | "degraded" | "down";
  uptime:       string;
}

const MOCK_REGIONS: RegionStatus[] = [
  { id: "europe",      label: "Europe (EU-W1)",     flag: "🇪🇺", health: 99, rps: 4230, latencyP95ms: 142, workers: 12, queueDepth: 34,   status: "healthy",  uptime: "99.98%" },
  { id: "middle_east", label: "Middle East (ME-C1)", flag: "🇦🇪", health: 97, rps: 1840, latencyP95ms: 189, workers: 6,  queueDepth: 12,   status: "healthy",  uptime: "99.91%" },
  { id: "us_east",     label: "US East (USE1)",      flag: "🇺🇸", health: 100,rps: 6102, latencyP95ms: 118, workers: 18, queueDepth: 58,   status: "healthy",  uptime: "100%"   },
  { id: "us_west",     label: "US West (USW1)",      flag: "🇺🇸", health: 82, rps: 3471, latencyP95ms: 310, workers: 10, queueDepth: 221,  status: "degraded", uptime: "99.71%" },
  { id: "asia",        label: "Asia (AS-E1)",         flag: "🇯🇵", health: 99, rps: 2950, latencyP95ms: 156, workers: 9,  queueDepth: 27,   status: "healthy",  uptime: "99.94%" },
];

const STATUS_ICON = {
  healthy:  <CheckCircle2 className="size-4 text-green-400" />,
  degraded: <AlertTriangle className="size-4 text-yellow-400" />,
  down:     <XCircle className="size-4 text-red-400" />,
};

const STATUS_RING = {
  healthy:  "border-green-500/40  bg-green-500/5",
  degraded: "border-yellow-500/40 bg-yellow-500/5",
  down:     "border-red-500/40    bg-red-500/5",
};

const HEALTH_BAR = {
  healthy:  "bg-green-500",
  degraded: "bg-yellow-500",
  down:     "bg-red-500",
};

interface Props {
  regions?: RegionStatus[];
}

export function RegionStatusMap({ regions = MOCK_REGIONS }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {regions.map((r) => (
          <div
            key={r.id}
            className={cn(
              "rounded-xl border p-4 space-y-3 transition-all",
              STATUS_RING[r.status]
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xl">{r.flag}</span>
                <p className="text-xs font-semibold mt-0.5 leading-tight">{r.label}</p>
              </div>
              {STATUS_ICON[r.status]}
            </div>

            {/* Health bar */}
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Health</span>
                <span className="font-mono">{r.health}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", HEALTH_BAR[r.status])}
                  style={{ width: `${r.health}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
              <div>
                <p className="text-muted-foreground">RPS</p>
                <p className="font-mono font-semibold">{r.rps.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">P95 Latency</p>
                <p className={cn("font-mono font-semibold", r.latencyP95ms > 250 ? "text-yellow-400" : "")}>
                  {r.latencyP95ms}ms
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Workers</p>
                <p className="font-mono font-semibold">{r.workers}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Queue</p>
                <p className={cn("font-mono font-semibold", r.queueDepth > 100 ? "text-yellow-400" : "")}>
                  {r.queueDepth}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Uptime (30d)</p>
                <p className="font-mono font-semibold text-green-400">{r.uptime}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Global aggregate */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <Activity className="size-4 text-primary shrink-0" />
        <span className="text-muted-foreground text-xs">
          Global RPS: <span className="font-bold text-foreground">
            {regions.reduce((s, r) => s + r.rps, 0).toLocaleString()}
          </span>
        </span>
        <span className="text-muted-foreground text-xs">
          Avg P95: <span className="font-bold text-foreground">
            {Math.round(regions.reduce((s, r) => s + r.latencyP95ms, 0) / regions.length)}ms
          </span>
        </span>
        <span className="text-muted-foreground text-xs">
          Total workers: <span className="font-bold text-foreground">
            {regions.reduce((s, r) => s + r.workers, 0)}
          </span>
        </span>
        <span className="text-muted-foreground text-xs ml-auto">
          {regions.filter((r) => r.status === "healthy").length}/{regions.length} regions healthy
        </span>
      </div>
    </div>
  );
}
