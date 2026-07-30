import { supabase } from "@/integrations/supabase/client";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import { moderateKidsText } from "@/features/visionkids/utils/chatModeration";
import type { KidsEventMessage, KidsEventPoll, KidsEventPollVote, KidsEventQuestion } from "@/features/visionkids/types/events.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

// ── Live chat (same safety model as kids_messages / kids_social_group_messages, Phase 7) ──
export async function fetchEventMessages(eventId: string): Promise<KidsEventMessage[]> {
  const { data, error } = await kidsDb
    .from("kids_event_messages").select("*").eq("event_id", eventId).order("created_at")
    .returns<KidsEventMessage[]>();
  if (error) throw error;
  return data ?? [];
}

export async function sendEventMessage(eventId: string, rawText: string): Promise<{ message: KidsEventMessage | null; blocked: boolean }> {
  const userId = await requireUserId();
  const result = moderateKidsText(rawText);
  if (result.blocked) return { message: null, blocked: true };

  const { data, error } = await kidsDb
    .from("kids_event_messages")
    .insert({ event_id: eventId, user_id: userId, content: result.cleanText, was_filtered: result.wasFiltered })
    .select("*").single()
    .returns<KidsEventMessage>();
  if (error) throw error;

  supabase.functions.invoke("moderate-content", { body: { text: result.cleanText } }).then(({ data: modData }) => {
    if (modData?.flagged) {
      kidsDb.from("kids_event_messages").update({ is_flagged: true, flagged_categories: modData.categories ?? [] }).eq("id", data.id);
    }
  }).catch(() => {});

  return { message: data, blocked: false };
}

// ── Live polls ──
export async function fetchEventPolls(eventId: string): Promise<KidsEventPoll[]> {
  const { data, error } = await kidsDb
    .from("kids_event_polls").select("*").eq("event_id", eventId).order("created_at", { ascending: false })
    .returns<KidsEventPoll[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createPoll(eventId: string, question: string, options: string[]): Promise<KidsEventPoll> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_event_polls").insert({ event_id: eventId, question, options, created_by: userId }).select("*").single()
    .returns<KidsEventPoll>();
  if (error) throw error;
  return data;
}

export async function closePoll(pollId: string): Promise<void> {
  const { error } = await kidsDb.from("kids_event_polls").update({ is_active: false }).eq("id", pollId);
  if (error) throw error;
}

export async function fetchPollVotes(pollId: string): Promise<KidsEventPollVote[]> {
  const { data, error } = await kidsDb.from("kids_event_poll_votes").select("*").eq("poll_id", pollId).returns<KidsEventPollVote[]>();
  if (error) throw error;
  return data ?? [];
}

export async function castVote(pollId: string, optionIndex: number): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb.from("kids_event_poll_votes").insert({ poll_id: pollId, user_id: userId, option_index: optionIndex });
  if (error) throw error;

  await kidsDb.rpc("award_kids_achievement", { _key: "poll_participant" }).then(() => {}, () => {});
}

// ── Live Q&A ──
export async function fetchEventQuestions(eventId: string): Promise<KidsEventQuestion[]> {
  const { data, error } = await kidsDb
    .from("kids_event_questions").select("*").eq("event_id", eventId).order("upvote_count", { ascending: false })
    .returns<KidsEventQuestion[]>();
  if (error) throw error;
  return data ?? [];
}

export async function askQuestion(eventId: string, question: string): Promise<KidsEventQuestion> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_event_questions").insert({ event_id: eventId, user_id: userId, question }).select("*").single()
    .returns<KidsEventQuestion>();
  if (error) throw error;

  await kidsDb.rpc("award_kids_achievement", { _key: "question_asker" }).then(() => {}, () => {});
  return data;
}

export async function upvoteQuestion(questionId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb.from("kids_event_question_upvotes").insert({ question_id: questionId, user_id: userId });
  if (error) throw error;
}

export async function removeUpvote(questionId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb.from("kids_event_question_upvotes").delete().eq("question_id", questionId).eq("user_id", userId);
  if (error) throw error;
}

export async function answerQuestion(questionId: string, answerText: string): Promise<void> {
  const { error } = await kidsDb
    .from("kids_event_questions")
    .update({ is_answered: true, answer_text: answerText, answered_at: new Date().toISOString() })
    .eq("id", questionId);
  if (error) throw error;
}
