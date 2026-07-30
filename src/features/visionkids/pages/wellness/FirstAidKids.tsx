import { useLanguage } from "@/contexts/LanguageContext";
import { CategoryLessonsPage } from "@/features/visionkids/components/wellness/CategoryLessonsPage";

export default function FirstAidKids() {
  const { t } = useLanguage();
  return (
    <CategoryLessonsPage
      category="first_aid"
      emoji="🩹"
      title={t("kids.wellness.nav.firstAid")}
      subtitle={t("kids.wellness.firstAid.subtitle")}
      navId="first-aid"
      disclaimer={t("kids.wellness.firstAid.disclaimer")}
      canonicalPath="/kids/health/first-aid"
    />
  );
}
