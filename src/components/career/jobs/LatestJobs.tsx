import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { MOCK_JOBS } from "./mockJobs";
import { JobCard } from "./JobCard";

export function LatestJobs() {
  const { t } = useLanguage();
  const jobs = [...MOCK_JOBS].sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()).slice(0, 6);

  return (
    <div>
      <h2 className="type-heading mb-6">{t("careersPage.latestJobs.title")}</h2>
      <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <StaggerItem key={job.id}>
            <JobCard job={job} />
          </StaggerItem>
        ))}
      </StaggerGrid>
    </div>
  );
}
