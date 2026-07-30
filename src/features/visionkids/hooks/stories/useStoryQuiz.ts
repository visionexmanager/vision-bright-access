import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as quizzes from "@/features/visionkids/services/stories/quizzes";
import type { QuizAnswer } from "@/features/visionkids/services/stories/quizzes";

export function useQuizByStory(storyId: string | undefined) {
  return useQuery({
    queryKey: ["kids", "quiz", storyId],
    queryFn: () => quizzes.fetchQuizByStoryId(storyId!),
    enabled: !!storyId,
  });
}

/** Academy final exams (kids_quizzes.course_id) — same table/hook family as
 *  story quizzes, see quizzes.ts's own comment on the ALTER that added it. */
export function useQuizByCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: ["kids", "quiz", "course", courseId],
    queryFn: () => quizzes.fetchQuizByCourseId(courseId!),
    enabled: !!courseId,
  });
}

export function useQuizByLesson(lessonId: string | undefined) {
  return useQuery({
    queryKey: ["kids", "quiz", "lesson", lessonId],
    queryFn: () => quizzes.fetchQuizByLessonId(lessonId!),
    enabled: !!lessonId,
  });
}

/** Explorer location quizzes (kids_quizzes.location_id) — same table/hook
 *  family, see quizzes.ts's own comment on the ALTER that added it. */
export function useQuizByLocation(locationId: string | undefined) {
  return useQuery({
    queryKey: ["kids", "quiz", "location", locationId],
    queryFn: () => quizzes.fetchQuizByLocationId(locationId!),
    enabled: !!locationId,
  });
}

/** Social club quizzes (kids_quizzes.group_id) — same table/hook family,
 *  see quizzes.ts's own comment on the ALTER that added it. */
export function useQuizByGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: ["kids", "quiz", "group", groupId],
    queryFn: () => quizzes.fetchQuizByGroupId(groupId!),
    enabled: !!groupId,
  });
}

export function useSubmitQuizAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, answers, score, total }: { quizId: string; answers: QuizAnswer[]; score: number; total: number }) =>
      quizzes.submitQuizAttempt(quizId, answers, score, total),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["kids", "quiz-attempts", vars.quizId] }),
  });
}

export function useMyQuizAttempts(quizId: string | undefined) {
  return useQuery({
    queryKey: ["kids", "quiz-attempts", quizId],
    queryFn: () => quizzes.fetchMyQuizAttempts(quizId!),
    enabled: !!quizId,
  });
}
