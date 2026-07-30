import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  Story, StoryWithRelations, StoryCategory, StoryPage, StoryChapter, StoryNode, StoryChoice,
} from "@/features/visionkids/types/stories.types";

const STORY_RELATIONS = "*, category:kids_story_categories(*), author:kids_story_authors(*), narrator:kids_story_narrators(*)";

export async function fetchStoryCategories(): Promise<StoryCategory[]> {
  const { data, error } = await kidsDb
    .from("kids_story_categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order")
    .returns<StoryCategory[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchStoryCategoryBySlug(slug: string): Promise<StoryCategory | null> {
  const { data, error } = await kidsDb
    .from("kids_story_categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle()
    .returns<StoryCategory>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchStoryBySlug(slug: string): Promise<StoryWithRelations | null> {
  const { data, error } = await kidsDb
    .from("kids_stories")
    .select(STORY_RELATIONS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()
    .returns<StoryWithRelations>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchStoryById(id: string): Promise<StoryWithRelations | null> {
  const { data, error } = await kidsDb
    .from("kids_stories")
    .select(STORY_RELATIONS)
    .eq("id", id)
    .maybeSingle()
    .returns<StoryWithRelations>();
  if (error) throw error;
  return data ?? null;
}

export interface StoriesPage {
  stories: Story[];
  count: number;
}

export async function fetchStoriesByCategory(
  categorySlug: string,
  { limit = 24, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<StoriesPage> {
  const category = await fetchStoryCategoryBySlug(categorySlug);
  if (!category) return { stories: [], count: 0 };

  const { data, error, count } = await kidsDb
    .from("kids_stories")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .eq("category_id", category.id)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<Story[]>();
  if (error) throw error;
  return { stories: data ?? [], count: count ?? 0 };
}

export async function fetchFeaturedStories(limit = 12): Promise<Story[]> {
  const { data, error } = await kidsDb
    .from("kids_stories")
    .select("*")
    .eq("status", "published")
    .order("views_count", { ascending: false })
    .limit(limit)
    .returns<Story[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchNewStories(limit = 12): Promise<Story[]> {
  const { data, error } = await kidsDb
    .from("kids_stories")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit)
    .returns<Story[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchInteractiveStories(limit = 12): Promise<Story[]> {
  const { data, error } = await kidsDb
    .from("kids_stories")
    .select("*")
    .eq("status", "published")
    .eq("is_interactive", true)
    .limit(limit)
    .returns<Story[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchStoryPages(storyId: string): Promise<StoryPage[]> {
  const { data, error } = await kidsDb
    .from("kids_story_pages")
    .select("*")
    .eq("story_id", storyId)
    .order("page_number")
    .returns<StoryPage[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchStoryChapters(storyId: string): Promise<StoryChapter[]> {
  const { data, error } = await kidsDb
    .from("kids_story_chapters")
    .select("*")
    .eq("story_id", storyId)
    .order("chapter_number")
    .returns<StoryChapter[]>();
  if (error) throw error;
  return data ?? [];
}

export interface InteractiveStoryGraph {
  nodes: StoryNode[];
  choices: StoryChoice[];
}

export async function fetchInteractiveStoryGraph(storyId: string): Promise<InteractiveStoryGraph> {
  const { data: nodes, error: nodesError } = await kidsDb
    .from("kids_story_nodes")
    .select("*")
    .eq("story_id", storyId)
    .returns<StoryNode[]>();
  if (nodesError) throw nodesError;

  const nodeIds = (nodes ?? []).map((n) => n.id);
  if (nodeIds.length === 0) return { nodes: nodes ?? [], choices: [] };

  const { data: choices, error: choicesError } = await kidsDb
    .from("kids_story_choices")
    .select("*")
    .in("node_id", nodeIds)
    .order("order_index")
    .returns<StoryChoice[]>();
  if (choicesError) throw choicesError;

  return { nodes: nodes ?? [], choices: choices ?? [] };
}

export async function incrementStoryViews(storyId: string): Promise<void> {
  const { error } = await kidsDb.rpc("increment_kids_story_views", { _story_id: storyId });
  if (error) throw error;
}
