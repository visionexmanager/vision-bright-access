import { useState, useMemo, useCallback } from "react";
import { MOCK_JOBS } from "./mockJobs";
import { EMPTY_JOB_FILTERS } from "./types";
import type { Job, JobFilters, JobType, ParsedAiQuery, WorkMode } from "./types";

function filterJobs(jobs: Job[], filters: JobFilters): Job[] {
  return jobs.filter((job) => {
    if (filters.title && !job.title.toLowerCase().includes(filters.title.toLowerCase())) return false;
    if (filters.category && job.categoryId !== filters.category) return false;
    if (filters.company && !job.companyName.toLowerCase().includes(filters.company.toLowerCase())) return false;
    if (filters.skills && !job.skills.some((s) => s.toLowerCase().includes(filters.skills.toLowerCase()))) return false;
    if (filters.location && !job.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.country && !job.country.toLowerCase().includes(filters.country.toLowerCase())) return false;
    if (filters.minSalary) {
      const min = parseInt(filters.minSalary, 10);
      if (Number.isFinite(min) && job.salaryMax < min) return false;
    }
    if (filters.jobTypes.length && !filters.jobTypes.includes(job.type)) return false;
    if (filters.experience && job.experienceLevel !== filters.experience) return false;
    if (filters.education && !job.education.toLowerCase().includes(filters.education.toLowerCase())) return false;
    if (filters.workModes.length && !filters.workModes.includes(job.workMode)) return false;
    if (filters.visaSponsorship && !job.isVisaSponsorship) return false;
    if (filters.accessibleJobs && !job.isAccessible) return false;
    if (filters.urgentHiring && !job.isUrgent) return false;
    if (filters.entryLevel && job.experienceLevel !== "entry") return false;
    if (filters.aiJobs && !job.isAiJob) return false;
    return true;
  });
}

export function useJobSearch() {
  const [filters, setFilters] = useState<JobFilters>(EMPTY_JOB_FILTERS);

  const updateFilter = useCallback(<K extends keyof JobFilters>(key: K, value: JobFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleJobType = useCallback((value: JobType) => {
    setFilters((prev) => ({
      ...prev,
      jobTypes: prev.jobTypes.includes(value) ? prev.jobTypes.filter((v) => v !== value) : [...prev.jobTypes, value],
    }));
  }, []);

  const toggleWorkMode = useCallback((value: WorkMode) => {
    setFilters((prev) => ({
      ...prev,
      workModes: prev.workModes.includes(value) ? prev.workModes.filter((v) => v !== value) : [...prev.workModes, value],
    }));
  }, []);

  const resetFilters = useCallback(() => setFilters(EMPTY_JOB_FILTERS), []);

  const patchFilters = useCallback((patch: Partial<JobFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyAiQuery = useCallback((parsed: ParsedAiQuery) => {
    setFilters((prev) => ({
      ...prev,
      title: parsed.keywords.length ? parsed.keywords.join(" ") : prev.title,
      country: parsed.country ?? prev.country,
      location: parsed.location ?? prev.location,
      minSalary: parsed.minSalary ? String(parsed.minSalary) : prev.minSalary,
      workModes: parsed.workMode ? [parsed.workMode] : prev.workModes,
      jobTypes: parsed.jobType ? [parsed.jobType] : prev.jobTypes,
      accessibleJobs: parsed.isAccessible ?? prev.accessibleJobs,
      visaSponsorship: parsed.isVisaSponsorship ?? prev.visaSponsorship,
    }));
  }, []);

  const results = useMemo(() => filterJobs(MOCK_JOBS, filters), [filters]);

  return { filters, updateFilter, patchFilters, toggleJobType, toggleWorkMode, resetFilters, applyAiQuery, results };
}
