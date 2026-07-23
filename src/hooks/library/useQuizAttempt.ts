import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchQuiz, fetchQuizForAttempt, startQuizAttempt, submitQuizAttempt } from "@/services/library/learningQuizzes";
import type { LibraryQuizSubmitResultRow } from "@/lib/types/library-learning";

/** Drives the take-a-quiz flow: fetch questions (no answers), start an
 *  attempt, track the in-progress answers + elapsed time, submit for
 *  server-side grading, and hold the per-question results afterward. */
export function useQuizAttempt(quizId: string | undefined) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [results, setResults] = useState<LibraryQuizSubmitResultRow[] | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: quiz } = useQuery({
    queryKey: queryKeys.library.learningQuiz(quizId ?? ""),
    queryFn: () => fetchQuiz(quizId!),
    enabled: !!quizId,
  });

  const { data: questions = [], isLoading } = useQuery({
    queryKey: queryKeys.library.quizForAttempt(quizId ?? ""),
    queryFn: () => fetchQuizForAttempt(quizId!),
    enabled: !!quizId,
  });

  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;
    (async () => {
      try {
        const attempt = await startQuizAttempt(quizId);
        if (!cancelled) {
          setAttemptId(attempt.id);
          setStartedAt(Date.now());
        }
      } catch (err) {
        toast({ title: "Couldn't start the exam", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    })();
    return () => { cancelled = true; };
  }, [quizId]);

  const setAnswer = (questionId: string, value: unknown) => setAnswers((prev) => ({ ...prev, [questionId]: value }));

  const submit = async () => {
    if (!attemptId) return;
    setIsSubmitting(true);
    try {
      const timeSpent = startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined;
      const rows = await submitQuizAttempt(attemptId, answers, timeSpent);
      setResults(rows);
    } catch (err) {
      toast({ title: "Couldn't submit the exam", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { quiz, questions, isLoading, attemptId, answers, setAnswer, results, submit, isSubmitting };
}
