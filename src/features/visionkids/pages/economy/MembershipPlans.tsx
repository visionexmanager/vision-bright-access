import { useLanguage } from "@/contexts/LanguageContext";
import { PlansView } from "@/features/visionkids/components/economy/EconomyShell";

export default function MembershipPlans() {
  const { t } = useLanguage();
  return <PlansView audience="individual" emoji="⭐" title={t("kids.economy.nav.plans")} subtitle={t("kids.economy.plans.subtitle")} canonicalPath="/kids/economy/plans" />;
}
