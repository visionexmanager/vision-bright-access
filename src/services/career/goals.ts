// ─── Career Center — Goals Service (Phase 1 backend) ──────────────────────────
// Table: career_goals. RLS: owner-only.

import { supabase } from "@/integrations/supabase/client";
import type { CareerGoalRow } from "@/lib/types/career";

export async function fetchMyCareerGoals(userId: string): Promise<CareerGoalRow[]> {
  const { data, error } = await supabase.from("career_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CareerGoalRow[];
}

export interface NewCareerGoal {
  title: string;
  priority?: "low" | "medium" | "high";
  deadline?: string;
  estimated_completion?: string;
}

export async function createCareerGoal(userId: string, goal: NewCareerGoal): Promise<CareerGoalRow> {
  const { data, error } = await supabase.from("career_goals")
    .insert({ user_id: userId, ...goal })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CareerGoalRow;
}

export async function updateCareerGoalProgress(goalId: string, progress: number): Promise<void> {
  const { error } = await supabase.from("career_goals")
    .update({ progress: Math.max(0, Math.min(100, progress)) })
    .eq("id", goalId);
  if (error) throw new Error(error.message);
}

export async function deleteCareerGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from("career_goals").delete().eq("id", goalId);
  if (error) throw new Error(error.message);
}
