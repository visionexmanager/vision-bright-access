import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as progress from "@/features/visionkids/services/academy/progress";
import { useAwardXp, useAwardCoins, useAwardAchievement } from "@/features/visionkids/hooks/games/useGameEngagement";
import type { Course, Lesson } from "@/features/visionkids/types/academy.types";

export function useCompletedLessonsCount() {
  return useQuery({ queryKey: ["kids-academy", "completed-lessons-count"], queryFn: progress.fetchCompletedLessonsCount });
}

export function useEnrollInCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => progress.enrollInCourse(courseId),
    onSuccess: (_d, courseId) => {
      qc.invalidateQueries({ queryKey: ["kids-academy", "enrollment", courseId] });
      qc.invalidateQueries({ queryKey: ["kids-academy", "my-courses"] });
    },
  });
}

export function useMyEnrollment(courseId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "enrollment", courseId], queryFn: () => progress.fetchMyEnrollment(courseId!), enabled: !!courseId });
}

export function useMyEnrolledCourses() {
  return useQuery({ queryKey: ["kids-academy", "my-courses"], queryFn: progress.fetchMyEnrolledCourses });
}

export function useLessonProgress(lessonId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "lesson-progress", lessonId], queryFn: () => progress.fetchLessonProgress(lessonId!), enabled: !!lessonId });
}

export function useCourseProgress(courseId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "course-progress", courseId], queryFn: () => progress.fetchCourseProgress(courseId!), enabled: !!courseId });
}

export function useRecentLessonProgress(limit = 10) {
  return useQuery({ queryKey: ["kids-academy", "recent-progress", limit], queryFn: () => progress.fetchRecentLessonProgress(limit) });
}

/** Saves lesson progress and — on first completion — awards XP/coins and
 *  checks the shared first_lesson/five_lessons achievements. Mirrors
 *  useGameSession's finish() reward wiring, kept inline here since a lesson
 *  "session" is much simpler than a game session (no timer/lives/hints). */
export function useCompleteLessonAndAward() {
  const qc = useQueryClient();
  const awardXp = useAwardXp();
  const awardCoins = useAwardCoins();
  const awardAchievement = useAwardAchievement();

  return useMutation({
    mutationFn: async ({ lesson, score, timeSpentDeltaSeconds, wasAlreadyCompleted }: { lesson: Lesson; score?: number; timeSpentDeltaSeconds: number; wasAlreadyCompleted: boolean }) => {
      await progress.saveLessonProgress({ lessonId: lesson.id, status: "completed", score, timeSpentDeltaSeconds });
      if (!wasAlreadyCompleted) {
        await awardXp.mutateAsync({ amount: lesson.xp_reward, reason: `Lesson completed: ${lesson.slug}` }).catch(() => {});
        await awardCoins.mutateAsync({ amount: lesson.coins_reward, reason: `Lesson completed: ${lesson.slug}` }).catch(() => {});
        // Fetched fresh here (not from a cached hook) since this just
        // wrote the completion that determines the count.
        const lessonsSoFar = await progress.fetchCompletedLessonsCount().catch(() => 0);
        if (lessonsSoFar === 1) awardAchievement.mutate("first_lesson");
        if (lessonsSoFar === 5) awardAchievement.mutate("five_lessons");
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kids-academy", "lesson-progress", vars.lesson.id] });
      qc.invalidateQueries({ queryKey: ["kids-academy", "course-progress"] });
      qc.invalidateQueries({ queryKey: ["kids-academy", "recent-progress"] });
      qc.invalidateQueries({ queryKey: ["kids-academy", "recommendations"] });
      qc.invalidateQueries({ queryKey: ["kids-academy", "completed-lessons-count"] });
    },
  });
}

export function useSaveLessonProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: progress.saveLessonProgress,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kids-academy", "lesson-progress", vars.lessonId] });
      qc.invalidateQueries({ queryKey: ["kids-academy", "course-progress"] });
    },
  });
}

export function useSubmitActivityAttempt() {
  return useMutation({
    mutationFn: ({ activityId, answer, correct }: { activityId: string; answer: Record<string, unknown>; correct: boolean }) =>
      progress.submitActivityAttempt(activityId, answer, correct),
  });
}

export type { Course };
