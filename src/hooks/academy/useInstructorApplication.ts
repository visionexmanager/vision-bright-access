/**
 * useInstructorApplication — the "become an instructor" application flow
 * (Phase 1 backend, replaces the application parts of instructorLocalStore.ts).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchMyApplication,
  saveApplication,
  submitInstructorApplication,
  resetApplicationToDraft,
} from "@/services/academy/instructor";
import type { AcademyInstructorApplicationRow } from "@/lib/types/academy-lms";

export function useInstructorApplication() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.academy.instructor.myApplication(user?.id ?? ""),
    queryFn: () => fetchMyApplication(user!.id),
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.academy.instructor.myApplication(user?.id ?? "") });

  const saveDraft = useMutation({
    mutationFn: (updates: Partial<Omit<AcademyInstructorApplicationRow, "id" | "user_id" | "status">>) =>
      saveApplication({ ...updates, user_id: user!.id }),
    onSuccess: invalidate,
  });

  const submit = useMutation({
    mutationFn: () => submitInstructorApplication(user!.id),
    onSuccess: invalidate,
  });

  const resetToDraft = useMutation({
    mutationFn: () => resetApplicationToDraft(user!.id),
    onSuccess: invalidate,
  });

  return {
    application: data ?? null,
    isLoading,
    saveDraft: saveDraft.mutateAsync,
    isSavingDraft: saveDraft.isPending,
    submit: submit.mutateAsync,
    isSubmitting: submit.isPending,
    resetToDraft: resetToDraft.mutateAsync,
  };
}
