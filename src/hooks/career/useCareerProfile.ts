// ─── useCareerProfile — the signed-in user's career profile (Phase 1 backend) ─

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyCareerProfile, upsertCareerProfile, uploadResume, type CareerProfilePatch } from "@/services/career/profile";

export function useCareerProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.career.profile(user?.id ?? ""),
    queryFn: () => fetchMyCareerProfile(user!.id),
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.career.profile(user?.id ?? "") });

  const { mutateAsync: saveProfile, isPending: isSaving } = useMutation({
    mutationFn: (patch: CareerProfilePatch) => upsertCareerProfile(user!.id, patch),
    onSuccess: invalidate,
  });

  const { mutateAsync: uploadMyResume, isPending: isUploadingResume } = useMutation({
    mutationFn: (file: File) => uploadResume(user!.id, file),
    onSuccess: invalidate,
  });

  return {
    profile: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    saveProfile,
    isSaving,
    uploadResume: uploadMyResume,
    isUploadingResume,
  };
}
