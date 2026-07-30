import { useLanguage } from "@/contexts/LanguageContext";
import { PlansView } from "@/features/visionkids/components/economy/EconomyShell";

export default function SchoolPlans() {
  const { t } = useLanguage();
  return <PlansView audience="school" emoji="🏫" title={t("kids.economy.nav.schoolPlans")} subtitle={t("kids.economy.schoolPlans.subtitle")} canonicalPath="/kids/economy/school-plans" />;
}
