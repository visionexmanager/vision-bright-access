import { HeartHandshake, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_PROFILE } from "../../mock/mockProfile";
import { ProfileSectionCard } from "./ProfileSectionCard";

export function ProfileVolunteeringAwards() {
  const { t } = useLanguage();

  return (
    <ProfileSectionCard icon={HeartHandshake} title={t("careerDash.profile.volunteeringAwards.title")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{t("careerDash.profile.volunteering")}</p>
          <ul className="flex flex-col gap-2">
            {MOCK_PROFILE.volunteering.map((v) => (
              <li key={v.id} className="text-sm">
                <span className="font-medium">{v.role}</span> · {v.organization}
                <span className="block text-xs text-muted-foreground">{v.period}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            {t("careerDash.profile.awards")}
          </p>
          <ul className="flex flex-col gap-2">
            {MOCK_PROFILE.awards.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-medium">{a.title}</span>
                <span className="block text-xs text-muted-foreground">{a.issuer} · {a.year}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProfileSectionCard>
  );
}
