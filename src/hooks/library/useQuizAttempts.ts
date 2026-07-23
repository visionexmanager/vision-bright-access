/**
 * useQuizAttempts — generate a quiz (AI), take it, auto-grade + persist the
 * attempt, and list past attempts. VX reward on completing a quiz.
 */

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchQuizAttempts, submitQuizAttempt } from "@/services/library/quizzes";
import { runLibraryAiAssistant } from "@/services/library/aiAssistant";
import type { GeneratedQuiz, LibraryQuizAttemptRow } from "@/lib/types/library-ai";

const QUIZ_VX_REWARD_PER_QUESTION = 6;
const QUIZ_VX_REWARD_MAX = 50;

export function useQuizAttempts(bookId: string | undefined, chapterId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";
  const [quiz, setQuiz] = useState<GeneratedQuiz | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<LibraryQuizAttemptRow | null>(null);

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: queryKeys.library.aiQuizAttempts(bookId ?? "", uid),
    queryFn: () => fetchQuizAttempts(uid, bookId!),
    enabled: !!bookId && !!user,
  });

  const generate = useCallback(async () => {
    if (!bookId) return;
    setIsGenerating(true);
    setLastAttempt(null);
    try {
      const res = await runLibraryAiAssistant({ mode: "quiz", book_id: bookId, chapter_id: chapterId });
      if (res.mode === "quiz") setQuiz({ questions: res.result.questions });
    } catch (err) {
      toast({ title: "Couldn't generate quiz", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [bookId, chapterId]);

  const submit = useCallback(
    async (answers: Record<number, string>) => {
      if (!bookId || !user || !quiz) return;
      try {
        const attempt = await submitQuizAttempt(uid, bookId, chapterId ?? null, quiz, answers);
        setLastAttempt(attempt);
        queryClient.invalidateQueries({ queryKey: queryKeys.library.aiQuizAttempts(bookId, uid) });

        const reward = Math.min(QUIZ_VX_REWARD_MAX, attempt.score * QUIZ_VX_REWARD_PER_QUESTION);
        if (reward > 0) {
          try {
            await supabase.rpc("award_library_xp", { _amount: reward, _reason: `Quiz completed:${bookId}` });
          } catch {
            // Best-effort reward — grading result already shown regardless.
          }
        }
        return attempt;
      } catch (err) {
        toast({ title: "Couldn't submit quiz", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        return null;
      }
    },
    [bookId, user, uid, quiz, chapterId, queryClient]
  );

  return { quiz, isGenerating, generate, submit, lastAttempt, attempts, isLoading };
}
