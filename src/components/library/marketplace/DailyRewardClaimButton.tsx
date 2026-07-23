import { Gift, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDailyReward } from "@/hooks/library/useDailyReward";
import { useLanguage } from "@/contexts/LanguageContext";

export function DailyRewardClaimButton() {
  const { t } = useLanguage();
  const { todaysClaim, isLoading, isClaiming, canClaim, claim } = useDailyReward();

  if (isLoading) return null;

  if (todaysClaim) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
        {t("library.dailyReward.claimed").replace("{amount}", String(todaysClaim.vx_awarded))}
      </Button>
    );
  }

  return (
    <Button onClick={() => void claim()} disabled={!canClaim || isClaiming} className="gap-2">
      {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Gift className="h-4 w-4" aria-hidden="true" />}
      {t("library.dailyReward.claim")}
    </Button>
  );
}
