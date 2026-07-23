// ─── Library — Learning Hub: Book-to-Course conversion ─────────────────────

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookCourseRow, LibraryCourseLearningObjectiveRow } from "@/lib/types/library-learning";

export async function fetchBookCourseLink(bookId: string): Promise<LibraryBookCourseRow | null> {
  const { data, error } = await supabase.from("library_book_courses").select("*").eq("book_id", bookId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryBookCourseRow | null;
}

export async function convertBookToCourse(bookId: string, title: string, level: string): Promise<string> {
  const { data, error } = await supabase.rpc("convert_library_book_to_course", { _book_id: bookId, _title: title, _level: level });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchCourseLearningObjectives(academyCourseId: string): Promise<LibraryCourseLearningObjectiveRow[]> {
  const { data, error } = await supabase
    .from("library_course_learning_objectives").select("*").eq("academy_course_id", academyCourseId).order("order_index");
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryCourseLearningObjectiveRow[];
}

export async function addCourseLearningObjective(academyCourseId: string, objectiveText: string, orderIndex: number, chapterId?: string | null): Promise<void> {
  const { error } = await supabase
    .from("library_course_learning_objectives")
    .insert({ academy_course_id: academyCourseId, objective_text: objectiveText, order_index: orderIndex, chapter_id: chapterId ?? null });
  if (error) throw new Error(error.message);
}

export async function syncChapterProgressToAcademy(chapterId: string, completed = true): Promise<void> {
  const { error } = await supabase.rpc("sync_library_progress_to_academy", { _chapter_id: chapterId, _completed: completed });
  if (error) throw new Error(error.message);
}
