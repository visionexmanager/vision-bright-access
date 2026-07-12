// ─── useCareerJobs — public job listings + companies (Phase 1 backend) ────────
// No auth required — jobs/companies are publicly readable.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchActiveJobs, fetchCompanies, fetchRecommendedJobs, type JobFilters } from "@/services/career/jobs";
import { fetchMyCareerProfile } from "@/services/career/profile";

export function useCareerJobs(filters: JobFilters = {}) {
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.career.jobs(filtersKey),
    queryFn: () => fetchActiveJobs(filters),
  });
  return { jobs: data ?? [], isLoading, error: error ? (error as Error).message : null };
}

export function useCareerCompanies() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.career.companies(),
    queryFn: () => fetchCompanies(),
  });
  return { companies: data ?? [], isLoading };
}

export function useRecommendedJobs() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.career.recommendedJobs(user?.id ?? ""),
    queryFn: async () => {
      const profile = await fetchMyCareerProfile(user!.id);
      return fetchRecommendedJobs(profile?.skills ?? []);
    },
    enabled: !!user,
  });
  return { jobs: data ?? [], isLoading };
}
