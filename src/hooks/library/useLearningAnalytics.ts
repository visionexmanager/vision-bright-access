import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchLearningAnalytics } from "@/services/library/learningAnalytics";

export function useLearningAnalytics(bookId?: string | null) {
  const { user } = useAuth();
  const { data: analytics, isLoading } = useQuery({
    queryKey: queryKeys.library.learningAnalytics(user?.id ?? "", bookId ?? "all"),
    queryFn: () => fetchLearningAnalytics(bookId),
    enabled: !!user,
  });
  return { analytics, isLoading };
}
