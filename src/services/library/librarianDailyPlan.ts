// ─── Library — AI Personal Librarian: Daily Assistant ──────────────────────

import { supabase } from "@/integrations/supabase/client";

export interface LibraryDailyPlanSection {
  summary: string;
  focus_items?: string[];
}

export interface LibraryPracticeQuestion {
  question: string;
  topic: string;
}

export interface LibraryLibrarianDailyPlanRow {
  id: string;
  user_id: string;
  plan_date: string;
  reading_plan: LibraryDailyPlanSection;
  study_plan: LibraryDailyPlanSection;
  listening_plan: LibraryDailyPlanSection;
  review_plan: LibraryDailyPlanSection;
  due_flashcard_ids: string[];
  practice_questions: LibraryPracticeQuestion[];
  motivational_summary: string;
  generated_at: string;
}

export async function fetchTodayPlan(userId: string): Promise<LibraryLibrarianDailyPlanRow | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("library_librarian_daily_plans").select("*").eq("user_id", userId).eq("plan_date", today).maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as LibraryLibrarianDailyPlanRow | null;
}

export async function generateDailyPlan(force = false): Promise<LibraryLibrarianDailyPlanRow> {
  const { data, error } = await supabase.functions.invoke("library-librarian-daily-plan", { body: { force } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.plan as LibraryLibrarianDailyPlanRow;
}
