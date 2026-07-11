import { useLanguage } from "@/contexts/LanguageContext";
import { ProfileHeader } from "./profile/ProfileHeader";
import { ProfileSkills } from "./profile/ProfileSkills";
import { ProfileExperience } from "./profile/ProfileExperience";
import { ProfileEducation } from "./profile/ProfileEducation";
import { ProfileLanguages } from "./profile/ProfileLanguages";
import { ProfileCertificatesCourses } from "./profile/ProfileCertificatesCourses";
import { ProfileProjects } from "./profile/ProfileProjects";
import { ProfileVolunteeringAwards } from "./profile/ProfileVolunteeringAwards";

export function ProfilePanel() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.profile")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.profile.subtitle")}</p>
      </div>
      <ProfileHeader />
      <ProfileSkills />
      <ProfileExperience />
      <ProfileEducation />
      <ProfileLanguages />
      <ProfileCertificatesCourses />
      <ProfileProjects />
      <ProfileVolunteeringAwards />
    </div>
  );
}
