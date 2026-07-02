import { X, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveAchievementIcon } from "./achievementIcons";
import type { AcademyAchievementDef, AcademyLearningCardDef } from "@/lib/types/academy-gamification";

interface CelebrationBannerProps {
  achievements: AcademyAchievementDef[];
  learningCards: AcademyLearningCardDef[];
  streakMilestone: number | null;
  onDismiss: () => void;
}

/** Compact, dismissible celebration stack shown after a completion event —
 * same visual language as the existing certificate-earned banner. */
export function CelebrationBanner({ achievements, learningCards, streakMilestone, onDismiss }: CelebrationBannerProps) {
  if (achievements.length === 0 && learningCards.length === 0 && streakMilestone === null) return null;

  return (
    <div role="status" aria-live="polite" className="space-y-2">
      {achievements.map((a) => {
        const Icon = resolveAchievementIcon(a.icon);
        return (
          <div key={a.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-br from-yellow-400/10 to-primary/5 border border-yellow-400/30 flex-wrap">
            <span className="flex items-center gap-2 font-bold text-foreground">
              <Icon className="w-5 h-5 text-yellow-500" aria-hidden="true" />
              🏆 إنجاز جديد: {a.title}
            </span>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onDismiss} aria-label="إغلاق"><X className="w-4 h-4" /></Button>
          </div>
        );
      })}
      {learningCards.map((c) => {
        const Icon = resolveAchievementIcon(c.icon);
        return (
          <div key={c.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-br from-purple-400/10 to-primary/5 border border-purple-400/30 flex-wrap">
            <span className="flex items-center gap-2 font-bold text-foreground">
              <Icon className="w-5 h-5 text-purple-500" aria-hidden="true" />
              🎴 بطاقة جديدة: {c.title}
            </span>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onDismiss} aria-label="إغلاق"><X className="w-4 h-4" /></Button>
          </div>
        );
      })}
      {streakMilestone !== null && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-br from-orange-400/10 to-primary/5 border border-orange-400/30 flex-wrap">
          <span className="flex items-center gap-2 font-bold text-foreground">
            <Flame className="w-5 h-5 text-orange-500" aria-hidden="true" />
            🔥 تتابع {streakMilestone} يوماً!
          </span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onDismiss} aria-label="إغلاق"><X className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
