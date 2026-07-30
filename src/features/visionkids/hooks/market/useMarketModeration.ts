import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as moderation from "@/features/visionkids/services/market/moderation";

export function useModerationQueue() {
  return useQuery({ queryKey: ["kids-market", "mod-queue"], queryFn: moderation.fetchModerationQueue });
}

export function usePendingVerifications() {
  return useQuery({ queryKey: ["kids-market", "mod-verifications"], queryFn: moderation.fetchPendingVerifications });
}

export function useModerateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, approve, notes }: { productId: string; approve: boolean; notes?: string }) =>
      moderation.moderateProduct(productId, approve, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-market", "mod-queue"] });
      qc.invalidateQueries({ queryKey: ["kids-market", "search"] });
    },
  });
}

export function useVerifyCreator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, approve, note }: { userId: string; approve: boolean; note?: string }) =>
      moderation.verifyCreator(userId, approve, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-market", "mod-verifications"] }),
  });
}
