// ─── Library — AI Reading Preferences Service (Phase 8) ───────────────────
// Wraps library_ai_preferences (20260727000000_library_ai_assistant_v2.sql)
// — one row per user, RLS "user manages own".

import { supabase } from "@/integrations/supabase/client";
import type { AiPreferencesRow } from "@/lib/types/library-ai";

export async function fetchAiPreferences(userId: string): Promise<AiPreferencesRow | null> {
  const { data, error } = await supabase
    .from("library_ai_preferences")
    .select(`user_id, reading_mode, voice, speech_speed, speech_pitch, last_translation_language, updated_at,
      reading_speed_pages_per_hour, listening_speed_preference, preferred_book_length, learning_style,
      preferred_reading_time, accessibility_preferences, memory_paused, memory_paused_at`)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AiPreferencesRow | null;
}

export async function saveAiPreferences(userId: string, patch: Partial<Omit<AiPreferencesRow, "user_id" | "updated_at">>): Promise<void> {
  const { error } = await supabase.from("library_ai_preferences").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
