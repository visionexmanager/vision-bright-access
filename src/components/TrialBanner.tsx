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

  const warningRaw = t("trial.endingSoon");
  const warningText = (warningRaw && warningRaw !== "trial.endingSoon")
    ? warningRaw.replace("{days}", String(trialDaysLeft))
    : `Free trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} — collect VX coins to keep using all features`;

  const activeRaw = t("trial.active");
  const activeText = (activeRaw && activeRaw !== "trial.active")
    ? activeRaw.replace("{days}", String(trialDaysLeft))
    : `Free trial active — ${trialDaysLeft} days remaining, all features unlocked`;

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
