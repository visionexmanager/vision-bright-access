// ─── Library — AI Quiz Attempts Service (Phase 6.5) ───────────────────────
// CRUD + auto-grading against library_ai_quiz_attempts. Grading is a simple
// index-match (multiple-choice/true-false) or normalized-string-match
// (fill-blank/short-answer) comparison — not semantic — per the Phase 6.5
// plan's documented scope boundary; the model provides the expected-answer
// key at generation time, this just compares against it.

import { supabase } from "@/integrations/supabase/client";
import type { GeneratedQuiz, LibraryQuizAttemptRow, QuizQuestion } from "@/lib/types/library-ai";

const SELECT = "id, user_id, book_id, chapter_id, quiz, answers, score, total, created_at";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function isCorrect(question: QuizQuestion, answer: string | undefined): boolean {
  if (answer == null || answer === "") return false;
  if (question.type === "multiple-choice" || question.type === "true-false") {
    return Number(answer) === question.correct_index;
  }
  return normalize(answer) === normalize(question.expected_answer);
}

export function gradeQuiz(quiz: GeneratedQuiz, answers: Record<number, string>): { score: number; total: number } {
  let score = 0;
  quiz.questions.forEach((q, i) => {
    if (isCorrect(q, answers[i])) score++;
  });
  return { score, total: quiz.questions.length };
}

export async function submitQuizAttempt(
  userId: string,
  bookId: string,
  chapterId: string | null,
  quiz: GeneratedQuiz,
  answers: Record<number, string>
): Promise<LibraryQuizAttemptRow> {
  const { score, total } = gradeQuiz(quiz, answers);
  const { data, error } = await supabase
    .from("library_ai_quiz_attempts")
    .insert({ user_id: userId, book_id: bookId, chapter_id: chapterId, quiz: quiz as unknown as Record<string, unknown>, answers: answers as unknown as Record<string, unknown>, score, total })
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as LibraryQuizAttemptRow;
}

export async function fetchQuizAttempts(userId: string, bookId: string): Promise<LibraryQuizAttemptRow[]> {
  const { data, error } = await supabase
    .from("library_ai_quiz_attempts")
    .select(SELECT)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LibraryQuizAttemptRow[];
}
