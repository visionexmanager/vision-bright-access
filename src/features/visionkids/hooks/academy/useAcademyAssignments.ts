import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as assignments from "@/features/visionkids/services/academy/assignments";
import { useAwardXp, useAwardCoins, useAwardAchievement } from "@/features/visionkids/hooks/games/useGameEngagement";
import type { ProjectTemplate } from "@/features/visionkids/types/academy.types";

// ── Homework ─────────────────────────────────────────────────────────────
export function useCourseHomework(courseId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "homework", courseId], queryFn: () => assignments.fetchCourseHomework(courseId!), enabled: !!courseId });
}

export function useMyHomework() {
  return useQuery({ queryKey: ["kids-academy", "my-homework"], queryFn: assignments.fetchMyHomework });
}

export function useMyHomeworkSubmission(homeworkId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "homework-submission", homeworkId], queryFn: () => assignments.fetchMyHomeworkSubmission(homeworkId!), enabled: !!homeworkId });
}

export function useSubmitHomework() {
  const qc = useQueryClient();
  const awardXp = useAwardXp();
  const awardCoins = useAwardCoins();
  const awardAchievement = useAwardAchievement();
  return useMutation({
    mutationFn: async (input: assignments.SubmitHomeworkInput) => {
      await assignments.submitHomework(input);
      await awardXp.mutateAsync({ amount: 15, reason: `Homework submitted: ${input.homeworkId}` }).catch(() => {});
      await awardCoins.mutateAsync({ amount: 8, reason: `Homework submitted: ${input.homeworkId}` }).catch(() => {});
      awardAchievement.mutate("homework_hero");
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["kids-academy", "homework-submission", vars.homeworkId] }),
  });
}

export function useSubmissionsForHomework(homeworkId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "homework-submissions", homeworkId], queryFn: () => assignments.fetchSubmissionsForHomework(homeworkId!), enabled: !!homeworkId });
}

export function useGradeHomeworkSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, grade, feedback }: { submissionId: string; grade: number; feedback?: string }) => assignments.gradeHomeworkSubmission(submissionId, grade, feedback),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-academy", "homework-submissions"] }),
  });
}

// ── Projects ─────────────────────────────────────────────────────────────
export function useMyProjectSubmission(projectId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "project-submission", projectId], queryFn: () => assignments.fetchMyProjectSubmission(projectId!), enabled: !!projectId });
}

export function useMyProjectSubmissions() {
  return useQuery({ queryKey: ["kids-academy", "my-projects"], queryFn: assignments.fetchMyProjectSubmissions });
}

export function useSubmitProject() {
  const qc = useQueryClient();
  const awardXp = useAwardXp();
  const awardCoins = useAwardCoins();
  const awardAchievement = useAwardAchievement();
  return useMutation({
    mutationFn: async (input: assignments.SubmitProjectInput & { project: ProjectTemplate }) => {
      await assignments.submitProject(input);
      await awardXp.mutateAsync({ amount: input.project.xp_reward, reason: `Project submitted: ${input.projectId}` }).catch(() => {});
      await awardCoins.mutateAsync({ amount: input.project.coins_reward, reason: `Project submitted: ${input.projectId}` }).catch(() => {});
      awardAchievement.mutate("project_star");
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kids-academy", "project-submission", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["kids-academy", "my-projects"] });
    },
  });
}

export function useSubmissionsForProject(projectId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "project-submissions", projectId], queryFn: () => assignments.fetchSubmissionsForProject(projectId!), enabled: !!projectId });
}

export function useGradeProjectSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, grade, feedback }: { submissionId: string; grade: number; feedback?: string }) => assignments.gradeProjectSubmission(submissionId, grade, feedback),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-academy", "project-submissions"] }),
  });
}

export function useUploadSubmissionFile() {
  return useMutation({ mutationFn: ({ file, ownerFolder }: { file: File; ownerFolder: string }) => assignments.uploadSubmissionFile(file, ownerFolder) });
}
