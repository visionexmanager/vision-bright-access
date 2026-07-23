/**
 * useCategoryDetails — everything the Category Details page needs: the
 * category itself, its subcategories, stats (author_count/total_views),
 * and related categories — 4 small parallel queries rather than one giant
 * one, so each piece can show its own loading/error state independently.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchCategoryBySlug,
  fetchSubcategories,
  fetchCategoryStats,
  fetchRelatedCategories,
} from "@/services/library/categories";

export function useCategoryDetails(slug: string | undefined) {
  const { data: category, isLoading: categoryLoading, error: categoryError } = useQuery({
    queryKey: queryKeys.library.categoryBySlug(slug ?? ""),
    queryFn: () => fetchCategoryBySlug(slug!),
    enabled: !!slug,
  });

  const { data: subcategories = [], isLoading: subcategoriesLoading } = useQuery({
    queryKey: queryKeys.library.subcategories(category?.id ?? ""),
    queryFn: () => fetchSubcategories(category!.id),
    enabled: !!category,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.library.categoryStats(category?.id ?? ""),
    queryFn: () => fetchCategoryStats(category!.id),
    enabled: !!category,
  });

  const { data: relatedCategories = [], isLoading: relatedLoading } = useQuery({
    queryKey: queryKeys.library.relatedCategories(category?.id ?? ""),
    queryFn: () => fetchRelatedCategories(category!),
    enabled: !!category,
  });

  return {
    category: category ?? null,
    subcategories,
    stats: stats ?? null,
    relatedCategories,
    isLoading: categoryLoading,
    subcategoriesLoading,
    statsLoading,
    relatedLoading,
    error: categoryError ? (categoryError as Error).message : null,
  };
}
