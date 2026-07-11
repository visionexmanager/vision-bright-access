import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AnimatedCounter } from "@/components/career/jobs/AnimatedCounter";

interface IntelStatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  trend?: number;
}

export function IntelStatCard({ icon: Icon, label, value, suffix, trend }: IntelStatCardProps) {
  return (
    <div className="intel-panel flex flex-col gap-2 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {typeof trend === "number" && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? "text-[hsl(var(--intel-positive))]" : "text-[hsl(var(--intel-negative))]"}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> : <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <AnimatedCounter value={value} className="text-2xl font-black" formatter={(v) => `${v.toLocaleString()}${suffix ?? ""}`} />
      <span className="intel-muted text-xs font-medium">{label}</span>
    </div>
  );
}
