/**
 * useRecommendations — reads the library_book_recommendations cache
 * (populated server-side by the library-recommend-books edge function).
 * Read-only from the frontend; an empty result is a legitimate state (the
 * cache hasn't been generated for this user yet), not an error.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchRecommendations } from "@/services/library/recommendations";

export function useRecommendations(limit = 12) {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.recommendations(uid),
    enabled: !!user,
    queryFn: () => fetchRecommendations(uid, limit),
    staleTime: 30 * 60 * 1000,
  });

  return { books: data ?? [], isLoading, error: error ? (error as Error).message : null, refetch };
}
