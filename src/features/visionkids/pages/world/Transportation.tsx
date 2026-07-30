import { useState } from "react";
import { Lock, Check, Gauge } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useTransports } from "@/features/visionkids/hooks/world/useWorldCatalog";
import {
  useTransportUnlocks, useUnlockTransport, useWorldSettings, useUpsertWorldSettings, useWorldStats,
} from "@/features/visionkids/hooks/world/useWorldProgress";
import { WorldHeader } from "@/features/visionkids/components/world/WorldHeader";

export default function Transportation() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: transports = [], isLoading } = useTransports();
  const { data: unlocks = [] } = useTransportUnlocks();
  const { data: stats } = useWorldStats();
  const { data: settings } = useWorldSettings();
  const unlock = useUnlockTransport();
  const saveSettings = useUpsertWorldSettings();

  const [msg, setMsg] = useState<string | null>(null);

  useDocumentHead({
    title: `${t("kids.world.nav.transportation")} — VisionKids`,
    description: t("kids.world.transportation.subtitle"),
    canonicalPath: "/kids/world/transportation",
  });

  const unlockedSet = new Set(unlocks);
  const badges = new Set(stats?.badges ?? []);
  const current = settings?.current_transport ?? "walk";

  function isUnlocked(slug: string, achievement: string | null) {
    // 'walk' (no achievement) is always available; others need the badge OR a prior unlock row.
    return achievement === null || unlockedSet.has(slug) || badges.has(achievement);
  }

  async function onUnlock(slug: string) {
    setMsg(null);
    const ok = await unlock.mutateAsync(slug).catch(() => false);
    setMsg(ok ? t("kids.world.transportation.unlocked") : t("kids.world.transportation.lockedHint"));
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <WorldHeader emoji="🚂" title={t("kids.world.nav.transportation")} subtitle={t("kids.world.transportation.subtitle")} />

      {msg && <p className="mt-4 rounded-xl border-2 border-border bg-card p-3 text-sm font-semibold" role="status">{msg}</p>}

      {isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {transports.map((tr) => {
            const unlocked = isUnlocked(tr.slug, tr.unlock_achievement);
            const isCurrent = current === tr.slug;
            return (
              <div key={tr.slug} className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${isCurrent ? "border-kids-primary bg-kids-primary/5" : "border-border bg-card"} ${!unlocked ? "opacity-70" : ""}`}>
                <span className="text-4xl" aria-hidden="true">{tr.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-base font-bold">{tr.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Gauge className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.world.transportation.speed")}: {tr.speed}
                  </p>
                  {!unlocked && tr.unlock_achievement && (
                    <p className="mt-1 text-xs font-medium text-kids-pink">🔒 {t("kids.world.transportation.needs")} {t(`kids.world.badge.${tr.unlock_achievement}`)}</p>
                  )}
                </div>
                {!unlocked ? (
                  <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-label={t("kids.world.transportation.locked")} />
                ) : isCurrent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-kids-primary/15 px-3 py-1.5 text-xs font-bold text-kids-primary">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.world.transportation.selected")}
                  </span>
                ) : unlockedSet.has(tr.slug) ? (
                  <button type="button" disabled={!user || saveSettings.isPending}
                    onClick={() => saveSettings.mutate({ current_transport: tr.slug })}
                    className="rounded-full bg-kids-primary px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
                    {t("kids.world.transportation.select")}
                  </button>
                ) : (
                  <button type="button" disabled={!user || unlock.isPending}
                    onClick={() => onUnlock(tr.slug)}
                    className="rounded-full border-2 border-kids-primary px-4 py-1.5 text-xs font-bold text-kids-primary hover:bg-kids-primary/10 disabled:opacity-50">
                    {t("kids.world.transportation.unlock")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.world.signInHint")}</p>}
    </div>
  );
}
