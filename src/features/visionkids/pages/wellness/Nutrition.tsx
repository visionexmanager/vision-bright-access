import { useLanguage } from "@/contexts/LanguageContext";
import { CategoryLessonsPage } from "@/features/visionkids/components/wellness/CategoryLessonsPage";

export default function Nutrition() {
  const { t } = useLanguage();
  return (
    <CategoryLessonsPage
      category="nutrition"
      emoji="🥗"
      title={t("kids.wellness.nav.nutrition")}
      subtitle={t("kids.wellness.nutrition.subtitle")}
      navId="nutrition"
      canonicalPath="/kids/health/nutrition"
    />
  );
}
