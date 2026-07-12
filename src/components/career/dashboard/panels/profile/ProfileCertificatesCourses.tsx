import { Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCareerDashboard } from "@/contexts/CareerDashboardContext";
import { useCareerCertificates } from "@/hooks/career/useCareerCertificates";
import { CareerErrorState } from "../../../ui/CareerErrorState";
import { ProfileSectionCard } from "./ProfileSectionCard";

// Certificates half is real (certificates table). The "Courses" half of this
// card's original mock data is deferred — joining in real Academy course
// titles needs fetchCourseById per enrollment (useMyEnrollments only returns
// raw course_id rows), out of scope for this pass.
export function ProfileCertificatesCourses() {
  const { t } = useLanguage();
  const { setActiveSection } = useCareerDashboard();
  const { certificates, isLoading, error, refetch } = useCareerCertificates();

  return (
    <ProfileSectionCard icon={Award} title={t("careerDash.profile.certificates.title")}>
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted/40" aria-hidden="true" />
      ) : error ? (
        <CareerErrorState message={error} onRetry={refetch} />
      ) : certificates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("careerDash.certificates.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {certificates.map((cert) => (
            <li key={cert.id}>
              <button
                type="button"
                onClick={() => setActiveSection("certificates")}
                className="w-full rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block text-sm font-semibold">{cert.title}</span>
                <span className="block text-xs text-muted-foreground">{cert.issuer}{cert.issue_date ? ` · ${cert.issue_date}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ProfileSectionCard>
  );
}
