import { useLanguage } from "@/contexts/LanguageContext";
import { PlansView } from "@/features/visionkids/components/economy/EconomyShell";

export default function FamilyPlans() {
  const { t } = useLanguage();
  return <PlansView audience="family" emoji="👨‍👩‍👧" title={t("kids.economy.nav.familyPlans")} subtitle={t("kids.economy.familyPlans.subtitle")} canonicalPath="/kids/economy/family-plans" />;
}
