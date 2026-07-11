import { GraduationCap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_PROFILE } from "../../mock/mockProfile";
import { ProfileSectionCard } from "./ProfileSectionCard";

export function ProfileEducation() {
  const { t } = useLanguage();

  return (
    <ProfileSectionCard icon={GraduationCap} title={t("careerDash.profile.education.title")}>
      <ul className="flex flex-col gap-3">
        {MOCK_PROFILE.education.map((ed) => (
          <li key={ed.id}>
            <p className="text-sm font-bold">{ed.degree}</p>
            <p className="text-xs text-primary">{ed.institution} · {ed.location}</p>
            <p className="text-xs text-muted-foreground">{ed.startYear} – {ed.endYear ?? t("careerDash.profile.present")}</p>
          </li>
        ))}
      </ul>
    </ProfileSectionCard>
  );
}
