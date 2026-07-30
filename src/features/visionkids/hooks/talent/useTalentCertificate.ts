import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as certificate from "@/features/visionkids/services/talent/certificate";

export function useMyTalentCertificate() {
  return useQuery({ queryKey: ["kids-talent", "certificate"], queryFn: certificate.fetchMyTalentCertificate });
}

export function useClaimTalentCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => certificate.claimTalentCertificate(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-talent", "certificate"] }),
  });
}
