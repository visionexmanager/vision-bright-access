import { useQuery, useMutation } from "@tanstack/react-query";
import * as discovery from "@/features/visionkids/services/stories/discovery";
import { logRecentlyViewed, logSearchQuery } from "@/features/visionkids/services/stories/engagement";
import type { StorySearchFilters } from "@/features/visionkids/types/stories.types";

export function useSearchStories(filters: StorySearchFilters, page = 0, pageSize = 24) {
  return useQuery({
    queryKey: ["kids", "search", filters, page],
    queryFn: () => discovery.searchStories(filters, { limit: pageSize, offset: page * pageSize }),
  });
}

export function useRecommendedStories(limit = 12) {
  return useQuery({ queryKey: ["kids", "recommended", limit], queryFn: () => discovery.fetchRecommendedStories(limit) });
}

export function useRecentlyViewedStories(limit = 12) {
  return useQuery({ queryKey: ["kids", "recently-viewed", limit], queryFn: () => discovery.fetchRecentlyViewedStories(limit) });
}

export function useLogRecentlyViewed() {
  return useMutation({ mutationFn: (storyId: string) => logRecentlyViewed(storyId) });
}

export function useLogSearchQuery() {
  return useMutation({ mutationFn: (query: string) => logSearchQuery(query) });
}
