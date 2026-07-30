import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as commerce from "@/features/visionkids/services/market/commerce";

export function useOrders() {
  return useQuery({ queryKey: ["kids-market", "orders"], queryFn: commerce.fetchOrdersWithProducts });
}

export function useLicensedProductIds() {
  return useQuery({ queryKey: ["kids-market", "licenses"], queryFn: commerce.fetchLicensedProductIds });
}

export function usePurchaseProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => commerce.purchaseProduct(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-market", "orders"] });
      qc.invalidateQueries({ queryKey: ["kids-market", "licenses"] });
      qc.invalidateQueries({ queryKey: ["points-total"] });
    },
  });
}

export function useWishlistProducts() {
  return useQuery({ queryKey: ["kids-market", "wishlist-products"], queryFn: commerce.fetchWishlistProducts });
}

export function useWishlistIds() {
  return useQuery({ queryKey: ["kids-market", "wishlist-ids"], queryFn: commerce.fetchWishlistIds });
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => commerce.toggleWishlist(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-market", "wishlist-products"] });
      qc.invalidateQueries({ queryKey: ["kids-market", "wishlist-ids"] });
    },
  });
}

export function useAddReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, rating, comment }: { productId: string; rating: number; comment?: string }) =>
      commerce.addReview(productId, rating, comment),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["kids-market", "reviews", vars.productId] });
      qc.invalidateQueries({ queryKey: ["kids-market", "product"] });
    },
  });
}

export function useLikeReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => commerce.likeReview(reviewId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-market", "reviews"] }),
  });
}

export function useReportReview() {
  return useMutation({
    mutationFn: ({ reviewId, reason }: { reviewId: string; reason: string }) => commerce.reportReview(reviewId, reason),
  });
}
