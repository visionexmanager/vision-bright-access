import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useHabits } from "@/features/visionkids/hooks/wellness/useWellnessCatalog";
import { useHabitLogs, useLogHabit } from "@/features/visionkids/hooks/wellness/useWellnessLogs";
import { WellnessHeader } from "@/features/visionkids/components/wellness/WellnessHeader";
import { HabitChecklist } from "@/features/visionkids/components/wellness/HabitChecklist";
import { WellnessRewardBanner } from "@/features/visionkids/components/wellness/WellnessRewardBanner";

export default function HealthyHabits() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: habits = [], isLoading } = useHabits("habit");
  const { data: logs = [] } = useHabitLogs();
  const logHabit = useLogHabit();
  const [reward, setReward] = useState<{ streak: number } | null>(null);

  useDocumentHead({
    title: `${t("kids.wellness.nav.habits")} — VisionKids`,
    description: t("kids.wellness.habits.subtitle"),
    canonicalPath: "/kids/health/habits",
  });

  const doneSet = useMemo(() => new Set(logs.map((l) => l.habit_slug)), [logs]);

  async function toggle(slug: string) {
    if (!user) return;
    try {
      const res = await logHabit.mutateAsync({ habitSlug: slug });
      if (res.newly_logged) {
        setReward({ streak: res.streak });
        setTimeout(() => setReward(null), 3000);
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <WellnessHeader emoji="✅" title={t("kids.wellness.nav.habits")} subtitle={t("kids.wellness.habits.subtitle")} showSubNav activeId="habits" />

      <WellnessRewardBanner
        show={!!reward}
        message={reward && reward.streak > 1 ? `${t("kids.wellness.habits.streakMsg")} ${reward.streak} 🔥` : t("kids.wellness.habits.niceMsg")}
        xp={10}
        coins={5}
      />

      {!user && (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-border bg-card p-3 text-sm text-muted-foreground" role="status">
          {t("kids.wellness.signInHint")}
        </p>
      )}

      {isLoading ? (
        <div className="mt-6 h-64 animate-pulse rounded-3xl bg-muted" aria-busy="true" />
      ) : (
        <div className="mt-6">
          <HabitChecklist habits={habits} doneSet={doneSet} onToggle={toggle} disabled={!user || logHabit.isPending} />
        </div>
      )}
    </div>
  );
}
