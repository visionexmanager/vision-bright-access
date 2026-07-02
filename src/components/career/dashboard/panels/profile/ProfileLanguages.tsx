import { Languages } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_PROFILE } from "../../mock/mockProfile";
import { ProfileSectionCard } from "./ProfileSectionCard";

export function ProfileLanguages() {
  const { t } = useLanguage();

  return (
    <ProfileSectionCard icon={Languages} title={t("careerDash.profile.languages.title")}>
      <div className="flex flex-wrap gap-2">
        {MOCK_PROFILE.languages.map((lang) => (
          <span key={lang.id} className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium">
            {lang.name} · {t(`careerDash.profile.languages.level.${lang.proficiency}`)}
          </span>
        ))}
      </div>
    </ProfileSectionCard>
  );
}
