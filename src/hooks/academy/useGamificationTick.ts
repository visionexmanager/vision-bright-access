/**
 * useAcademyGamificationTick — runs the gamification re-evaluation
 * (achievements/learning cards/streak/missions) once per page visit and
 * awards any newly-completed mission/streak-milestone XP through the
 * EXISTING award_academy_xp() bridge (see runGamificationTick's own docs).
 * Shared by the Achievements/Missions/Leaderboard pages so each one stays in
 * sync even if the unlocking activity happened on a different page.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAcademyProfile } from "./useAcademyProfile";
import { runGamificationTick, type GamificationTickResult } from "@/lib/academy/gamificationLocalStore";
import { awardAcademyXP } from "@/services/academy/academyService";
import type { AcademyXPReason } from "@/lib/types";

export function useAcademyGamificationTick() {
  const { user } = useAuth();
  const { profile } = useAcademyProfile();
  const [celebration, setCelebration] = useState<GamificationTickResult | null>(null);

  useEffect(() => {
    if (!user) return;
    const tick = runGamificationTick(user.id, profile?.xp_total ?? 0);

    const awardAll = async () => {
      await Promise.all(tick.missionXPReasonsToAward.map((reason) => awardAcademyXP(user.id, reason as AcademyXPReason)));
      if (tick.streakMilestone !== null) {
        await awardAcademyXP(user.id, "academy_streak_milestone");
      }
    };
    if (tick.missionXPReasonsToAward.length > 0 || tick.streakMilestone !== null) {
      awardAll();
    }

    if (tick.newAchievements.length > 0 || tick.newLearningCards.length > 0 || tick.streakMilestone !== null) {
      setCelebration(tick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { profile, celebration, dismissCelebration: () => setCelebration(null) };
}
