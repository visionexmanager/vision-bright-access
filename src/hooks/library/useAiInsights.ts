import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchTrendingTopics } from "@/services/library/knowledgeGraph";

export function useAiInsights(limit = 12) {
  const { data: trendingTopics = [], isLoading } = useQuery({
    queryKey: queryKeys.library.trendingTopics(),
    queryFn: () => fetchTrendingTopics(limit),
    staleTime: 30 * 60 * 1000,
  });

  return { trendingTopics, isLoading };
}
