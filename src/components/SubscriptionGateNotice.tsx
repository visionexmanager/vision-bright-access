import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { PRICING_PATH } from "@/lib/billing/plans";
import { SUBSCRIPTION_GATE_EVENT } from "@/lib/billing/subscriptionGateObserver";

/**
 * Says, once, that AI services need a subscription.
 *
 * The server decides when (see `subscriptionGateObserver.ts`); this only puts
 * the words on screen. Sonner's toaster is a polite live region, so screen
 * readers announce it, and the action is a real button reachable by keyboard.
 * It stays long enough to be read aloud and followed. An account on the free
 * week is told the service is not included in its trial rather than that AI is
 * for subscribers, because that is the true reason; the server still decides,
 * this only picks the words. The user stays on the page they are on.
 */
export function SubscriptionGateNotice() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { access } = usePlanAccess();
  const onTrial = access?.trialActive === true;

  useEffect(() => {
    const onGate = () => {
      toast(t(onTrial ? "subscriptionGate.trialMessage" : "subscriptionGate.message"), {
        id: "subscription-gate",
        duration: 20_000,
        action: { label: t("subscriptionGate.subscribe"), onClick: () => navigate(PRICING_PATH) },
        cancel: { label: t("common.dismiss"), onClick: () => undefined },
      });
    };
    window.addEventListener(SUBSCRIPTION_GATE_EVENT, onGate);
    return () => window.removeEventListener(SUBSCRIPTION_GATE_EVENT, onGate);
  }, [t, navigate, onTrial]);

  return null;
}
