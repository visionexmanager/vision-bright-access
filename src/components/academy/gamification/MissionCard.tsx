import { CheckCircle2, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { MISSION_SCOPE_LABELS } from "./tierStyles";
import type { MissionWithProgress } from "@/lib/academy/gamificationLocalStore";

interface MissionCardProps {
  item: MissionWithProgress;
}

export function MissionCard({ item }: MissionCardProps) {
  const { mission, progress, completed } = item;
  const percent = Math.round((progress / mission.target_count) * 100);

  return (
    <div className={`p-4 rounded-2xl border space-y-2.5 ${completed ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg shrink-0 ${completed ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"}`} aria-hidden="true">
            {completed ? <CheckCircle2 className="w-4 h-4" /> : <Target className="w-4 h-4" />}
          </div>
          <p className="font-bold text-foreground text-sm truncate">{mission.title}</p>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground shrink-0 px-2 py-0.5 rounded-full bg-muted">
          {MISSION_SCOPE_LABELS[mission.scope]}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{mission.description}</p>
      <Progress value={percent} className="h-1.5" />
      <p className="text-[11px] text-muted-foreground">{progress} / {mission.target_count}</p>
    </div>
  );
}
