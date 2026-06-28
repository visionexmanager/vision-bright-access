import { useState } from "react";
import { cn } from "@/lib/utils";
import { Bell, CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AlertSeverity = "critical" | "warning" | "info" | "resolved";

export interface SystemAlert {
  id:        string;
  severity:  AlertSeverity;
  title:     string;
  message:   string;
  region?:   string;
  service?:  string;
  timestamp: string;
  resolved?: boolean;
}

const MOCK_ALERTS: SystemAlert[] = [
  {
    id: "1", severity: "warning",
    title:   "High queue depth in US-West",
    message: "AI generation queue at 221 jobs. Auto-scaling engaged — workers scaling up.",
    region: "us_west", service: "ai-worker", timestamp: new Date(Date.now() - 180_000).toISOString(),
  },
  {
    id: "2", severity: "info",
    title:   "Luma AI latency elevated",
    message: "Luma Dream Machine avg latency increased to 8,400ms. Smart router is deprioritizing.",
    service: "provider-hub", timestamp: new Date(Date.now() - 900_000).toISOString(),
  },
  {
    id: "3", severity: "resolved",
    title:   "Redis memory pressure — RESOLVED",
    message: "Redis memory usage dropped to 61% after LRU eviction completed.",
    region: "europe", service: "redis", timestamp: new Date(Date.now() - 3_600_000).toISOString(),
    resolved: true,
  },
];

const SEVERITY_ICON: Record<AlertSeverity, React.ReactNode> = {
  critical: <XCircle      className="size-4 text-red-400 shrink-0" />,
  warning:  <AlertTriangle className="size-4 text-yellow-400 shrink-0" />,
  info:     <Info          className="size-4 text-blue-400 shrink-0" />,
  resolved: <CheckCircle2  className="size-4 text-green-400 shrink-0" />,
};

const SEVERITY_BG: Record<AlertSeverity, string> = {
  critical: "border-red-500/30    bg-red-500/5",
  warning:  "border-yellow-500/30 bg-yellow-500/5",
  info:     "border-blue-500/30   bg-blue-500/5",
  resolved: "border-green-500/20  bg-transparent opacity-60",
};

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  critical: "bg-red-500/15    text-red-400",
  warning:  "bg-yellow-500/15 text-yellow-400",
  info:     "bg-blue-500/15   text-blue-400",
  resolved: "bg-green-500/15  text-green-400",
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)       return `${Math.floor(diff / 1_000)}s ago`;
  if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface Props {
  alerts?: SystemAlert[];
}

export function AlertsFeed({ alerts = MOCK_ALERTS }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filter, setFilter]       = useState<AlertSeverity | "all">("all");

  const visible = alerts.filter((a) =>
    !dismissed.has(a.id) &&
    (filter === "all" || a.severity === filter)
  );

  const criticalCount = alerts.filter((a) => a.severity === "critical" && !a.resolved).length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="size-4" />
          <span className="text-sm font-semibold">System Alerts</span>
          {criticalCount > 0 && (
            <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 animate-pulse">
              {criticalCount} critical
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          {(["all", "critical", "warning", "info", "resolved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full transition-colors capitalize",
                filter === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-border py-8 text-xs text-muted-foreground">
            <CheckCircle2 className="size-4 text-green-400" />
            No active alerts
          </div>
        ) : visible.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              "rounded-lg border px-3 py-2.5 flex items-start gap-3",
              SEVERITY_BG[alert.severity]
            )}
          >
            {SEVERITY_ICON[alert.severity]}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-semibold">{alert.title}</p>
                <Badge className={cn("text-[10px] px-1.5 py-0 capitalize", SEVERITY_BADGE[alert.severity])}>
                  {alert.severity}
                </Badge>
                {alert.region && (
                  <span className="text-[10px] text-muted-foreground">{alert.region}</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{alert.message}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(alert.timestamp)}</p>
            </div>
            <button
              onClick={() => setDismissed((d) => new Set([...d, alert.id]))}
              className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
