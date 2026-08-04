import { kidsDb, rpcResult } from "@/features/visionkids/services/stories/kidsSupabase";
import type { HabitLog, MoodLog, SleepLog, WellnessSession, Mood, SleepQuality } from "@/features/visionkids/types/wellness.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

// ── Habits ────────────────────────────────────────────────────────────────
export async function fetchHabitLogs(date: string): Promise<HabitLog[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_habit_logs").select("*").eq("user_id", userId).eq("log_date", date)
    .returns<HabitLog[]>();
  if (error) throw error;
  return data ?? [];
}

export interface LogHabitResult { newly_logged: boolean; streak: number; }

export async function logHabit(habitSlug: string, date: string): Promise<LogHabitResult> {
  const { data, error } = await kidsDb.rpc("log_kids_habit", { _habit_slug: habitSlug, _date: date });
  if (error) throw error;
  return rpcResult<LogHabitResult>(data);
}

// ── Mood ──────────────────────────────────────────────────────────────────
export async function fetchMoodLogs(limit = 30): Promise<MoodLog[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_mood_logs").select("*").eq("user_id", userId).order("log_date", { ascending: false }).limit(limit)
    .returns<MoodLog[]>();
  if (error) throw error;
  return data ?? [];
}

export async function logMood(mood: Mood, color?: string, note?: string): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("log_kids_mood", { _mood: mood, _color: color ?? null, _note: note ?? null });
  if (error) throw error;
  return !!data;
}

// ── Sleep ─────────────────────────────────────────────────────────────────
export async function fetchSleepLogs(limit = 14): Promise<SleepLog[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_sleep_logs").select("*").eq("user_id", userId).order("log_date", { ascending: false }).limit(limit)
    .returns<SleepLog[]>();
  if (error) throw error;
  return data ?? [];
}

export async function logSleep(bedtime: string, wakeTime: string, durationMinutes: number, quality?: SleepQuality): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("log_kids_sleep", {
    _bedtime: bedtime, _wake_time: wakeTime, _duration_minutes: durationMinutes, _quality: quality ?? null,
  });
  if (error) throw error;
  return !!data;
}

// ── Sessions (exercise / mindfulness) ──────────────────────────────────────
export async function fetchSessions(limit = 20): Promise<WellnessSession[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_wellness_sessions").select("*").eq("user_id", userId).order("logged_at", { ascending: false }).limit(limit)
    .returns<WellnessSession[]>();
  if (error) throw error;
  return data ?? [];
}

export async function logSession(kind: "exercise" | "mindfulness", refSlug: string, minutes: number): Promise<void> {
  const { error } = await kidsDb.rpc("log_kids_wellness_session", { _kind: kind, _ref_slug: refSlug, _minutes: minutes });
  if (error) throw error;
}
