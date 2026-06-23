import { useTrial } from "@/hooks/useTrial";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Gift, AlertTriangle } from "lucide-react";

export function TrialBanner() {
  const { user } = useAuth();
  const { isOnTrial, trialDaysLeft } = useTrial();
  const { t } = useLanguage();

  if (!user || !isOnTrial) return null;

  const isWarning = trialDaysLeft <= 3;

  const warningText = (() => {
    if (trialDaysLeft === 0) {
      const msg = t("trial.expiresToday");
      return msg !== "trial.expiresToday"
        ? msg
        : "Free trial expires today — upon expiry, all platform services will be charged from your VX balance";
    }
    const msg = t("trial.endingSoon");
    return msg !== "trial.endingSoon"
      ? msg.replace("{days}", String(trialDaysLeft))
      : `Free trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} — upon expiry, all platform services will be charged from your VX balance`;
  })();

  const activeRaw = t("trial.active");
  const activeText =
    (activeRaw && activeRaw !== "trial.active")
      ? activeRaw.replace("{days}", String(trialDaysLeft))
      : `Free trial active — ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining, enjoy all features at no cost`;

  return (
    <div
      className={`w-full py-2 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2 ${
        isWarning
          ? "bg-orange-500/15 border-b border-orange-500/30 text-orange-400"
          : "bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400"
      }`}
    >
      {isWarning ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Gift className="h-3.5 w-3.5 shrink-0" />
      )}
      {isWarning ? warningText : activeText}
    </div>
  );
}
