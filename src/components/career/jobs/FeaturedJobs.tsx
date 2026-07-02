import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { MOCK_JOBS } from "./mockJobs";
import { JobCard } from "./JobCard";

const FEATURED_JOB_IDS = ["job-001", "job-002", "job-003", "job-005", "job-010", "job-011"];

export function FeaturedJobs() {
  const { t } = useLanguage();
  const jobs = MOCK_JOBS.filter((job) => FEATURED_JOB_IDS.includes(job.id));

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="type-overline mb-2">{t("careersPage.featuredJobs.overline")}</p>
          <h2 className="type-heading">{t("careersPage.featuredJobs.title")}</h2>
        </div>
      </div>
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
