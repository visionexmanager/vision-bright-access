import { useLanguage } from "@/contexts/LanguageContext";
import { Sparkles } from "lucide-react";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { MOCK_JOBS } from "./mockJobs";
import { JobCard } from "./JobCard";

// Mock personalization — swap for real recommendation-engine output later.
const RECOMMENDED_JOB_IDS = ["job-012", "job-015", "job-013", "job-017", "job-004", "job-020"];

export function RecommendedJobs() {
  const { t } = useLanguage();
  const jobs = MOCK_JOBS.filter((job) => RECOMMENDED_JOB_IDS.includes(job.id));

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="type-heading">{t("careersPage.recommendedJobs.title")}</h2>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("careersPage.recommendedJobs.subtitle")}</p>
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
