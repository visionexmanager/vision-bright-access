/**
 * useCourseCatalog — browse/search published Academy courses (Phase 1 backend).
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchCourseCatalog, fetchAllCategories, type CourseFilters } from "@/services/academy/lms";

export function useCourseCatalog(filters: CourseFilters = {}) {
  const filtersKey = JSON.stringify(filters);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.academy.lms.catalog(filtersKey),
    queryFn: () => fetchCourseCatalog(filters),
    staleTime: 60 * 1000,
  });

  return { courses: data ?? [], isLoading, error: error ? (error as Error).message : null, refetch };
}

export function useCourseCategories() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.academy.lms.categories(),
    queryFn: fetchAllCategories,
    staleTime: 5 * 60 * 1000,
  });
  return { categories: data ?? [], isLoading, error: error ? (error as Error).message : null, refetch };
}
