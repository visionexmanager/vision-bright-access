// Still mock — there is no `saved_jobs`/bookmarks table in the deployed
// schema (Phase 1 backend only covers profile/jobs/applications/certificates/
// goals/notifications/messages/resume; see career.ts plan). Revisit once a
// bookmarks table exists.
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_JOBS } from "@/components/career/jobs/mockJobs";
import { JobCard } from "@/components/career/jobs/JobCard";
import { MOCK_SAVED_JOB_IDS } from "../mock/mockSavedJobs";

export function SavedJobsPanel() {
  const { t } = useLanguage();
  const jobs = MOCK_JOBS.filter((job) => MOCK_SAVED_JOB_IDS.includes(job.id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.savedJobs")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.savedJobs.subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => <JobCard key={job.id} job={job} isMock />)}
      </div>
    </div>
  );
}
