import { MissionCard } from "./MissionCard";
import { MISSION_SCOPE_LABELS } from "./tierStyles";
import type { AcademyMissionScope } from "@/lib/types/academy-gamification";
import type { MissionWithProgress } from "@/lib/academy/gamificationLocalStore";

interface MissionsBoardProps {
  missions: MissionWithProgress[];
}

const SCOPE_ORDER: AcademyMissionScope[] = ["daily", "weekly", "monthly", "seasonal"];

export function MissionsBoard({ missions }: MissionsBoardProps) {
  const byScope = SCOPE_ORDER.map((scope) => ({
    scope,
    items: missions.filter((m) => m.mission.scope === scope),
  })).filter((g) => g.items.length > 0);

  if (byScope.length === 0) {
    return <p className="text-sm text-muted-foreground">لا توجد مهام متاحة حالياً.</p>;
  }

  return (
    <div className="space-y-6">
      {byScope.map((group) => (
        <div key={group.scope} className="space-y-3">
          <h3 className="text-sm font-black text-foreground">مهام {MISSION_SCOPE_LABELS[group.scope]}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.items.map((item) => (
              <MissionCard key={item.mission.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
