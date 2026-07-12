import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { useCareerJobs } from "@/hooks/career/useCareerJobs";
import { jobRowToCard } from "./adapters";
import { JobCard } from "./JobCard";

// "Featured" = active jobs ranked by optimization_score (nulls last), falling
// back to newest — the deployed schema has no dedicated "featured" flag.
export function FeaturedJobs() {
  const { t } = useLanguage();
  const { jobs, isLoading } = useCareerJobs({ limit: 30 });
  const featured = [...jobs]
    .sort((a, b) => (b.optimization_score ?? -1) - (a.optimization_score ?? -1) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  if (!isLoading && featured.length === 0) return null;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="type-overline mb-2">{t("careersPage.featuredJobs.overline")}</p>
          <h2 className="type-heading">{t("careersPage.featuredJobs.title")}</h2>
        </div>
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-48 rounded-2xl border border-border/60 bg-card animate-pulse" aria-hidden="true" />)}
        </div>
      ) : (
        <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((job) => (
            <StaggerItem key={job.id}>
              <JobCard job={jobRowToCard(job)} />
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </div>
  );
}
