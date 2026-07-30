import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useRegions } from "@/features/visionkids/hooks/world/useWorldCatalog";
import { useVisitedRegions, useWorldStats } from "@/features/visionkids/hooks/world/useWorldProgress";
import { WORLD_BADGES } from "@/features/visionkids/data/worldConfig";
import { WorldHeader } from "@/features/visionkids/components/world/WorldHeader";

export default function WorldPassport() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: regions = [] } = useRegions();
  const { data: visited = [] } = useVisitedRegions();
  const { data: stats } = useWorldStats();

  useDocumentHead({
    title: `${t("kids.world.nav.passport")} — VisionKids`,
    description: t("kids.world.passport.subtitle"),
    canonicalPath: "/kids/world/passport",
  });

  const visitedSet = new Set(visited);
  const earned = new Set(stats?.badges ?? []);
  const stampable = regions.filter((r) => r.kind !== "system");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <WorldHeader emoji="🛂" title={t("kids.world.nav.passport")} subtitle={t("kids.world.passport.subtitle")} />

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.world.passport.signInHint")}</p>
      ) : (
        <>
          {stats && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t("kids.world.regionsDiscovered"), value: stats.regions },
                { label: t("kids.world.questsDone"), value: stats.quests },
                { label: t("kids.world.passport.items"), value: stats.items },
                { label: t("kids.world.passport.pets"), value: stats.pets },
              ].map((tile) => (
                <div key={tile.label} className="rounded-2xl border-2 border-border bg-card p-4 text-center">
                  <p className="font-heading text-2xl font-extrabold">{tile.value}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{tile.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Badges */}
          <section className="mt-8">
            <h2 className="font-heading text-lg font-bold">{t("kids.world.passport.medals")}</h2>
            <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
              {WORLD_BADGES.map((b) => {
                const has = earned.has(b.key);
                return (
                  <div key={b.key} title={t(`kids.world.badge.${b.key}`)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center ${has ? "border-kids-accent/50 bg-kids-accent/5" : "border-border opacity-40"}`}>
                    <span className="text-2xl" aria-hidden="true">{has ? b.emoji : "🔒"}</span>
                    <span className="text-[10px] font-semibold leading-tight">{t(`kids.world.badge.${b.key}`)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Stamps */}
          <section className="mt-8">
            <h2 className="font-heading text-lg font-bold">{t("kids.world.passport.stamps")}</h2>
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {stampable.map((r) => {
                const stamped = visitedSet.has(r.slug);
                return (
                  <div key={r.slug}
                    className={`flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed p-3 text-center ${stamped ? "border-kids-green/50 bg-kids-green/5" : "border-border opacity-50"}`}>
                    <span className="text-2xl" aria-hidden="true">{stamped ? r.emoji : "❔"}</span>
                    <span className="text-[10px] font-semibold leading-tight">{stamped ? r.title : t("kids.world.passport.undiscovered")}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
