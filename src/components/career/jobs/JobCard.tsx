import { useState } from "react";
import { Bookmark, Share2, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useComingSoon } from "@/components/career/useComingSoon";
import { CompanyAvatar } from "./CompanyAvatar";
import { JobBadge } from "./JobBadge";
import { formatRelativeTime, formatSalary } from "./formatters";
import type { Job } from "./types";

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const handleComingSoon = useComingSoon();
  const [saved, setSaved] = useState(false);

  const toggleSave = () => {
    setSaved((v) => !v);
    playSound(saved ? "click" : "select");
  };

  return (
    <article className="group relative flex h-full flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CompanyAvatar name={job.companyName} color={job.companyLogoColor} />
          <div>
            <h3 className="font-bold leading-snug">{job.title}</h3>
            <p className="text-sm text-muted-foreground">{job.companyName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={saved}
          aria-label={t(saved ? "careersPage.job.unsave" : "careersPage.job.save")}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Bookmark className={`h-5 w-5 ${saved ? "fill-primary text-primary" : ""}`} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{job.location}</span>
        <span aria-hidden="true">·</span>
        <span className="font-medium text-foreground">{formatSalary(job.salaryMin, job.salaryMax, job.currency)}</span>
        <span aria-hidden="true">·</span>
        <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{formatRelativeTime(job.postedAt)}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <JobBadge variant={job.workMode} />
        {job.isAccessible && <JobBadge variant="accessible" />}
        {job.isVisaSponsorship && <JobBadge variant="visa" />}
        {job.isUrgent && <JobBadge variant="urgent" />}
        {job.isAiJob && <JobBadge variant="aiJob" />}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-2">
        <Button size="sm" className="flex-1" onClick={handleComingSoon}>
          {t("careersPage.job.quickApply")}
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={handleComingSoon}>
          {t("careersPage.job.details")}
        </Button>
        <button
          type="button"
          onClick={handleComingSoon}
          aria-label={t("careersPage.job.share")}
          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
