/**
 * useEnrollment — a student's enrollment state for one course, and the
 * "enroll now" action (Phase 1 backend).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchEnrollment, fetchMyEnrollments, enrollInCourse } from "@/services/academy/lms";

export function useEnrollment(courseId: string | undefined) {
  const { user } = useAuth();
  const enabled = !!user && !!courseId;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.academy.lms.enrollment(user?.id ?? "", courseId ?? ""),
    queryFn: () => fetchEnrollment(user!.id, courseId!),
    enabled,
  });

  const { mutateAsync, isPending } = useMutation({
    mutationFn: () => enrollInCourse(user!.id, courseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.enrollment(user?.id ?? "", courseId ?? "") });
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.myEnrollments(user?.id ?? "") });
    },
  });

  return {
    enrollment: data ?? null,
    isEnrolled: !!data,
    isLoading,
    enroll: mutateAsync,
    isEnrolling: isPending,
  };
}

export function useMyEnrollments() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.academy.lms.myEnrollments(user?.id ?? ""),
    queryFn: () => fetchMyEnrollments(user!.id),
    enabled: !!user,
  });
  return { enrollments: data ?? [], isLoading };
}
