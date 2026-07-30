import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useHabits } from "@/features/visionkids/hooks/wellness/useWellnessCatalog";
import { useHabitLogs, useLogHabit } from "@/features/visionkids/hooks/wellness/useWellnessLogs";
import { ROUTINE_SLOTS } from "@/features/visionkids/data/wellnessConfig";
import { WellnessHeader } from "@/features/visionkids/components/wellness/WellnessHeader";
import { HabitChecklist } from "@/features/visionkids/components/wellness/HabitChecklist";
import { WellnessRewardBanner } from "@/features/visionkids/components/wellness/WellnessRewardBanner";

export default function DailyRoutine() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: routineItems = [], isLoading } = useHabits("routine");
  const { data: logs = [] } = useHabitLogs();
  const logHabit = useLogHabit();
  const [reward, setReward] = useState(false);

  useDocumentHead({
    title: `${t("kids.wellness.nav.routine")} — VisionKids`,
    description: t("kids.wellness.routine.subtitle"),
    canonicalPath: "/kids/health/routine",
  });

  const doneSet = useMemo(() => new Set(logs.map((l) => l.habit_slug)), [logs]);
  const bySlot = useMemo(() => {
    const map: Record<string, typeof routineItems> = {};
    for (const item of routineItems) (map[item.routine_slot] ??= []).push(item);
    return map;
  }, [routineItems]);

  async function toggle(slug: string) {
    if (!user) return;
    try {
      const res = await logHabit.mutateAsync({ habitSlug: slug });
      if (res.newly_logged) {
        setReward(true);
        setTimeout(() => setReward(false), 2500);
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <WellnessHeader emoji="🗓️" title={t("kids.wellness.nav.routine")} subtitle={t("kids.wellness.routine.subtitle")} showSubNav activeId="routine" />

      <WellnessRewardBanner show={reward} message={t("kids.wellness.routine.doneMsg")} xp={10} coins={5} />

      {!user && (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-border bg-card p-3 text-sm text-muted-foreground" role="status">
          {t("kids.wellness.signInHint")}
        </p>
      )}

      {isLoading ? (
        <div className="mt-6 h-72 animate-pulse rounded-3xl bg-muted" aria-busy="true" />
      ) : (
        <div className="mt-6 space-y-8">
          {ROUTINE_SLOTS.filter((slot) => bySlot[slot.slug]?.length).map((slot) => (
            <section key={slot.slug}>
              <h2 className="font-heading text-lg font-bold">
                <span aria-hidden="true">{slot.emoji}</span> {t(`kids.wellness.routineSlot.${slot.slug}`)}
              </h2>
              <div className="mt-3">
                <HabitChecklist habits={bySlot[slot.slug]} doneSet={doneSet} onToggle={toggle} disabled={!user || logHabit.isPending} />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
