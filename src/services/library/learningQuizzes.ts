// ─── Library — Learning Hub: Quizzes (structured, multi-question-type) ─────
// Distinct from library_ai_quiz_attempts (the ephemeral reader-sidebar
// jsonb-blob quiz) — these are persisted quizzes with server-side grading
// that never leaks correct_answer to the client before submission.

import { supabase } from "@/integrations/supabase/client";
import type {
  LibraryQuizRow, LibraryQuizAttemptQuestion, LibraryQuizAttemptRow, LibraryQuizSubmitResultRow, LibraryWeakTopic,
} from "@/lib/types/library-learning";

export async function fetchQuizzesForBook(bookId: string): Promise<LibraryQuizRow[]> {
  const { data, error } = await supabase.from("library_quizzes").select("*").eq("book_id", bookId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryQuizRow[];
}

export async function fetchQuiz(quizId: string): Promise<LibraryQuizRow | null> {
  const { data, error } = await supabase.from("library_quizzes").select("*").eq("id", quizId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryQuizRow | null;
}

export async function fetchQuizForAttempt(quizId: string): Promise<LibraryQuizAttemptQuestion[]> {
  const { data, error } = await supabase.rpc("get_library_quiz_for_attempt", { _quiz_id: quizId });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryQuizAttemptQuestion[];
}

export async function startQuizAttempt(quizId: string): Promise<LibraryQuizAttemptRow> {
  const { data, error } = await supabase.rpc("start_library_quiz_attempt", { _quiz_id: quizId });
  if (error) throw new Error(error.message);
  return data as LibraryQuizAttemptRow;
}

export async function submitQuizAttempt(attemptId: string, answers: Record<string, unknown>, timeSpentSeconds?: number): Promise<LibraryQuizSubmitResultRow[]> {
  const { data, error } = await supabase.rpc("submit_library_quiz_attempt", {
    _attempt_id: attemptId, _answers: answers, _time_spent_seconds: timeSpentSeconds ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryQuizSubmitResultRow[];
}

export async function fetchMyQuizAttempts(userId: string, quizId: string): Promise<LibraryQuizAttemptRow[]> {
  const { data, error } = await supabase
    .from("library_quiz_attempts").select("*")
    .eq("user_id", userId).eq("quiz_id", quizId).order("started_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryQuizAttemptRow[];
}

export async function fetchMyWeakTopics(): Promise<LibraryWeakTopic[]> {
  const { data, error } = await supabase.rpc("get_library_weak_topics", {});
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryWeakTopic[];
}

export async function generateAiPracticeExam(
  bookId: string, opts: { chapterId?: string | null; title?: string; questionCount?: number; isTimed?: boolean; timeLimitMinutes?: number } = {},
): Promise<{ quizId: string; questionCount: number }> {
  const { data, error } = await supabase.functions.invoke("library-generate-practice-exam", {
    body: {
      book_id: bookId, chapter_id: opts.chapterId ?? undefined, title: opts.title,
      question_count: opts.questionCount, is_timed: opts.isTimed, time_limit_minutes: opts.timeLimitMinutes,
    },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return { quizId: data.quiz_id as string, questionCount: data.question_count as number };
}
