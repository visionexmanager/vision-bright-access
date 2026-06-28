import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  MoreVertical, Activity, AlertTriangle, CheckCircle2, XCircle,
  Zap, DollarSign, Clock, ToggleLeft, ToggleRight, FlaskConical,
  Trash2, Pencil, ArrowUp, ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PROVIDER_TYPE_LABELS, PROVIDER_TYPE_ICONS,
  STATUS_BG,
} from "@/lib/types/provider-hub";
import type { Provider, ProviderStats } from "@/lib/types/provider-hub";

interface ProviderCardProps {
  provider:    Provider;
  stats?:      ProviderStats;
  onEdit?:     (p: Provider) => void;
  onDelete?:   (p: Provider) => void;
  onToggle?:   (p: Provider, active: boolean) => void;
  onTest?:     (p: Provider) => void;
  onPriority?: (p: Provider, dir: "up" | "down") => void;
  isTesting?:  boolean;
}

const STATUS_ICON = {
  active:   CheckCircle2,
  inactive: XCircle,
  degraded: AlertTriangle,
  error:    XCircle,
};

function StatPill({ icon: Icon, label, value, warn = false }: {
  icon: React.ElementType; label: string; value: string; warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn("size-3", warn ? "text-yellow-400" : "text-muted-foreground")} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn("text-[10px] font-medium", warn && "text-yellow-400")}>{value}</span>
    </div>
  );
}

export function ProviderCard({
  provider, stats, onEdit, onDelete, onToggle, onTest, onPriority, isTesting,
}: ProviderCardProps) {
  const StatusIcon = STATUS_ICON[provider.status] ?? XCircle;
  const isActive   = provider.status === "active";
  const isDegraded = provider.status === "degraded";

  const successRate = stats?.success_rate ?? provider.success_rate ?? 100;
  const latency     = stats?.avg_latency_ms ?? provider.avg_latency_ms ?? 0;
  const totalReq    = stats?.total_requests ?? 0;
  const costTotal   = stats?.total_cost_usd ?? 0;

  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 transition-shadow hover:shadow-md",
      provider.status === "error"    && "border-red-500/30",
      provider.status === "degraded" && "border-yellow-500/30",
      provider.status === "active"   && "border-border",
      provider.status === "inactive" && "border-border opacity-60",
    )}>
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="text-2xl leading-none mt-0.5">
            {PROVIDER_TYPE_ICONS[provider.type]}
          </span>
          <div>
            <p className="font-semibold leading-tight">{provider.name}</p>
            <p className="text-[11px] text-muted-foreground font-mono">{provider.slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge className={cn("text-[10px]", STATUS_BG[provider.status])}>
            <StatusIcon className="mr-1 size-2.5" />
            {provider.status}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-7">
                <MoreVertical className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(provider)}>
                <Pencil className="mr-2 size-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onTest?.(provider)}
                disabled={isTesting}
              >
                <FlaskConical className="mr-2 size-3.5" />
                {isTesting ? "Testing…" : "Test connection"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onPriority?.(provider, "up")}>
                <ArrowUp className="mr-2 size-3.5" /> Increase priority
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPriority?.(provider, "down")}>
                <ArrowDown className="mr-2 size-3.5" /> Decrease priority
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onToggle?.(provider, !isActive)}
              >
                {isActive
                  ? <><ToggleLeft className="mr-2 size-3.5" /> Disable</>
                  : <><ToggleRight className="mr-2 size-3.5" /> Enable</>
                }
              </DropdownMenuItem>
              {!provider.is_system && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete?.(provider)}
                  >
                    <Trash2 className="mr-2 size-3.5" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Type + priority */}
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {PROVIDER_TYPE_LABELS[provider.type]}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          Priority: <span className="font-medium text-foreground">{provider.priority}</span>
        </span>
        {provider.is_system && (
          <Badge variant="secondary" className="text-[10px]">System</Badge>
        )}
        {provider.api_key_ref && (
          <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/30">
            🔑 Configured
          </Badge>
        )}
      </div>

      {/* Health score bar */}
      <div className="mb-3 space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Health Score</span>
          <span className={cn(
            "font-medium",
            provider.health_score >= 80 && "text-green-400",
            provider.health_score >= 50 && provider.health_score < 80 && "text-yellow-400",
            provider.health_score < 50  && "text-red-400",
          )}>
            {provider.health_score.toFixed(0)}%
          </span>
        </div>
        <Progress
          value={provider.health_score}
          className={cn(
            "h-1.5",
            provider.health_score >= 80 && "[&>div]:bg-green-500",
            provider.health_score >= 50 && provider.health_score < 80 && "[&>div]:bg-yellow-500",
            provider.health_score < 50  && "[&>div]:bg-red-500",
          )}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <StatPill
          icon={Activity}
          label="Success"
          value={`${successRate.toFixed(1)}%`}
          warn={successRate < 90}
        />
        <StatPill
          icon={Clock}
          label="Latency"
          value={latency > 0 ? `${latency}ms` : "—"}
          warn={latency > 2000}
        />
        <StatPill
          icon={Zap}
          label="Requests"
          value={totalReq > 0 ? totalReq.toLocaleString() : "—"}
        />
        <StatPill
          icon={DollarSign}
          label="Cost 24h"
          value={costTotal > 0 ? `$${costTotal.toFixed(4)}` : "—"}
        />
      </div>

      {/* Capabilities */}
      {provider.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {provider.capabilities.slice(0, 4).map((c) => (
            <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {c}
            </span>
          ))}
          {provider.capabilities.length > 4 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
              +{provider.capabilities.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Degraded warning */}
      {isDegraded && provider.consecutive_failures > 0 && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-yellow-500/10 px-2 py-1.5">
          <AlertTriangle className="size-3 text-yellow-400" />
          <span className="text-[10px] text-yellow-400">
            {provider.consecutive_failures} consecutive failures
          </span>
        </div>
      )}
    </div>
  );
}
