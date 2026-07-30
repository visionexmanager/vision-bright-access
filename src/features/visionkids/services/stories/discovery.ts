import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import { fetchFeaturedStories } from "@/features/visionkids/services/stories/catalog";
import type { Story, StorySearchFilters } from "@/features/visionkids/types/stories.types";

export async function searchStories(filters: StorySearchFilters, { limit = 24, offset = 0 } = {}): Promise<{ stories: Story[]; count: number }> {
  let query = kidsDb.from("kids_stories").select("*", { count: "exact" }).eq("status", "published");

  if (filters.query?.trim()) {
    query = query.textSearch("search_vector", filters.query.trim(), { type: "websearch", config: "simple" });
  }
  if (filters.ageGroup) query = query.eq("age_group", filters.ageGroup);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.authorId) query = query.eq("author_id", filters.authorId);
  if (filters.maxDurationMinutes) query = query.lte("reading_time_minutes", filters.maxDurationMinutes);

  if (filters.categorySlug) {
    const { data: category } = await kidsDb
      .from("kids_story_categories").select("id").eq("slug", filters.categorySlug).maybeSingle();
    if (category) query = query.eq("category_id", (category as { id: string }).id);
    else return { stories: [], count: 0 };
  }

  const { data, error, count } = await query
    .order("rating_avg", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<Story[]>();
  if (error) throw error;
  return { stories: data ?? [], count: count ?? 0 };
}

export async function fetchRecentlyViewedStories(limit = 12): Promise<Story[]> {
  const { data, error } = await kidsDb
    .from("kids_recently_viewed")
    .select("viewed_at, story:kids_stories(*)")
    .order("viewed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as { story: Story }[]).map((row) => row.story).filter(Boolean);
}

/**
 * Real recommendation heuristic (no LLM call, matches the repo's own
 * "suggest similar books = real DB data, not an LLM call" precedent —
 * see library-ai-assistant's header comment): favorites' most-common
 * category/age_group/language, excluding already-read stories. Falls back
 * to fetchFeaturedStories when the user has no signal yet (signed out or
 * brand new).
 */
export async function fetchRecommendedStories(limit = 12): Promise<Story[]> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return fetchFeaturedStories(limit);

  const { data: favorites } = await kidsDb
    .from("kids_favorites").select("story:kids_stories(category_id, age_group, language)").eq("user_id", userId);
  const { data: progress } = await kidsDb
    .from("kids_reading_progress").select("story_id, story:kids_stories(category_id, age_group, language)").eq("user_id", userId);

  const signalRows = [
    ...((favorites ?? []) as unknown as { story: { category_id: string | null; age_group: string; language: string } }[]).map((r) => r.story),
    ...((progress ?? []) as unknown as { story: { category_id: string | null; age_group: string; language: string } }[]).map((r) => r.story),
  ].filter(Boolean);

  const readStoryIds = ((progress ?? []) as unknown as { story_id: string }[]).map((r) => r.story_id);

  if (signalRows.length === 0) return fetchFeaturedStories(limit);

  const mostCommon = <T,>(values: T[]): T | undefined => {
    const counts = new Map<T, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };

  const topCategory = mostCommon(signalRows.map((r) => r.category_id).filter(Boolean) as string[]);
  const topAgeGroup = mostCommon(signalRows.map((r) => r.age_group));
  const topLanguage = mostCommon(signalRows.map((r) => r.language));

  let query = kidsDb.from("kids_stories").select("*").eq("status", "published");
  if (topCategory) query = query.eq("category_id", topCategory);
  if (topAgeGroup) query = query.eq("age_group", topAgeGroup);
  if (topLanguage) query = query.eq("language", topLanguage);
  if (readStoryIds.length > 0) query = query.not("id", "in", `(${readStoryIds.join(",")})`);

  const { data, error } = await query.order("rating_avg", { ascending: false }).limit(limit).returns<Story[]>();
  if (error) throw error;
  if (!data || data.length === 0) return fetchFeaturedStories(limit);
  return data;
}
