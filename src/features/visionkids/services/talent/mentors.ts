import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { MentorRequest } from "@/features/visionkids/types/talent.types";

export async function fetchMyMentorRequests(): Promise<MentorRequest[]> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_mentor_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false })
    .returns<MentorRequest[]>();
  if (error) throw error;
  return data ?? [];
}

export async function requestMentor(mentorSlug: string, topic?: string): Promise<MentorRequest> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error("Must be signed in");
  const { data, error } = await kidsDb
    .from("kids_mentor_requests")
    .insert({ user_id: userId, mentor_slug: mentorSlug, topic: topic ?? null })
    .select("*").single()
    .returns<MentorRequest>();
  if (error) throw error;
  return data;
}

export async function cancelMentorRequest(id: string): Promise<void> {
  const { error } = await kidsDb.from("kids_mentor_requests").delete().eq("id", id);
  if (error) throw error;
}
