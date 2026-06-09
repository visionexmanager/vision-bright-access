/**
 * Academy Service — All Supabase operations for the Academy module.
 *
 * No React / hooks here — pure async functions.
 * Called from hooks (useAcademyProfile, useAcademyChat).
 *
 * Tables used:
 *   - academy_profiles      (student onboarding data + XP)
 *   - academy_chat_sessions (persistent chat history)
 *   - academy_xp_events     (XP via RPC award_academy_xp)
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  AcademyProfileRow,
  AcademyProfileInsert,
  AcademyProfileUpdate,
  AcademyChatSessionRow,
  AcademyChatSessionInsert,
  StudentProfile,
  AcademyXPReason,
} from "@/lib/types";

// ── Profile ───────────────────────────────────────────────────────────────────

/**
 * Load student profile from DB.
 * Returns null if the user has not completed onboarding yet.
 */
export async function getAcademyProfile(
  userId: string
): Promise<AcademyProfileRow | null> {
  const { data, error } = await (supabase.from("academy_profiles") as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as AcademyProfileRow | null;
}

/**
 * Create or update the student profile after onboarding.
 * Uses UPSERT so it's safe to call multiple times.
 */
export async function saveAcademyProfile(
  userId: string,
  profile: StudentProfile
): Promise<AcademyProfileRow> {
  const payload: AcademyProfileInsert = {
    user_id: userId,
    name:    profile.name,
    gender:  profile.gender,
    country: profile.country,
    level:   profile.level,
  };

  const { data, error } = await (supabase.from("academy_profiles") as any)
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as AcademyProfileRow;
}

/**
 * Update specific fields of the academy profile.
 */
export async function updateAcademyProfile(
  userId: string,
  updates: AcademyProfileUpdate
): Promise<void> {
  const { error } = await (supabase.from("academy_profiles") as any)
    .update(updates)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

/**
 * Touch last_active timestamp (called when user opens Academy).
 */
export async function touchAcademyLastActive(userId: string): Promise<void> {
  await updateAcademyProfile(userId, { last_active: new Date().toISOString() });
}

// ── Chat History ──────────────────────────────────────────────────────────────

/**
 * Load recent chat history for a user.
 * Returns the last `limit` messages across all sessions, newest first.
 */
export async function getRecentChatHistory(
  userId: string,
  limit = 50
): Promise<AcademyChatSessionRow[]> {
  const { data, error } = await (supabase.from("academy_chat_sessions") as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  // Return in chronological order for display
  return ((data ?? []) as AcademyChatSessionRow[]).reverse();
}

/**
 * Load all messages for a specific session.
 */
export async function getSessionMessages(
  userId: string,
  sessionId: string
): Promise<AcademyChatSessionRow[]> {
  const { data, error } = await (supabase.from("academy_chat_sessions") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AcademyChatSessionRow[];
}

/**
 * Persist a single message (user or assistant) to the DB.
 */
export async function saveChatMessage(
  message: AcademyChatSessionInsert
): Promise<void> {
  const { error } = await (supabase.from("academy_chat_sessions") as any)
    .insert(message);

  if (error) {
    // Non-fatal: log but don't break the chat experience
    console.warn("[academyService] Failed to save message:", error.message);
  }
}

/**
 * Persist a user + assistant message pair atomically.
 * Called after the SSE stream completes.
 */
export async function saveChatMessagePair(params: {
  userId: string;
  sessionId: string;
  userContent: string;
  assistantContent: string;
}): Promise<void> {
  const { userId, sessionId, userContent, assistantContent } = params;

  const messages: AcademyChatSessionInsert[] = [
    { user_id: userId, session_id: sessionId, role: "user",      content: userContent      },
    { user_id: userId, session_id: sessionId, role: "assistant",  content: assistantContent },
  ];

  const { error } = await (supabase.from("academy_chat_sessions") as any)
    .insert(messages);

  if (error) {
    console.warn("[academyService] Failed to save message pair:", error.message);
  }
}

/**
 * Delete all chat messages for a session (when user clicks "clear chat").
 */
export async function clearChatSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const { error } = await (supabase.from("academy_chat_sessions") as any)
    .delete()
    .eq("user_id", userId)
    .eq("session_id", sessionId);

  if (error) throw new Error(error.message);
}

// ── XP ────────────────────────────────────────────────────────────────────────

/** XP awarded per action type */
export const ACADEMY_XP_RATES: Record<AcademyXPReason, number> = {
  academy_message_sent:       5,
  academy_aptitude_completed: 50,
  academy_streak:             20,
  academy_scan_used:          10,
  academy_study_room:         15,
  academy_daily_login:        10,
};

/**
 * Award XP for an Academy action.
 * Calls the `award_academy_xp` RPC which:
 *   1. Inserts into academy_xp_events
 *   2. Inserts into user_points (global VX)
 *   3. Updates academy_profiles.xp_total
 */
export async function awardAcademyXP(
  userId: string,
  reason: AcademyXPReason
): Promise<boolean> {
  const amount = ACADEMY_XP_RATES[reason] ?? 5;

  const { error } = await supabase.rpc("award_academy_xp", {
    _user_id: userId,
    _amount:  amount,
    _reason:  reason,
  });

  if (error) {
    console.warn("[academyService] awardAcademyXP error:", error.message);
    return false;
  }
  return true;
}

/**
 * Check if the user has already earned daily login XP today.
 * Prevents double-awarding on multiple page loads.
 */
export async function hasDailyLoginXPToday(userId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await (supabase.from("academy_xp_events") as any)
    .select("id")
    .eq("user_id", userId)
    .eq("reason", "academy_daily_login")
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`)
    .limit(1);

  return (data?.length ?? 0) > 0;
}
