import { useLanguage } from "@/contexts/LanguageContext";
import { CategoryLessonsPage } from "@/features/visionkids/components/wellness/CategoryLessonsPage";

export default function ExerciseCenter() {
  const { t } = useLanguage();
  return (
    <CategoryLessonsPage
      category="exercise"
      emoji="🤸"
      title={t("kids.wellness.nav.exercise")}
      subtitle={t("kids.wellness.exercise.subtitle")}
      navId="exercise"
      canonicalPath="/kids/health/exercise"
    />
  );
}
