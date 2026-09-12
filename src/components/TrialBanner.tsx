import { Link } from "react-router-dom";
import { Gift, AlertTriangle } from "lucide-react";
import { useTrial } from "@/hooks/useTrial";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { PRICING_PATH } from "@/lib/billing/plans";

/**
 * The free week, and the day before it ends.
 *
 * `trialDaysLeft` floors, so 0 means "ends today" and 1 means "ends
 * tomorrow" — the day-before notice the cron job also sends by email and
 * in-app. Somebody who only ever sees the site still gets it, and it carries
 * the link rather than leaving them to find the pricing page.
 */
export function TrialBanner() {
  const { user } = useAuth();
  const { isOnTrial, trialDaysLeft } = useTrial();
  const { t } = useLanguage();

  if (!user || !isOnTrial) return null;

  const isEnding = trialDaysLeft <= 1;

  const message = isEnding
    ? t(trialDaysLeft === 0 ? "trial.endsToday" : "trial.endsTomorrow")
    : t("trial.weekActive").replace("{days}", String(trialDaysLeft));

  return (
    <div
      className={`flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold ${
        isEnding
          ? "border-b border-orange-500/30 bg-orange-500/15 text-orange-400"
          : "border-b border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
      }`}
      // Announced when it changes, not on every render: the banner is
      // information, and a live region that interrupts every navigation is the
      // opposite of helpful for a screen-reader user.
      role="status"
    >
      {isEnding ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Gift className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
      <Link to={PRICING_PATH} className="underline underline-offset-2">
        {t("trial.choosePlan")}
      </Link>
    </div>
  );
}
