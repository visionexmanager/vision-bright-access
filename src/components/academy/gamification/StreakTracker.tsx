import { Flame, Trophy, Snowflake } from "lucide-react";
import { STREAK_MILESTONES, type AcademyStreakRow } from "@/lib/types/academy-gamification";

interface StreakTrackerProps {
  streak: AcademyStreakRow;
}

export function StreakTracker({ streak }: StreakTrackerProps) {
  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak.current_streak_days) ?? null;

  return (
    <div className="bg-card p-6 rounded-2xl border border-border space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-500 shrink-0" aria-hidden="true">
          <Flame className="w-6 h-6" />
        </div>
        <div>
          <p className="text-2xl font-black text-foreground">{streak.current_streak_days} يوماً</p>
          <p className="text-xs text-muted-foreground">تتابع التعلّم الحالي</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-yellow-500" aria-hidden="true" />الأطول: {streak.longest_streak_days} يوماً</span>
        <span className="flex items-center gap-1.5"><Snowflake className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />تجميد متاح: {streak.freeze_tokens_available}</span>
      </div>

      <ul className="flex items-center gap-2 flex-wrap" aria-label="محطات التتابع">
        {STREAK_MILESTONES.map((m) => {
          const reached = streak.current_streak_days >= m;
          return (
            <li
              key={m}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                reached ? "bg-orange-500/10 border-orange-500/30 text-orange-500" : "border-dashed border-border text-muted-foreground"
              }`}
            >
              {m} يوم
            </li>
          );
        })}
      </ul>

      {nextMilestone !== null && (
        <p className="text-xs text-muted-foreground">
          {nextMilestone - streak.current_streak_days} يوماً حتى محطة {nextMilestone} يوم
        </p>
      )}
    </div>
  );
}
