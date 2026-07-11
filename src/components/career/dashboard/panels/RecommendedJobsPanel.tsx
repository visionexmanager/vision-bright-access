import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_JOBS } from "@/components/career/jobs/mockJobs";
import { JobCard } from "@/components/career/jobs/JobCard";
import { MOCK_RECOMMENDED_JOB_IDS } from "../mock/mockSavedJobs";

export function RecommendedJobsPanel() {
  const { t } = useLanguage();
  const jobs = MOCK_JOBS.filter((job) => MOCK_RECOMMENDED_JOB_IDS.includes(job.id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("careerDash.nav.recommendedJobs")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.recommendedJobs.subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => <JobCard key={job.id} job={job} />)}
      </div>
    </div>
  );
}
