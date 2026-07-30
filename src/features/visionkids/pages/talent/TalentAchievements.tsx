import { useState } from "react";
import { motion } from "framer-motion";
import { Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { staggerContainer } from "@/features/visionkids/utils/animations";
import { useAllAchievements, useMyAchievements } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { useMyTalentCertificate, useClaimTalentCertificate } from "@/features/visionkids/hooks/talent/useTalentCertificate";
import { AchievementBadge } from "@/features/visionkids/components/games/AchievementBadge";
import { TalentHeader } from "@/features/visionkids/components/talent/TalentHeader";

/** Keys of the Phase 9 achievements seeded in 20260815020000. Kept in one
 *  place so this page shows the Talent Hub set specifically (the Games page
 *  shows the full catalog). */
const TALENT_ACHIEVEMENT_KEYS = new Set([
  "talent_discovered", "skill_starter", "skill_master",
  "track_finisher", "future_ready", "portfolio_builder", "young_innovator",
]);

export default function TalentAchievements() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  const { data: all = [], isLoading } = useAllAchievements();
  const { data: earned = [] } = useMyAchievements();
  const { data: certificate } = useMyTalentCertificate();
  const claim = useClaimTalentCertificate();
  const [claimError, setClaimError] = useState<string | null>(null);

  useDocumentHead({
    title: `${t("kids.talent.nav.achievements")} — VisionKids`,
    description: t("kids.talent.achievements.subtitle"),
    canonicalPath: "/kids/talent/achievements",
  });

  const talentAchievements = all.filter((a) => TALENT_ACHIEVEMENT_KEYS.has(a.key));
  const earnedMap = new Map(earned.map((e) => [e.achievement_id, e.earned_at]));
  const earnedCount = talentAchievements.filter((a) => earnedMap.has(a.id)).length;

  async function claimCertificate() {
    setClaimError(null);
    try {
      await claim.mutateAsync();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <TalentHeader emoji="🏆" title={t("kids.talent.nav.achievements")} subtitle={t("kids.talent.achievements.subtitle")} showSubNav activeId="achievements" />

      <p className="mt-4 text-muted-foreground">{earnedCount} / {talentAchievements.length} {t("kids.talent.achievements.unlocked")}</p>

      {/* Talent certificate */}
      <section className="mt-5 rounded-2xl border-2 border-kids-accent/30 bg-kids-accent/5 p-5">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 shrink-0 text-kids-accent" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="font-heading text-lg font-bold">{t("kids.talent.achievements.certificateTitle")}</h2>
            {certificate ? (
              <p className="text-sm text-muted-foreground">
                {t("kids.talent.achievements.certificateOwned")} · <span className="font-mono">{certificate.certificate_number}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("kids.talent.achievements.certificateHint")}</p>
            )}
          </div>
          {!certificate && user && (
            <button type="button" onClick={claimCertificate} disabled={claim.isPending} className="rounded-full bg-kids-accent px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
              {t("kids.talent.achievements.claim")}
            </button>
          )}
        </div>
        {claimError && <p className="mt-2 text-sm text-destructive" role="alert">{claimError}</p>}
      </section>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer(reduced)}
          className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {talentAchievements.map((a) => (
            <AchievementBadge key={a.id} achievement={a} earned={earnedMap.has(a.id)} earnedAt={earnedMap.get(a.id)} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
