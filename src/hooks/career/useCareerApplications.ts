// ─── useCareerApplications — the signed-in user's job applications (Phase 1) ──

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyApplications, applyToJob, withdrawApplication } from "@/services/career/applications";

export function useCareerApplications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.career.applications(user?.id ?? ""),
    queryFn: () => fetchMyApplications(user!.id),
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.career.applications(user?.id ?? "") });

  const { mutateAsync: apply, isPending: isApplying } = useMutation({
    mutationFn: (args: { jobId: string; coverLetter?: string }) => applyToJob(user!.id, args.jobId, args.coverLetter),
    onSuccess: invalidate,
  });

  const { mutateAsync: withdraw, isPending: isWithdrawing } = useMutation({
    mutationFn: (applicationId: string) => withdrawApplication(applicationId),
    onSuccess: invalidate,
  });

  return {
    applications: data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
    apply,
    isApplying,
    withdraw,
    isWithdrawing,
  };
}
