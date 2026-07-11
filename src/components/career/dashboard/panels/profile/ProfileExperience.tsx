import { Briefcase } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_PROFILE } from "../../mock/mockProfile";
import { ProfileSectionCard } from "./ProfileSectionCard";

export function ProfileExperience() {
  const { t } = useLanguage();

  return (
    <ProfileSectionCard icon={Briefcase} title={t("careerDash.profile.experience.title")}>
      <ol className="flex flex-col gap-4">
        {MOCK_PROFILE.experience.map((exp) => (
          <li key={exp.id} className="border-s-2 border-primary/20 ps-4">
            <p className="text-sm font-bold">{exp.title}</p>
            <p className="text-xs text-primary">{exp.company} · {exp.location}</p>
            <p className="text-xs text-muted-foreground">
              {exp.startDate} – {exp.endDate ?? t("careerDash.profile.present")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{exp.description}</p>
          </li>
        ))}
      </ol>
    </ProfileSectionCard>
  );
}
