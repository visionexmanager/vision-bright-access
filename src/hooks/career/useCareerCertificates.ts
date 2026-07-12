// ─── useCareerCertificates — the signed-in user's certificates (Phase 1) ──────

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyCertificates, addCertificate, deleteCertificate, type NewCertificate } from "@/services/career/certificates";

export function useCareerCertificates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.career.certificates(user?.id ?? ""),
    queryFn: () => fetchMyCertificates(user!.id),
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.career.certificates(user?.id ?? "") });

  const { mutateAsync: add, isPending: isAdding } = useMutation({
    mutationFn: (cert: NewCertificate) => addCertificate(user!.id, cert),
    onSuccess: invalidate,
  });

  const { mutateAsync: remove, isPending: isRemoving } = useMutation({
    mutationFn: (certificateId: string) => deleteCertificate(certificateId),
    onSuccess: invalidate,
  });

  return {
    certificates: data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
    add,
    isAdding,
    remove,
    isRemoving,
  };
}
