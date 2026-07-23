// ─── Library — Learning Hub: Academy Integration ───────────────────────────
// Books attached to courses, course-scoped reading lists, and instructor
// book recommendations — the non-conversion side of Book-to-Course (see
// bookToCourse.ts for the actual conversion RPC).

import { supabase } from "@/integrations/supabase/client";
import type { LibraryAcademyCourseBookRow, LibraryInstructorBookRecommendationRow } from "@/lib/types/library-learning";

export async function fetchCourseBooks(academyCourseId: string): Promise<LibraryAcademyCourseBookRow[]> {
  const { data, error } = await supabase.from("library_academy_course_books").select("*").eq("academy_course_id", academyCourseId).order("order_index");
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryAcademyCourseBookRow[];
}

export async function attachBookToCourse(academyCourseId: string, bookId: string, isRequired = true): Promise<void> {
  const { error } = await supabase.from("library_academy_course_books").insert({ academy_course_id: academyCourseId, book_id: bookId, is_required: isRequired });
  if (error) throw new Error(error.message);
}

export async function detachBookFromCourse(id: string): Promise<void> {
  const { error } = await supabase.from("library_academy_course_books").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchInstructorRecommendations(instructorId: string): Promise<LibraryInstructorBookRecommendationRow[]> {
  const { data, error } = await supabase.from("library_instructor_book_recommendations").select("*").eq("instructor_id", instructorId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryInstructorBookRecommendationRow[];
}

export async function addInstructorRecommendation(instructorId: string, bookId: string, note: string | null): Promise<void> {
  const { error } = await supabase.from("library_instructor_book_recommendations").insert({ instructor_id: instructorId, book_id: bookId, note });
  if (error) throw new Error(error.message);
}

export async function removeInstructorRecommendation(id: string): Promise<void> {
  const { error } = await supabase.from("library_instructor_book_recommendations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Scopes a reading list to a course (Course Reading Lists). */
export async function setReadingListCourse(listId: string, academyCourseId: string | null): Promise<void> {
  const { error } = await supabase.from("library_reading_lists").update({ academy_course_id: academyCourseId }).eq("id", listId);
  if (error) throw new Error(error.message);
}
