// ─── Library — AI Personal Librarian: Qualitative Goals ────────────────────
// library_librarian_goals — learning/study/career/custom aspirational goals,
// distinct from library_reading_goals' quantitative cadence targets (reused
// as-is, see useReadingGoals.ts).

import { supabase } from "@/integrations/supabase/client";

export type LibraryLibrarianGoalCategory = "learning" | "study" | "career" | "custom";
export type LibraryLibrarianGoalStatus = "active" | "completed" | "abandoned";

export interface LibraryLibrarianGoalRow {
  id: string;
  user_id: string;
  goal_category: LibraryLibrarianGoalCategory;
  title: string;
  description: string | null;
  target_date: string | null;
  status: LibraryLibrarianGoalStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export async function fetchLibrarianGoals(userId: string): Promise<LibraryLibrarianGoalRow[]> {
  const { data, error } = await supabase
    .from("library_librarian_goals").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryLibrarianGoalRow[];
}

export async function createLibrarianGoal(
  userId: string, category: LibraryLibrarianGoalCategory, title: string, description?: string, targetDate?: string
): Promise<LibraryLibrarianGoalRow> {
  const { data, error } = await supabase
    .from("library_librarian_goals")
    .insert({ user_id: userId, goal_category: category, title, description: description || null, target_date: targetDate || null })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as LibraryLibrarianGoalRow;
}

export async function updateLibrarianGoalStatus(goalId: string, status: LibraryLibrarianGoalStatus): Promise<void> {
  const { error } = await supabase
    .from("library_librarian_goals")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", goalId);
  if (error) throw new Error(error.message);
}

export async function deleteLibrarianGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from("library_librarian_goals").delete().eq("id", goalId);
  if (error) throw new Error(error.message);
}
