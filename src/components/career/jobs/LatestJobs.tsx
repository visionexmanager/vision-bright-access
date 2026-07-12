import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { useCareerJobs } from "@/hooks/career/useCareerJobs";
import { jobRowToCard } from "./adapters";
import { JobCard } from "./JobCard";

export function LatestJobs() {
  const { t } = useLanguage();
  const { jobs, isLoading } = useCareerJobs({ limit: 6 });

  if (!isLoading && jobs.length === 0) return null;

  return (
    <div>
      <h2 className="type-heading mb-6">{t("careersPage.latestJobs.title")}</h2>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-48 rounded-2xl border border-border/60 bg-card animate-pulse" aria-hidden="true" />)}
        </div>
      ) : (
        <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <StaggerItem key={job.id}>
              <JobCard job={jobRowToCard(job)} />
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </div>
  );
}
