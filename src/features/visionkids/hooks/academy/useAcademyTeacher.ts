import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as teacher from "@/features/visionkids/services/academy/teacher";

export function useMyTeacherProfile() {
  return useQuery({ queryKey: ["kids-academy", "teacher-profile"], queryFn: teacher.fetchMyTeacherProfile });
}

export function useBecomeTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ displayName, bio }: { displayName: string; bio?: string }) => teacher.becomeTeacher(displayName, bio),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-academy", "teacher-profile"] }),
  });
}

export function useMyCourses() {
  return useQuery({ queryKey: ["kids-academy", "my-taught-courses"], queryFn: teacher.fetchMyCourses });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teacher.createCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-academy", "my-taught-courses"] }),
  });
}

export function usePublishCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, publish }: { courseId: string; publish: boolean }) => teacher.publishCourse(courseId, publish),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-academy", "my-taught-courses"] }),
  });
}

export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, title, orderIndex }: { courseId: string; title: string; orderIndex: number }) => teacher.createUnit(courseId, title, orderIndex),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-academy", "units"] }),
  });
}

export function useCreateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teacher.createLesson,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-academy", "lessons"] }),
  });
}

export function useCourseRoster(courseId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "roster", courseId], queryFn: () => teacher.fetchCourseRoster(courseId!), enabled: !!courseId });
}
