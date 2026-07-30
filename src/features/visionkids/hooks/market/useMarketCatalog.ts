import { useQuery } from "@tanstack/react-query";
import * as catalog from "@/features/visionkids/services/market/catalog";
import type { ProductSearch } from "@/features/visionkids/types/market.types";

export function useMarketCategories() {
  return useQuery({ queryKey: ["kids-market", "categories"], queryFn: catalog.fetchCategories });
}

export function useProductSearch(search: ProductSearch) {
  return useQuery({
    queryKey: ["kids-market", "search", search],
    queryFn: () => catalog.searchProducts(search),
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-market", "product", slug],
    queryFn: () => catalog.fetchProductBySlug(slug!),
    enabled: !!slug,
  });
}

export function useCreator(userId: string | undefined) {
  return useQuery({
    queryKey: ["kids-market", "creator", userId],
    queryFn: () => catalog.fetchCreator(userId!),
    enabled: !!userId,
  });
}

export function useProductReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ["kids-market", "reviews", productId],
    queryFn: () => catalog.fetchProductReviews(productId!),
    enabled: !!productId,
  });
}
