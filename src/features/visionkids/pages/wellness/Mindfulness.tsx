import { useLanguage } from "@/contexts/LanguageContext";
import { CategoryLessonsPage } from "@/features/visionkids/components/wellness/CategoryLessonsPage";

export default function Mindfulness() {
  const { t } = useLanguage();
  return (
    <CategoryLessonsPage
      category="mindfulness"
      emoji="🧘"
      title={t("kids.wellness.nav.mindfulness")}
      subtitle={t("kids.wellness.mindfulness.subtitle")}
      navId="mindfulness"
      canonicalPath="/kids/health/mindfulness"
    />
  );
}
