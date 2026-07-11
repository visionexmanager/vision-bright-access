import { Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCareerDashboard } from "@/contexts/CareerDashboardContext";
import { MOCK_CERTIFICATES } from "../../mock/mockCertificates";
import { ProfileSectionCard } from "./ProfileSectionCard";

export function ProfileCertificatesCourses() {
  const { t } = useLanguage();
  const { setActiveSection } = useCareerDashboard();

  return (
    <ProfileSectionCard icon={Award} title={t("careerDash.profile.certificates.title")}>
      <ul className="flex flex-col gap-2">
        {MOCK_CERTIFICATES.map((cert) => (
          <li key={cert.id}>
            <button
              type="button"
              onClick={() => setActiveSection("certificates")}
              className="w-full rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block text-sm font-semibold">{cert.title}</span>
              <span className="block text-xs text-muted-foreground">{cert.issuer} · {cert.issueDate}</span>
            </button>
          </li>
        ))}
      </ul>
    </ProfileSectionCard>
  );
}
