// ─── Library — Reading Goals + Streaks (Phase 12: Reading Community) ──────

import { supabase } from "@/integrations/supabase/client";

export type LibraryGoalType = "books_per_month" | "pages_per_day" | "listening_minutes_per_day" | "minutes_per_day" | "sessions_per_week" | "custom";

export interface LibraryReadingGoalRow {
  id: string;
  user_id: string;
  goal_type: LibraryGoalType;
  target: number;
  custom_label: string | null;
  is_active: boolean;
  created_at: string;
}

export async function fetchReadingGoals(userId: string): Promise<LibraryReadingGoalRow[]> {
  const { data, error } = await supabase.from("library_reading_goals").select("*").eq("user_id", userId).eq("is_active", true).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryReadingGoalRow[];
}

export async function createReadingGoal(userId: string, goalType: LibraryGoalType, target: number, customLabel: string | null): Promise<void> {
  const { error } = await supabase.from("library_reading_goals").insert({ user_id: userId, goal_type: goalType, target, custom_label: customLabel });
  if (error) throw new Error(error.message);
}

export async function deactivateReadingGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from("library_reading_goals").update({ is_active: false }).eq("id", goalId);
  if (error) throw new Error(error.message);
}

export async function logReadingActivity(pages: number, minutes: number): Promise<void> {
  const { error } = await supabase.rpc("log_library_reading_activity", { _pages: pages, _minutes: minutes });
  if (error) throw new Error(error.message);
}

export async function fetchReadingStreak(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_library_reading_streak", { _user_id: userId });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}
