import type { LucideIcon } from "lucide-react";

interface StatTileProps {
  icon: LucideIcon;
  value: number;
  label: string;
  className?: string;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function StatTile({ icon: Icon, value, label, className }: StatTileProps) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl border bg-card p-4 text-center ${className ?? ""}`}>
      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      <span className="text-xl font-bold" aria-label={`${value.toLocaleString()} ${label}`}>
        {formatCompact(value)}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
