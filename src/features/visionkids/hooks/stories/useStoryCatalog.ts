import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import * as catalog from "@/features/visionkids/services/stories/catalog";

export function useStoryCategories() {
  return useQuery({ queryKey: ["kids", "categories"], queryFn: catalog.fetchStoryCategories, staleTime: 10 * 60 * 1000 });
}

export function useStoryBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["kids", "story", slug],
    queryFn: () => catalog.fetchStoryBySlug(slug!),
    enabled: !!slug,
  });
}

export function useStoriesByCategory(categorySlug: string | undefined, page = 0, pageSize = 24) {
  return useQuery({
    queryKey: ["kids", "stories-by-category", categorySlug, page],
    queryFn: () => catalog.fetchStoriesByCategory(categorySlug!, { limit: pageSize, offset: page * pageSize }),
    enabled: !!categorySlug,
  });
}

export function useFeaturedStories(limit = 12) {
  return useQuery({ queryKey: ["kids", "featured", limit], queryFn: () => catalog.fetchFeaturedStories(limit) });
}

export function useNewStories(limit = 12) {
  return useQuery({ queryKey: ["kids", "new-stories", limit], queryFn: () => catalog.fetchNewStories(limit) });
}

export function useInteractiveStories(limit = 12) {
  return useQuery({ queryKey: ["kids", "interactive-stories", limit], queryFn: () => catalog.fetchInteractiveStories(limit) });
}

export function useStoryPages(storyId: string | undefined) {
  return useQuery({
    queryKey: ["kids", "story-pages", storyId],
    queryFn: () => catalog.fetchStoryPages(storyId!),
    enabled: !!storyId,
  });
}

export function useStoryChapters(storyId: string | undefined) {
  return useQuery({
    queryKey: ["kids", "story-chapters", storyId],
    queryFn: () => catalog.fetchStoryChapters(storyId!),
    enabled: !!storyId,
  });
}

export function useInteractiveStoryGraph(storyId: string | undefined) {
  return useQuery({
    queryKey: ["kids", "story-graph", storyId],
    queryFn: () => catalog.fetchInteractiveStoryGraph(storyId!),
    enabled: !!storyId,
  });
}

/** Fires once per story per browser tab session (sessionStorage-guarded) so
 *  re-renders/StrictMode double-invokes don't inflate the view counter. */
export function useIncrementStoryViewsOnce(storyId: string | undefined) {
  const mutation = useMutation({ mutationFn: catalog.incrementStoryViews });

  useEffect(() => {
    if (!storyId) return;
    const key = `kids:viewed:${storyId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    mutation.mutate(storyId);
    // mutation is stable across renders (react-query), safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);
}
