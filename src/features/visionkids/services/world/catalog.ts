import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  WorldRegion, WorldActivity, Npc, MarketItem, Transport,
} from "@/features/visionkids/types/world.types";

export async function fetchRegions(): Promise<WorldRegion[]> {
  const { data, error } = await kidsDb
    .from("kids_world_regions").select("*").eq("status", "published").order("order_index")
    .returns<WorldRegion[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchRegion(slug: string): Promise<WorldRegion | null> {
  const { data, error } = await kidsDb
    .from("kids_world_regions").select("*").eq("slug", slug).maybeSingle().returns<WorldRegion>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchActivities(region: string): Promise<WorldActivity[]> {
  const { data, error } = await kidsDb
    .from("kids_world_activities").select("*").eq("region", region).eq("status", "published").order("order_index")
    .returns<WorldActivity[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchNpcs(region?: string): Promise<Npc[]> {
  let query = kidsDb.from("kids_npcs").select("*").eq("status", "published").order("order_index");
  if (region) query = query.eq("region", region);
  const { data, error } = await query.returns<Npc[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMarketItems(category?: string): Promise<MarketItem[]> {
  let query = kidsDb.from("kids_marketplace_items").select("*").eq("status", "published").order("order_index");
  if (category && category !== "all") query = query.eq("category", category);
  const { data, error } = await query.returns<MarketItem[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchTransports(): Promise<Transport[]> {
  const { data, error } = await kidsDb
    .from("kids_transportation").select("*").eq("status", "published").order("order_index")
    .returns<Transport[]>();
  if (error) throw error;
  return data ?? [];
}
