import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecommendedJobs } from "@/hooks/career/useCareerJobs";
import { jobRowToCard } from "@/components/career/jobs/adapters";
import { JobCard } from "@/components/career/jobs/JobCard";

export function RecommendedJobsPanel() {
  const { t } = useLanguage();
  const { jobs, isLoading } = useRecommendedJobs();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("careerDash.nav.recommendedJobs")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.recommendedJobs.subtitle")}</p>
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-48 rounded-2xl border border-border/60 bg-card animate-pulse" aria-hidden="true" />)}
        </div>
      ) : jobs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("careerDash.recommendedJobs.empty")}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => <JobCard key={job.id} job={jobRowToCard(job)} />)}
        </div>
      )}
    </div>
  );
}
