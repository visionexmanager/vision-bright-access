/**
 * useAuthorDashboard — the Author Dashboard's data: top-line stats, the
 * monthly trend chart, the studio's book list, and the pending-review
 * list. Requires the signed-in user to already have a library_authors
 * profile (see useBecomeAuthor) — callers should redirect to the "Become
 * an Author" flow when authorId is undefined.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchAuthorDashboardStats, fetchAuthorMonthlyStats, fetchPendingReviewBooks, fetchStudioBooks } from "@/services/library/studio";

export function useAuthorDashboard(authorId: string | undefined) {
  const statsQuery = useQuery({
    queryKey: queryKeys.library.studio.dashboardStats(authorId ?? ""),
    queryFn: () => fetchAuthorDashboardStats(authorId!),
    enabled: !!authorId,
  });

  const monthlyQuery = useQuery({
    queryKey: queryKeys.library.studio.monthlyStats(authorId ?? ""),
    queryFn: () => fetchAuthorMonthlyStats(authorId!),
    enabled: !!authorId,
  });

  const booksQuery = useQuery({
    queryKey: queryKeys.library.studio.books(authorId ?? ""),
    queryFn: () => fetchStudioBooks(authorId!),
    enabled: !!authorId,
  });

  const pendingReviewQuery = useQuery({
    queryKey: queryKeys.library.studio.pendingReview(authorId ?? ""),
    queryFn: () => fetchPendingReviewBooks(authorId!),
    enabled: !!authorId,
  });

  return {
    stats: statsQuery.data ?? null,
    isLoadingStats: statsQuery.isLoading,
    monthlyStats: monthlyQuery.data ?? [],
    books: booksQuery.data ?? [],
    isLoadingBooks: booksQuery.isLoading,
    pendingReviewBooks: pendingReviewQuery.data ?? [],
  };
}
