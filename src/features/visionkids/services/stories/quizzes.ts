import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { Quiz, QuizQuestion, QuizAttempt } from "@/features/visionkids/types/stories.types";

export async function fetchQuizByStoryId(storyId: string): Promise<Quiz | null> {
  const { data: quiz, error } = await kidsDb
    .from("kids_quizzes").select("*").eq("story_id", storyId).maybeSingle();
  if (error) throw error;
  if (!quiz) return null;

  const { data: questions, error: qError } = await kidsDb
    .from("kids_quiz_questions").select("*").eq("quiz_id", (quiz as { id: string }).id).order("order_index")
    .returns<QuizQuestion[]>();
  if (qError) throw qError;

  return { ...(quiz as Omit<Quiz, "questions">), questions: questions ?? [] };
}

/** Academy course final exams/lesson quizzes, Explorer location quizzes,
 *  and Social club (esp. Reading Club weekly) quizzes reuse this same
 *  table — see the kids_quizzes ALTER statements in
 *  20260810003000_kids_academy_catalog.sql, 20260812010000_kids_explorer_
 *  gamification.sql, and 20260813010000_kids_social_friends_chat_groups.sql. */
async function fetchQuizByOwner(column: "course_id" | "lesson_id" | "location_id" | "group_id", ownerId: string): Promise<Quiz | null> {
  const { data: quiz, error } = await kidsDb.from("kids_quizzes").select("*").eq(column, ownerId).maybeSingle();
  if (error) throw error;
  if (!quiz) return null;

  const { data: questions, error: qError } = await kidsDb
    .from("kids_quiz_questions").select("*").eq("quiz_id", (quiz as { id: string }).id).order("order_index")
    .returns<QuizQuestion[]>();
  if (qError) throw qError;

  return { ...(quiz as Omit<Quiz, "questions">), questions: questions ?? [] };
}

export function fetchQuizByCourseId(courseId: string): Promise<Quiz | null> {
  return fetchQuizByOwner("course_id", courseId);
}

export function fetchQuizByLessonId(lessonId: string): Promise<Quiz | null> {
  return fetchQuizByOwner("lesson_id", lessonId);
}

export function fetchQuizByLocationId(locationId: string): Promise<Quiz | null> {
  return fetchQuizByOwner("location_id", locationId);
}

export function fetchQuizByGroupId(groupId: string): Promise<Quiz | null> {
  return fetchQuizByOwner("group_id", groupId);
}

export interface QuizAnswer {
  question_id: string;
  answer: string;
  correct: boolean;
}

export async function submitQuizAttempt(quizId: string, answers: QuizAnswer[], score: number, total: number): Promise<QuizAttempt> {
  const { data: authData } = await kidsDb.auth.getUser();
  const user_id = authData.user?.id;
  if (!user_id) throw new Error("Must be signed in");

  const { data, error } = await kidsDb
    .from("kids_quiz_attempts")
    .insert({ user_id, quiz_id: quizId, score, total, answers })
    .select("*").single().returns<QuizAttempt>();
  if (error) throw error;
  return data;
}

export async function fetchMyQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
  const { data, error } = await kidsDb
    .from("kids_quiz_attempts").select("*").eq("quiz_id", quizId).order("completed_at", { ascending: false })
    .returns<QuizAttempt[]>();
  if (error) throw error;
  return data ?? [];
}
