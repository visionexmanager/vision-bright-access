import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import { supabase } from "@/integrations/supabase/client";
import type { AiStory, AgeGroup } from "@/features/visionkids/types/stories.types";

export interface GenerateAiStoryInput {
  prompt: string;
  ageGroup?: AgeGroup;
  language?: string;
}

/** Calls the kids-story-generate edge function, then persists the result to
 *  kids_ai_stories. Two round-trips (generate, then save) so the child sees
 *  the story the instant it's ready instead of waiting on the DB write too. */
export async function generateAiStory(input: GenerateAiStoryInput): Promise<AiStory> {
  const { data, error } = await supabase.functions.invoke("kids-story-generate", {
    body: { prompt: input.prompt, ageGroup: input.ageGroup ?? "6-8", language: input.language ?? "en" },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  const { data: authData } = await kidsDb.auth.getUser();
  const user_id = authData.user?.id;
  if (!user_id) throw new Error("Must be signed in");

  const { data: saved, error: saveError } = await kidsDb
    .from("kids_ai_stories")
    .insert({
      user_id,
      prompt: input.prompt,
      title: data.title,
      pages: data.pages,
      characters: data.characters,
      cover_image_url: data.coverImageUrl ?? null,
      moral_lesson: data.moralLesson,
      vocabulary: data.vocabulary,
      quiz: data.quiz,
      status: "ready",
    })
    .select("*").single().returns<AiStory>();
  if (saveError) throw saveError;
  return saved;
}

export async function fetchMyAiStories(): Promise<AiStory[]> {
  const { data, error } = await kidsDb
    .from("kids_ai_stories").select("*").order("created_at", { ascending: false })
    .returns<AiStory[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchAiStoryById(id: string): Promise<AiStory | null> {
  const { data, error } = await kidsDb
    .from("kids_ai_stories").select("*").eq("id", id).maybeSingle()
    .returns<AiStory>();
  if (error) throw error;
  return data ?? null;
}

export async function deleteAiStory(id: string): Promise<void> {
  const { error } = await kidsDb.from("kids_ai_stories").delete().eq("id", id);
  if (error) throw error;
}

export async function setAiStoryPublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await kidsDb.from("kids_ai_stories").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}
