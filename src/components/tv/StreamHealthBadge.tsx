/**
 * StreamHealthBadge
 *
 * Shows a compact reliability indicator (score 0–100) for a channel.
 * Used in the channel list sidebar during playback to indicate source quality.
 *
 * Score thresholds:
 *   ≥80 → green  (Good)
 *   ≥50 → yellow (Fair)
 *   <50  → red   (Poor)
 */

import { Signal } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  score: number;  // 0–100
  showLabel?: boolean;
  className?: string;
}

export function StreamHealthBadge({ score, showLabel = false, className }: Props) {
  const color = score >= 80 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
  const label = score >= 80 ? "Good"            : score >= 50 ? "Fair"            : "Poor";
  const bars  = score >= 80 ? 3                 : score >= 50 ? 2                 : 1;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-end gap-px h-3">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={cn(
              "w-[3px] rounded-sm transition-colors",
              i <= bars ? color : "bg-muted-foreground/20"
            )}
            style={{ height: `${i * 33}%` }}
          />
        ))}
      </div>
      {showLabel && (
        <span className={cn("text-[10px] font-medium", color)}>{label}</span>
      )}
    </div>
  );
}

export function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#4ade80" : score >= 50 ? "#facc15" : "#f87171";
  const r = 8, c = 10;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <svg width={c * 2} height={c * 2} viewBox={`0 0 ${c * 2} ${c * 2}`} className="flex-shrink-0">
      <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={3}
        className="text-muted/30" />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`} />
      <text x={c} y={c + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={6} fontWeight="bold" fill={color}>
        {score}
      </text>
    </svg>
  );
}
