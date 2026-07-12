// ─── useVxCoinOrders — buyer + admin hooks for VX coin purchase orders ────────

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchMyVxCoinOrders,
  fetchVxCoinOrders,
  createVxCoinOrder,
  reviewVxCoinOrder,
  uploadPaymentProof,
  type VxCoinOrderStatus,
} from "@/services/vxCoins";

export function useMyVxCoinOrders() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.vxCoins.myOrders(user?.id ?? ""),
    queryFn: () => fetchMyVxCoinOrders(user!.id),
    enabled: !!user,
  });
  return { orders: data ?? [], isLoading, error: error ? (error as Error).message : null };
}

export function useCreateVxCoinOrder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { mutateAsync: submitProof, isPending: isUploading } = useMutation({
    mutationFn: (file: File) => uploadPaymentProof(user!.id, file),
  });

  const { mutateAsync: submitOrder, isPending: isSubmitting } = useMutation({
    mutationFn: createVxCoinOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vxCoins.myOrders(user?.id ?? "") }),
  });

  return { submitProof, isUploading, submitOrder, isSubmitting };
}

export function useVxCoinOrdersAdmin(status: VxCoinOrderStatus | "all" = "pending") {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.vxCoins.adminList(status),
    queryFn: () => fetchVxCoinOrders(status === "all" ? undefined : status),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["vxCoins", "admin-list"] });
  };

  const { mutateAsync: review, isPending: isReviewing } = useMutation({
    mutationFn: reviewVxCoinOrder,
    onSuccess: invalidate,
  });

  return { orders: data ?? [], isLoading, error: error ? (error as Error).message : null, refetch, review, isReviewing };
}
