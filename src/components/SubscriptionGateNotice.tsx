import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUBSCRIPTION_GATE_EVENT } from "@/lib/billing/subscriptionGateObserver";

/**
 * Says, once, that AI services need a subscription.
 *
 * The server decides when (see `subscriptionGateObserver.ts`); this only puts
 * the words on screen. Sonner's toaster is a polite live region, so screen
 * readers announce it, and the action is a real button reachable by keyboard.
 * It stays long enough to be read aloud and followed.
 */
export function SubscriptionGateNotice() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const onGate = () => {
      toast(t("subscriptionGate.message"), {
        id: "subscription-gate",
        duration: 20_000,
        action: { label: t("subscriptionGate.viewPlans"), onClick: () => navigate("/pricing") },
      });
    };
    window.addEventListener(SUBSCRIPTION_GATE_EVENT, onGate);
    return () => window.removeEventListener(SUBSCRIPTION_GATE_EVENT, onGate);
  }, [t, navigate]);

  return null;
}
