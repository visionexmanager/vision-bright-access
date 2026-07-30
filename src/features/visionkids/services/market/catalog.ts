import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  Product, MarketCategory, Creator, MarketReview, ProductSearch,
} from "@/features/visionkids/types/market.types";

export async function fetchCategories(): Promise<MarketCategory[]> {
  const { data, error } = await kidsDb
    .from("kids_market_categories").select("*").eq("status", "published").order("order_index")
    .returns<MarketCategory[]>();
  if (error) throw error;
  return data ?? [];
}

/** Browse/search published products with optional facets + sort. */
export async function searchProducts(search: ProductSearch = {}): Promise<Product[]> {
  let query = kidsDb.from("kids_market_products").select("*").eq("status", "published");

  if (search.type) query = query.eq("type", search.type);
  if (search.category) query = query.eq("category", search.category);
  if (search.language) query = query.eq("language", search.language);
  if (search.level && search.level !== "all") query = query.eq("level", search.level);
  if (search.freeOnly) query = query.eq("is_free", true);
  if (typeof search.maxPrice === "number") query = query.lte("price_coins", search.maxPrice);
  if (typeof search.ageMin === "number") query = query.lte("age_min", search.ageMin);
  if (typeof search.ageMax === "number") query = query.gte("age_max", search.ageMax);
  if (typeof search.minRating === "number") query = query.gte("rating_avg", search.minRating);
  if (search.q && search.q.trim()) query = query.ilike("title", `%${search.q.trim()}%`);

  switch (search.sort) {
    case "popular": query = query.order("downloads", { ascending: false }); break;
    case "rating": query = query.order("rating_avg", { ascending: false }); break;
    case "price_low": query = query.order("price_coins", { ascending: true }); break;
    case "price_high": query = query.order("price_coins", { ascending: false }); break;
    default: query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query.limit(60).returns<Product[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await kidsDb
    .from("kids_market_products").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as Product | null) ?? null;
}

export async function fetchCreator(userId: string): Promise<Creator | null> {
  const { data, error } = await kidsDb
    .from("kids_market_creators").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as Creator | null) ?? null;
}

export async function fetchProductReviews(productId: string): Promise<MarketReview[]> {
  const { data, error } = await kidsDb
    .from("kids_market_reviews").select("*").eq("product_id", productId).eq("status", "visible")
    .order("likes", { ascending: false }).limit(50)
    .returns<MarketReview[]>();
  if (error) throw error;
  return data ?? [];
}
