// ─── Library — Learning Hub: Reading & Learning Analytics ──────────────────

import { supabase } from "@/integrations/supabase/client";
import type { LibraryLearningAnalytics } from "@/lib/types/library-learning";

export async function fetchLearningAnalytics(bookId?: string | null): Promise<LibraryLearningAnalytics> {
  const { data, error } = await supabase.rpc("get_library_learning_analytics", { _book_id: bookId ?? null });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? {
    reading_speed_wpm: 0, avg_quiz_score_percent: null, study_time_minutes: 0,
    knowledge_retention_percent: null, flashcards_due: 0, quizzes_taken: 0, current_streak: 0,
  }) as LibraryLearningAnalytics;
}
