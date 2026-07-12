import { useLanguage } from "@/contexts/LanguageContext";
import { Sparkles } from "lucide-react";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { useRecommendedJobs } from "@/hooks/career/useCareerJobs";
import { jobRowToCard } from "./adapters";
import { JobCard } from "./JobCard";

export function RecommendedJobs() {
  const { t } = useLanguage();
  const { jobs, isLoading } = useRecommendedJobs();

  if (!isLoading && jobs.length === 0) return null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="type-heading">{t("careersPage.recommendedJobs.title")}</h2>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("careersPage.recommendedJobs.subtitle")}</p>
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
