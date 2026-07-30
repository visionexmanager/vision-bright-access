import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  StoryBookmark, StoryHighlight, StoryNote, StoryRating, ReadingProgress, ReadingStats,
  StoryDownload, StoryFavorite, DownloadFormat, UserAchievement,
} from "@/features/visionkids/types/stories.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

// ── Bookmarks ────────────────────────────────────────────────────────────
export async function fetchBookmarks(storyId?: string): Promise<StoryBookmark[]> {
  let query = kidsDb.from("kids_bookmarks").select("*").order("created_at", { ascending: false });
  if (storyId) query = query.eq("story_id", storyId);
  const { data, error } = await query.returns<StoryBookmark[]>();
  if (error) throw error;
  return data ?? [];
}

export async function addBookmark(storyId: string, pageNumber: number, label?: string): Promise<StoryBookmark> {
  const user_id = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_bookmarks")
    .insert({ user_id, story_id: storyId, page_number: pageNumber, label: label ?? null })
    .select("*")
    .single()
    .returns<StoryBookmark>();
  if (error) throw error;
  return data;
}

export async function removeBookmark(id: string): Promise<void> {
  const { error } = await kidsDb.from("kids_bookmarks").delete().eq("id", id);
  if (error) throw error;
}

// ── Highlights ───────────────────────────────────────────────────────────
export async function fetchHighlights(storyId: string): Promise<StoryHighlight[]> {
  const { data, error } = await kidsDb
    .from("kids_highlights").select("*").eq("story_id", storyId).order("created_at")
    .returns<StoryHighlight[]>();
  if (error) throw error;
  return data ?? [];
}

export async function addHighlight(storyId: string, pageNumber: number, quotedText: string, color = "yellow"): Promise<StoryHighlight> {
  const user_id = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_highlights")
    .insert({ user_id, story_id: storyId, page_number: pageNumber, quoted_text: quotedText, color })
    .select("*").single().returns<StoryHighlight>();
  if (error) throw error;
  return data;
}

export async function removeHighlight(id: string): Promise<void> {
  const { error } = await kidsDb.from("kids_highlights").delete().eq("id", id);
  if (error) throw error;
}

// ── Notes ────────────────────────────────────────────────────────────────
export async function fetchNotes(storyId: string): Promise<StoryNote[]> {
  const { data, error } = await kidsDb
    .from("kids_notes").select("*").eq("story_id", storyId).order("created_at")
    .returns<StoryNote[]>();
  if (error) throw error;
  return data ?? [];
}

export async function addNote(storyId: string, pageNumber: number, content: string): Promise<StoryNote> {
  const user_id = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_notes")
    .insert({ user_id, story_id: storyId, page_number: pageNumber, content })
    .select("*").single().returns<StoryNote>();
  if (error) throw error;
  return data;
}

export async function removeNote(id: string): Promise<void> {
  const { error } = await kidsDb.from("kids_notes").delete().eq("id", id);
  if (error) throw error;
}

// ── Favorites ────────────────────────────────────────────────────────────
export async function fetchFavorites(): Promise<StoryFavorite[]> {
  const { data, error } = await kidsDb
    .from("kids_favorites")
    .select("*, story:kids_stories(*)")
    .order("created_at", { ascending: false })
    .returns<StoryFavorite[]>();
  if (error) throw error;
  return data ?? [];
}

export async function isFavorite(storyId: string): Promise<boolean> {
  const { data, error } = await kidsDb
    .from("kids_favorites").select("id").eq("story_id", storyId).maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function toggleFavorite(storyId: string, next: boolean): Promise<void> {
  const user_id = await requireUserId();
  if (next) {
    const { error } = await kidsDb.from("kids_favorites").insert({ user_id, story_id: storyId });
    if (error && error.code !== "23505") throw error; // ignore unique-violation double-click
  } else {
    const { error } = await kidsDb.from("kids_favorites").delete().eq("user_id", user_id).eq("story_id", storyId);
    if (error) throw error;
  }
}

// ── Ratings ──────────────────────────────────────────────────────────────
export async function fetchMyRating(storyId: string): Promise<StoryRating | null> {
  const { data, error } = await kidsDb
    .from("kids_story_ratings").select("*").eq("story_id", storyId).maybeSingle()
    .returns<StoryRating>();
  if (error) throw error;
  return data ?? null;
}

export async function rateStory(storyId: string, rating: number, review?: string): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb
    .from("kids_story_ratings")
    .upsert({ user_id, story_id: storyId, rating, review: review ?? null }, { onConflict: "user_id,story_id" });
  if (error) throw error;
}

// ── Downloads ────────────────────────────────────────────────────────────
export async function fetchDownloads(): Promise<StoryDownload[]> {
  const { data, error } = await kidsDb
    .from("kids_downloads")
    .select("*, story:kids_stories(*)")
    .order("downloaded_at", { ascending: false })
    .returns<StoryDownload[]>();
  if (error) throw error;
  return data ?? [];
}

export async function logDownload(storyId: string, format: DownloadFormat): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb.from("kids_downloads").insert({ user_id, story_id: storyId, format });
  if (error) throw error;
}

// ── Reading progress / history / continue reading ───────────────────────
export async function fetchReadingProgress(storyId: string): Promise<ReadingProgress | null> {
  const { data, error } = await kidsDb
    .from("kids_reading_progress").select("*").eq("story_id", storyId).maybeSingle()
    .returns<ReadingProgress>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchContinueReading(): Promise<ReadingProgress[]> {
  const { data, error } = await kidsDb
    .from("kids_reading_progress")
    .select("*, story:kids_stories(*)")
    .eq("completed", false)
    .order("last_read_at", { ascending: false })
    .limit(20)
    .returns<ReadingProgress[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchReadingHistory(): Promise<ReadingProgress[]> {
  const { data, error } = await kidsDb
    .from("kids_reading_progress")
    .select("*, story:kids_stories(*)")
    .order("last_read_at", { ascending: false })
    .returns<ReadingProgress[]>();
  if (error) throw error;
  return data ?? [];
}

export interface SaveProgressInput {
  storyId: string;
  currentPage?: number;
  currentNodeId?: string | null;
  audioPositionSeconds?: number;
  progressPercent: number;
  minutesReadDelta?: number;
  completed?: boolean;
}

export async function saveReadingProgress(input: SaveProgressInput): Promise<void> {
  const user_id = await requireUserId();
  const existing = await fetchReadingProgress(input.storyId);
  const minutes_read = (existing?.minutes_read ?? 0) + (input.minutesReadDelta ?? 0);

  const { error } = await kidsDb.from("kids_reading_progress").upsert(
    {
      user_id,
      story_id: input.storyId,
      current_page: input.currentPage ?? existing?.current_page ?? 1,
      current_node_id: input.currentNodeId ?? existing?.current_node_id ?? null,
      audio_position_seconds: input.audioPositionSeconds ?? existing?.audio_position_seconds ?? 0,
      progress_percent: input.progressPercent,
      minutes_read,
      completed: input.completed ?? existing?.completed ?? false,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,story_id" }
  );
  if (error) throw error;
}

export async function fetchReadingStats(): Promise<ReadingStats | null> {
  const { data, error } = await kidsDb.from("kids_reading_stats").select("*").maybeSingle().returns<ReadingStats>();
  if (error) throw error;
  return data ?? null;
}

// ── Recently viewed / search history ─────────────────────────────────────
export async function logRecentlyViewed(storyId: string): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb
    .from("kids_recently_viewed")
    .upsert({ user_id, story_id: storyId, viewed_at: new Date().toISOString() }, { onConflict: "user_id,story_id" });
  if (error) throw error;
}

export async function logSearchQuery(query: string): Promise<void> {
  const user_id = await requireUserId().catch(() => null);
  if (!user_id) return; // search history is a signed-in nicety, not required to search
  const { error } = await kidsDb.from("kids_search_history").insert({ user_id, query });
  if (error) throw error;
}

// ── Achievements / VX ────────────────────────────────────────────────────
export async function fetchAllAchievements(): Promise<import("@/features/visionkids/types/stories.types").Achievement[]> {
  const { data, error } = await kidsDb.from("kids_achievements").select("*").order("reward_vx");
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyAchievements(): Promise<UserAchievement[]> {
  const { data, error } = await kidsDb
    .from("kids_user_achievements")
    .select("*, achievement:kids_achievements(*)")
    .order("earned_at", { ascending: false })
    .returns<UserAchievement[]>();
  if (error) throw error;
  return data ?? [];
}

export async function awardAchievement(key: string): Promise<void> {
  const { error } = await kidsDb.rpc("award_kids_achievement", { _key: key });
  if (error) throw error;
}

export async function awardXp(amount: number, reason: string): Promise<void> {
  const { error } = await kidsDb.rpc("award_kids_xp", { _amount: amount, _reason: reason });
  if (error) throw error;
}
