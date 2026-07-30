import { useLanguage } from "@/contexts/LanguageContext";
import { CategoryLessonsPage } from "@/features/visionkids/components/wellness/CategoryLessonsPage";

export default function SafetyAcademy() {
  const { t } = useLanguage();
  return (
    <CategoryLessonsPage
      category="safety"
      emoji="🛡️"
      title={t("kids.wellness.nav.safety")}
      subtitle={t("kids.wellness.safety.subtitle")}
      navId="safety"
      canonicalPath="/kids/health/safety"
    />
  );
}
