import { Link } from "react-router-dom";
import { ChevronLeft, Sparkles, Coins, Medal, Award, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useVXWallet } from "@/hooks/useVXWallet";
import { useMyXpTotal } from "@/features/visionkids/hooks/games/useGameEngagement";
import { useMyAchievements } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { useMyMedals } from "@/features/visionkids/hooks/events/useRewards";
import { useMyEventCertificates } from "@/features/visionkids/hooks/events/useCertificates";
import { useLimitedRewards, useMyClaimedRewardIds, useClaimLimitedReward } from "@/features/visionkids/hooks/events/useRewards";

const MEDAL_EMOJI: Record<string, string> = { gold: "🥇", silver: "🥈", bronze: "🥉", participation: "🎖️" };

export default function RewardsCenter() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { balance } = useVXWallet();
  const { data: xpTotal = 0 } = useMyXpTotal();
  const { data: achievements = [] } = useMyAchievements();
  const { data: medals = [] } = useMyMedals();
  const { data: certificates = [] } = useMyEventCertificates();
  const { data: limitedRewards = [] } = useLimitedRewards();
  const { data: claimedIds = [] } = useMyClaimedRewardIds();
  const claimReward = useClaimLimitedReward();

  useDocumentHead({ title: `${t("kids.events.nav.rewards")} — VisionKids`, description: t("kids.events.meta.description"), canonicalPath: "/kids/events/rewards" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/kids/events" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.events.heroTitle")}
      </Link>

      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold"><Award className="h-7 w-7 text-kids-accent" aria-hidden="true" /> {t("kids.events.nav.rewards")}</h1>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
          <Sparkles className="h-6 w-6 text-kids-accent" aria-hidden="true" />
          <div><p className="font-heading text-xl font-extrabold">{xpTotal}</p><p className="text-xs text-muted-foreground">{t("kids.events.rewards.totalXp")}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
          <Coins className="h-6 w-6 text-kids-secondary" aria-hidden="true" />
          <div><p className="font-heading text-xl font-extrabold">{balance}</p><p className="text-xs text-muted-foreground">{t("kids.events.rewards.totalCoins")}</p></div>
        </div>
      </div>

      <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><Medal className="h-5 w-5" aria-hidden="true" /> {t("kids.events.rewards.medals")}</h2>
      <div className="mt-2 flex flex-wrap gap-3">
        {medals.length === 0 && <p className="text-sm text-muted-foreground">{t("kids.events.rewards.noMedals")}</p>}
        {medals.map((m) => (
          <div key={m.id} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-3 text-center">
            <span className="text-3xl" aria-hidden="true">{MEDAL_EMOJI[m.medal_type]}</span>
            <span className="text-xs font-semibold capitalize">{t(`kids.events.rewards.medalType.${m.medal_type}`)}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><Award className="h-5 w-5" aria-hidden="true" /> {t("kids.events.rewards.badges")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{achievements.length} {t("kids.events.rewards.badgesEarned")}</p>

      <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><Award className="h-5 w-5" aria-hidden="true" /> {t("kids.events.rewards.certificates")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{certificates.length > 0 ? `${certificates.length} ${t("kids.events.rewards.certificatesEarned")}` : t("kids.events.rewards.noCertificates")}</p>
      {certificates.length > 0 && (
        <Link to="/kids/events/certificates" className="mt-1 inline-block text-sm font-semibold text-kids-primary hover:underline">{t("kids.events.rewards.viewCertificates")}</Link>
      )}

      <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><Gift className="h-5 w-5" aria-hidden="true" /> {t("kids.events.rewards.limitedRewards")}</h2>
      <div className="mt-2 flex flex-col gap-2">
        {limitedRewards.length === 0 && <p className="text-sm text-muted-foreground">{t("kids.events.rewards.noLimitedRewards")}</p>}
        {limitedRewards.map((r) => {
          const claimed = claimedIds.includes(r.id);
          const soldOut = r.quantity_claimed >= r.quantity_total;
          return (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">{r.emoji}</span>
                <div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.quantity_total - r.quantity_claimed} / {r.quantity_total} {t("kids.events.rewards.remaining")}</p>
                </div>
              </div>
              <Button size="sm" disabled={claimed || soldOut || claimReward.isPending} onClick={() => claimReward.mutate(r.id)}>
                {claimed ? t("kids.events.rewards.claimed") : soldOut ? t("kids.events.rewards.soldOut") : t("kids.events.rewards.claim")}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
