import { Link } from "react-router-dom";
import { ChevronLeft, Sparkles, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useExplorerWorlds } from "@/features/visionkids/hooks/explorer/useExplorerWorlds";
import { useMyPassportStamps, useMyExplorerCertificate, useClaimExplorerCertificate } from "@/features/visionkids/hooks/explorer/useExplorerPassport";
import { useMyXpTotal } from "@/features/visionkids/hooks/games/useGameEngagement";
import { useMyAchievements, useAllAchievements } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { AchievementBadge } from "@/features/visionkids/components/games/AchievementBadge";
import { ExplorerCertificateCard } from "@/features/visionkids/components/explorer/ExplorerCertificateCard";
import { WORLD_COLOR_CLASSES } from "@/features/visionkids/data/explorerWorlds";

const EXPLORER_ACHIEVEMENT_KEYS = ["world_wanderer", "master_explorer", "quiz_whiz", "city_planner", "green_thumb", "eco_hero", "space_cadet"];

export default function ExplorerPassport() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: allWorlds = [] } = useExplorerWorlds();
  const { data: stamps = [] } = useMyPassportStamps();
  const { data: xpTotal = 0 } = useMyXpTotal();
  const { data: myAchievements = [] } = useMyAchievements();
  const { data: allAchievements = [] } = useAllAchievements();
  const { data: certificate } = useMyExplorerCertificate();
  const claimCertificate = useClaimExplorerCertificate();

  const worlds = allWorlds.filter((w) => w.kind !== "hub");
  const stampedSlugs = new Set(stamps.map((s) => s.world_slug));
  const earnedKeys = new Set(myAchievements.map((a) => a.achievement?.key).filter((k): k is string => !!k));
  const explorerAchievements = allAchievements.filter((a) => EXPLORER_ACHIEVEMENT_KEYS.includes(a.key));

  const allStamped = worlds.length > 0 && worlds.every((w) => stampedSlugs.has(w.slug));

  useDocumentHead({ title: `${t("kids.explorer.passportTitle")} — VisionKids Explorer`, description: t("kids.explorer.meta.description"), canonicalPath: "/kids/explorer/passport" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/kids/explorer" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.explorer.homeTitle")}
      </Link>

      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">📔 {t("kids.explorer.passportTitle")}</h1>
      <p className="mt-1 text-muted-foreground">{t("kids.explorer.passportSubtitle")}</p>

      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-kids-accent">
        <Sparkles className="h-4 w-4" aria-hidden="true" /> {xpTotal} XP
        <span className="text-muted-foreground">·</span>
        {stamps.length} / {worlds.length} {t("kids.explorer.worldsStamped")}
      </div>

      <h2 className="mt-8 font-heading text-lg font-bold">{t("kids.explorer.stampsTitle")}</h2>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {worlds.map((world) => {
          const stamped = stampedSlugs.has(world.slug);
          return (
            <div
              key={world.slug}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center ${
                stamped ? WORLD_COLOR_CLASSES[world.color] : "border-dashed border-border opacity-40"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">{world.emoji}</span>
              <p className="text-xs font-semibold">{world.title}</p>
              {stamped && <span aria-hidden="true">✅</span>}
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 font-heading text-lg font-bold">{t("kids.explorer.badgesTitle")}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {explorerAchievements.map((a) => (
          <AchievementBadge key={a.id} achievement={a} earned={earnedKeys.has(a.key)} />
        ))}
      </div>

      <h2 className="mt-8 font-heading text-lg font-bold">{t("kids.explorer.certificateTitle")}</h2>
      <div className="mt-3">
        {certificate ? (
          <ExplorerCertificateCard certificate={certificate} />
        ) : allStamped ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-kids-accent/50 p-6 text-center">
            <Award className="h-10 w-10 text-kids-accent" aria-hidden="true" />
            <p className="font-heading font-bold">{t("kids.explorer.readyToClaim")}</p>
            <Button className="bg-kids-accent text-white hover:bg-kids-accent/90" onClick={() => claimCertificate.mutate()} disabled={claimCertificate.isPending}>
              {t("kids.explorer.claimCertificate")}
            </Button>
          </div>
        ) : (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("kids.explorer.certificateLocked")}
          </p>
        )}
      </div>
    </div>
  );
}
