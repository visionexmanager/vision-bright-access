import { supabase } from "@/integrations/supabase/client";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import { moderateKidsText } from "@/features/visionkids/utils/chatModeration";
import type { KidsConversation, KidsMessage } from "@/features/visionkids/types/social.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function fetchMyConversations(): Promise<KidsConversation[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_conversations").select("*")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("last_message_at", { ascending: false })
    .returns<KidsConversation[]>();
  if (error) throw error;
  return data ?? [];
}

/** Starts (or returns the existing) conversation with a friend. The DB
 *  itself refuses to create one unless the two are accepted friends (see
 *  the INSERT policy in 20260813010000) — this is the safety boundary,
 *  not just a UI nicety. */
export async function startConversation(otherUserId: string): Promise<KidsConversation> {
  const userId = await requireUserId();
  const [userA, userB] = [userId, otherUserId].sort();

  const { data: existing } = await kidsDb
    .from("kids_conversations").select("*").eq("user_a", userA).eq("user_b", userB).maybeSingle()
    .returns<KidsConversation>();
  if (existing) return existing;

  const { data, error } = await kidsDb
    .from("kids_conversations").insert({ user_a: userA, user_b: userB }).select("*").single()
    .returns<KidsConversation>();
  if (error) throw error;
  return data;
}

export async function fetchMessages(conversationId: string): Promise<KidsMessage[]> {
  const { data, error } = await kidsDb
    .from("kids_messages").select("*").eq("conversation_id", conversationId).order("created_at")
    .returns<KidsMessage[]>();
  if (error) throw error;
  return data ?? [];
}

export interface SendMessageResult {
  message: KidsMessage | null;
  blocked: boolean;
}

/** The client-side filter (moderateKidsText) is the real gate — see
 *  chatModeration.ts's header comment. If it blocks the message outright
 *  (a grooming red-flag phrase), nothing is ever sent to the server.
 *  Otherwise the (possibly redacted) text is stored, and the AI moderation
 *  edge function is fired async afterward purely to flag borderline
 *  content for later parent/admin review — it never gates sending. */
export async function sendMessage(conversationId: string, rawText: string): Promise<SendMessageResult> {
  const userId = await requireUserId();
  const result = moderateKidsText(rawText);
  if (result.blocked) {
    return { message: null, blocked: true };
  }

  const { data, error } = await kidsDb
    .from("kids_messages")
    .insert({ conversation_id: conversationId, sender_id: userId, content: result.cleanText, was_filtered: result.wasFiltered })
    .select("*").single()
    .returns<KidsMessage>();
  if (error) throw error;

  flagIfNeeded(data.id, result.cleanText);
  return { message: data, blocked: false };
}

async function flagIfNeeded(messageId: string, text: string) {
  try {
    const { data } = await supabase.functions.invoke("moderate-content", { body: { text } });
    if (data?.flagged) {
      await kidsDb.from("kids_messages").update({ is_flagged: true, flagged_categories: data.categories ?? [] }).eq("id", messageId);
    }
  } catch {
    // Best-effort only — the client-side filter already ran before send.
  }
}

export async function markConversationRead(conversationId: string, myUserId: string): Promise<void> {
  const { error } = await kidsDb
    .from("kids_messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", myUserId)
    .eq("is_read", false);
  if (error) throw error;
}
