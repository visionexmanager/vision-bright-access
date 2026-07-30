import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useActivities, useNpcs } from "@/features/visionkids/hooks/world/useWorldCatalog";
import { useQuestProgress, useCompleteQuest, useVisitRegion } from "@/features/visionkids/hooks/world/useWorldProgress";
import { WORLD_COLOR_CLASSES, ACTIVITY_KIND_EMOJI } from "@/features/visionkids/data/worldConfig";
import { WorldHeader } from "@/features/visionkids/components/world/WorldHeader";
import { NpcCard } from "@/features/visionkids/components/world/NpcCard";
import { WorldRewardBanner } from "@/features/visionkids/components/world/WorldRewardBanner";
import type { KidsColor, WorldActivity } from "@/features/visionkids/types/world.types";

/** Generic region page shared by every district and island — one component
 *  over the polymorphic kids_world_activities + kids_npcs catalogs. Shows the
 *  region's NPCs and its activities/quests, lets a signed-in child complete a
 *  quest for a reward, and records the visit (World Passport stamp) on open. */
export function RegionPage({
  region,
  emoji,
  title,
  subtitle,
  canonicalPath,
  color = "primary",
  backTo,
  backLabelKey,
}: {
  region: string;
  emoji: string;
  title: string;
  subtitle?: string;
  canonicalPath: string;
  color?: KidsColor;
  backTo?: string;
  backLabelKey?: string;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: activities = [], isLoading } = useActivities(region);
  const { data: npcs = [] } = useNpcs(region);
  const { data: questProgress = [] } = useQuestProgress();
  const complete = useCompleteQuest();
  const visit = useVisitRegion();

  const [reward, setReward] = useState<{ xp: number; coins: number } | null>(null);
  const visited = useRef(false);

  useDocumentHead({ title: `${title} — VisionKids`, description: subtitle ?? t("kids.world.meta.description"), canonicalPath });

  // Record the visit once (best-effort) for a signed-in child.
  useEffect(() => {
    if (user && region && !visited.current) {
      visited.current = true;
      visit.mutate(region);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, region]);

  const doneIds = useMemo(
    () => new Set(questProgress.filter((p) => p.status === "completed").map((p) => p.activity_id)),
    [questProgress],
  );

  async function onDo(activity: WorldActivity) {
    if (!user || complete.isPending) return;
    try {
      const res = await complete.mutateAsync(activity.id);
      if (res.newly_completed) {
        setReward({ xp: activity.reward_xp, coins: activity.reward_coins });
        setTimeout(() => setReward(null), 3200);
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <WorldHeader emoji={emoji} title={title} subtitle={subtitle} backTo={backTo} backLabelKey={backLabelKey} />

      <WorldRewardBanner show={!!reward} message={t("kids.world.quest.completedMsg")} xp={reward?.xp} coins={reward?.coins} />

      {npcs.length > 0 && (
        <section className="mt-6">
          <h2 className="font-heading text-lg font-bold">{t("kids.world.meetTheLocals")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {npcs.map((npc) => <NpcCard key={npc.slug} npc={npc} />)}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-heading text-lg font-bold">{t("kids.world.thingsToDo")}</h2>
        {isLoading ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : activities.length === 0 ? (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.world.noActivities")}</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {activities.map((a) => {
              const isDone = doneIds.has(a.id);
              return (
                <div key={a.id} className={`flex flex-col gap-2 rounded-2xl border-2 p-4 ${WORLD_COLOR_CLASSES[color]}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-3xl" aria-hidden="true">{a.emoji}</span>
                    <div className="min-w-0">
                      <p className="font-heading text-base font-bold leading-tight">{a.title}</p>
                      {a.summary && <p className="text-sm text-foreground/70">{a.summary}</p>}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-foreground/60">
                    <span aria-hidden="true">{ACTIVITY_KIND_EMOJI[a.kind] ?? "⭐"}</span>
                    <span>{t(`kids.world.kind.${a.kind}`)}</span>
                    {a.cadence !== "anytime" && (<><span aria-hidden="true">·</span><span>{t(`kids.world.cadence.${a.cadence}`)}</span></>)}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDo(a)}
                    disabled={!user || isDone || complete.isPending}
                    aria-pressed={isDone}
                    className={`mt-auto inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60 ${
                      isDone ? "bg-kids-green/20 text-kids-green" : "bg-kids-primary text-white hover:opacity-90"
                    }`}
                  >
                    {isDone ? (<><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("kids.world.quest.done")}</>) : t("kids.world.quest.do")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.world.signInHint")}</p>}
      </section>
    </div>
  );
}
