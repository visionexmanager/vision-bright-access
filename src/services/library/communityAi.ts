// ─── Library — Community AI Features (Phase 12: Reading Community) ────────

import { supabase } from "@/integrations/supabase/client";

export interface LibraryRecommendedClub {
  id: string;
  slug: string;
  name: string;
  score: number;
  reason: string;
}

export interface LibraryRecommendedFriend {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  reason: string;
}

export async function fetchCommunityRecommendations(limit = 10): Promise<{ clubs: LibraryRecommendedClub[]; friends: LibraryRecommendedFriend[] }> {
  const { data, error } = await supabase.functions.invoke("library-recommend-community", { body: { limit } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { clubs: data.clubs ?? [], friends: data.friends ?? [] };
}

export async function summarizeDiscussion(topicId: string): Promise<{ summary: string; keyPoints: string[] }> {
  const { data, error } = await supabase.functions.invoke("library-summarize-discussion", { body: { topic_id: topicId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { summary: data.summary, keyPoints: data.key_points ?? [] };
}

export async function translateComment(text: string, targetLanguage: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("library-translate-comment", { body: { text, target_language: targetLanguage } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.translated_text as string;
}

export interface LibraryReadingPlan {
  planSummary: string;
  weeklyFocus: string[];
  bookSuggestionTitles: string[];
  studyFocus: string[];
}

export async function generateReadingPlan(): Promise<LibraryReadingPlan> {
  const { data, error } = await supabase.functions.invoke("library-generate-reading-plan", { body: {} });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return {
    planSummary: data.plan_summary, weeklyFocus: data.weekly_focus ?? [],
    bookSuggestionTitles: data.book_suggestion_titles ?? [], studyFocus: data.study_focus ?? [],
  };
}
