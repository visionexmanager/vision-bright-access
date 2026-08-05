import { kidsDb, rpcResult } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  Creator, CreatorKind, Product, ProductInput, CreatorStats, ModerationRecord,
} from "@/features/visionkids/types/market.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchMyCreatorProfile(): Promise<Creator | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await kidsDb
    .from("kids_market_creators").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as Creator | null) ?? null;
}

export async function upsertCreatorProfile(input: {
  display_name: string; kind: CreatorKind; bio?: string; avatar?: string;
}): Promise<Creator> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Must be signed in");
  const { data, error } = await kidsDb
    .from("kids_market_creators")
    .upsert({ user_id: userId, display_name: input.display_name, kind: input.kind, bio: input.bio ?? null, avatar: input.avatar ?? "🧑‍🏫" }, { onConflict: "user_id" })
    .select("*").single();
  if (error) throw error;
  return data as Creator;
}

export async function requestVerification(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Must be signed in");
  const { error } = await kidsDb
    .from("kids_market_creators").update({ verification_status: "pending" }).eq("user_id", userId);
  if (error) throw error;
}

export async function fetchMyProducts(): Promise<Product[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_market_products").select("*").eq("creator_id", userId).order("created_at", { ascending: false })
    .returns<Product[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Must be signed in");
  const { data, error } = await kidsDb
    .from("kids_market_products")
    .insert({
      creator_id: userId,
      type: input.type,
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      emoji: input.emoji ?? "📦",
      category: input.category ?? "literacy",
      age_min: input.age_min ?? 3,
      age_max: input.age_max ?? 12,
      language: input.language ?? "en",
      level: input.level ?? "all",
      price_coins: input.price_coins ?? 0,
      license: input.license ?? "standard",
      file_url: input.file_url ?? null,
      preview_url: input.preview_url ?? null,
    })
    .select("*").single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<void> {
  const { error } = await kidsDb.from("kids_market_products").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await kidsDb.from("kids_market_products").delete().eq("id", id);
  if (error) throw error;
}

export async function submitProduct(id: string): Promise<{ auto_status: string; flags: string[] }> {
  const { data, error } = await kidsDb.rpc("submit_kids_product", { _product_id: id });
  if (error) throw error;
  return data as { auto_status: string; flags: string[] };
}

export async function fetchCreatorStats(): Promise<CreatorStats> {
  const { data, error } = await kidsDb.rpc("get_kids_creator_stats");
  if (error) throw error;
  return rpcResult<CreatorStats>(data);
}

export async function fetchProductModeration(productId: string): Promise<ModerationRecord | null> {
  const { data, error } = await kidsDb
    .from("kids_market_moderation").select("*").eq("product_id", productId).maybeSingle();
  if (error) throw error;
  return (data as ModerationRecord | null) ?? null;
}
