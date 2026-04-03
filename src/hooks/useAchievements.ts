import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AchievementDef {
  key: string;
  titleKey: string;
  descKey: string;
  icon: string;
  threshold: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_sim", titleKey: "ach.firstSim", descKey: "ach.firstSimDesc", icon: "🚀", threshold: 1 },
  { key: "sim_5", titleKey: "ach.sim5", descKey: "ach.sim5Desc", icon: "⭐", threshold: 5 },
  { key: "sim_10", titleKey: "ach.sim10", descKey: "ach.sim10Desc", icon: "🏆", threshold: 10 },
  { key: "sim_15", titleKey: "ach.sim15", descKey: "ach.sim15Desc", icon: "💎", threshold: 15 },
  { key: "sim_all", titleKey: "ach.simAll", descKey: "ach.simAllDesc", icon: "👑", threshold: 20 },
];

export function useAchievements() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const checkAndUnlock = useCallback(async () => {
    if (!user) return;

    const [achRes, progRes] = await Promise.all([
      supabase
        .from("user_achievements")
        .select("achievement_key")
        .eq("user_id", user.id),
      supabase
        .from("simulation_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("completed", true),
    ]);

    const currentKeys = new Set(achRes.data?.map((r: any) => r.achievement_key) ?? []);
    const count = progRes.data?.length ?? 0;
    setCompletedCount(count);
    setUnlocked(currentKeys);

    const toUnlock = ACHIEVEMENTS.filter(
      (a) => count >= a.threshold && !currentKeys.has(a.key)
    );

    if (toUnlock.length > 0) {
      const rows = toUnlock.map((a) => ({
        user_id: user.id,
        achievement_key: a.key,
      }));
      await supabase.from("user_achievements").insert(rows);

      setUnlocked((prev) => {
        const next = new Set(prev);
        toUnlock.forEach((a) => next.add(a.key));
        return next;
      });

      // Show toast for each newly unlocked achievement
      toUnlock.forEach((a) => {
        toast.success(`${a.icon} ${t(a.titleKey)}`, {
          description: t(a.descKey),
          duration: 5000,
        });
      });
    }
  }, [user, t]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    checkAndUnlock().then(() => setLoading(false));
  }, [user, checkAndUnlock]);

  return { unlocked, completedCount, loading, achievements: ACHIEVEMENTS, checkAndUnlock };
}
