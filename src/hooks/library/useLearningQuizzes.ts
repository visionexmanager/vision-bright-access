import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchQuizzesForBook, generateAiPracticeExam } from "@/services/library/learningQuizzes";

export function useLearningQuizzes(bookId: string | undefined) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: queryKeys.library.learningQuizzes(bookId ?? ""),
    queryFn: () => fetchQuizzesForBook(bookId!),
    enabled: !!bookId,
  });

  const generate = async (opts: { chapterId?: string | null; title?: string; questionCount?: number; isTimed?: boolean; timeLimitMinutes?: number } = {}) => {
    if (!bookId) return null;
    setIsGenerating(true);
    try {
      const result = await generateAiPracticeExam(bookId, opts);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.learningQuizzes(bookId) });
      toast({ title: "Practice exam ready!", description: `${result.questionCount} questions generated.` });
      return result.quizId;
    } catch (err) {
      toast({ title: "Couldn't generate a practice exam", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return { quizzes, isLoading, isGenerating, generate };
}
