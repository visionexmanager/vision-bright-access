import { Star } from "lucide-react";
import type { AcademyLevelInfo } from "@/lib/academy/leveling";

interface LevelBadgeProps {
  levelInfo: AcademyLevelInfo;
  /** Show the rank title text next to the level number. Off by default for tight spaces (navbar/sidebar chips). */
  showRank?: boolean;
}

/** Compact level chip — for navbars, sidebars, profile headers. For the full progress panel see LevelProgressCard. */
export function LevelBadge({ levelInfo, showRank = false }: LevelBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-card ${levelInfo.rank.colorClass} border-current/30`}>
      <Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
      <span className="text-xs font-black">المستوى {levelInfo.level}</span>
      {showRank && <span className="text-xs font-medium opacity-80">· {levelInfo.rank.rank}</span>}
    </span>
  );
}
