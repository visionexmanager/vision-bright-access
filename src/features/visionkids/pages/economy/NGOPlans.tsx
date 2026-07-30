import { useLanguage } from "@/contexts/LanguageContext";
import { PlansView } from "@/features/visionkids/components/economy/EconomyShell";

export default function NGOPlans() {
  const { t } = useLanguage();
  return <PlansView audience="ngo" emoji="🌍" title={t("kids.economy.nav.ngoPlans")} subtitle={t("kids.economy.ngoPlans.subtitle")} canonicalPath="/kids/economy/ngo-plans" />;
}
