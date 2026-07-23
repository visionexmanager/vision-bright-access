/**
 * useRecentlyViewed — the "Recently Viewed" rail's data source (signed-in
 * only). Recording a view happens separately, in LibraryBookDetails.tsx on
 * mount — this hook only reads.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchRecentlyViewed } from "@/services/library/recentlyViewed";

export function useRecentlyViewed(limit = 12) {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.recentlyViewed(uid),
    enabled: !!user,
    queryFn: () => fetchRecentlyViewed(uid, limit),
  });

  return { books: data ?? [], isLoading, error: error ? (error as Error).message : null, refetch };
}
