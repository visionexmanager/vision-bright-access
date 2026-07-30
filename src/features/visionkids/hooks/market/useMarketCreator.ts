import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as creator from "@/features/visionkids/services/market/creator";
import type { ProductInput } from "@/features/visionkids/types/market.types";

export function useMyCreatorProfile() {
  return useQuery({ queryKey: ["kids-market", "my-creator"], queryFn: creator.fetchMyCreatorProfile });
}

export function useUpsertCreatorProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creator.upsertCreatorProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-market", "my-creator"] }),
  });
}

export function useRequestVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: creator.requestVerification,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-market", "my-creator"] }),
  });
}

export function useMyProducts() {
  return useQuery({ queryKey: ["kids-market", "my-products"], queryFn: creator.fetchMyProducts });
}

export function useCreatorStats() {
  return useQuery({ queryKey: ["kids-market", "creator-stats"], queryFn: creator.fetchCreatorStats });
}

function invalidateMine(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["kids-market", "my-products"] });
  qc.invalidateQueries({ queryKey: ["kids-market", "creator-stats"] });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) => creator.createProduct(input),
    onSuccess: () => invalidateMine(qc),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ProductInput> }) => creator.updateProduct(id, patch),
    onSuccess: () => invalidateMine(qc),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => creator.deleteProduct(id),
    onSuccess: () => invalidateMine(qc),
  });
}

export function useSubmitProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => creator.submitProduct(id),
    onSuccess: () => invalidateMine(qc),
  });
}
