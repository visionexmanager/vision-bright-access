import { kidsDb, rpcResult } from "@/features/visionkids/services/stories/kidsSupabase";
import type { MarketOrder, Product } from "@/features/visionkids/types/market.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

export interface PurchaseResult { ok: boolean; already_owned: boolean; }

export async function purchaseProduct(productId: string): Promise<PurchaseResult> {
  const { data, error } = await kidsDb.rpc("purchase_kids_product", { _product_id: productId });
  if (error) throw error;
  return rpcResult<PurchaseResult>(data);
}

export async function fetchOrders(): Promise<MarketOrder[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_market_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false })
    .returns<MarketOrder[]>();
  if (error) throw error;
  return data ?? [];
}

export interface OrderWithProduct extends MarketOrder {
  product: { slug: string; title: string; emoji: string } | null;
}

export async function fetchOrdersWithProducts(): Promise<OrderWithProduct[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_market_orders")
    .select("*, kids_market_products(slug, title, emoji)")
    .eq("user_id", userId).order("created_at", { ascending: false })
    .returns<(MarketOrder & { kids_market_products: { slug: string; title: string; emoji: string } | { slug: string; title: string; emoji: string }[] | null })[]>();
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { kids_market_products, ...order } = row;
    const product = Array.isArray(kids_market_products) ? kids_market_products[0] ?? null : kids_market_products;
    return { ...(order as MarketOrder), product };
  });
}

/** Product ids the caller owns a license to. */
export async function fetchLicensedProductIds(): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_market_licenses").select("product_id").eq("user_id", userId)
    .returns<{ product_id: string }[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.product_id);
}

// ── Wishlist ─────────────────────────────────────────────────────────────────
export async function fetchWishlistProducts(): Promise<Product[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_market_wishlist").select("product_id, kids_market_products(*)").eq("user_id", userId)
    .returns<{ product_id: string; kids_market_products: Product | null }[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.kids_market_products).filter((p): p is Product => !!p);
}

export async function fetchWishlistIds(): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_market_wishlist").select("product_id").eq("user_id", userId)
    .returns<{ product_id: string }[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.product_id);
}

export async function toggleWishlist(productId: string): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("toggle_kids_wishlist", { _product_id: productId });
  if (error) throw error;
  return !!data;
}

// ── Reviews ──────────────────────────────────────────────────────────────────
export async function addReview(productId: string, rating: number, comment?: string): Promise<void> {
  const { error } = await kidsDb.rpc("add_kids_review", { _product_id: productId, _rating: rating, _comment: comment ?? null });
  if (error) throw error;
}

export async function likeReview(reviewId: string): Promise<{ liked: boolean; likes: number }> {
  const { data, error } = await kidsDb.rpc("like_kids_review", { _review_id: reviewId });
  if (error) throw error;
  return data as { liked: boolean; likes: number };
}

export async function reportReview(reviewId: string, reason: string): Promise<void> {
  const { error } = await kidsDb.rpc("report_kids_review", { _review_id: reviewId, _reason: reason });
  if (error) throw error;
}

export async function recordView(productId: string): Promise<void> {
  const { error } = await kidsDb.rpc("record_kids_product_view", { _product_id: productId });
  if (error) throw error;
}
