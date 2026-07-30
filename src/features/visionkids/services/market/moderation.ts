import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { Product, Creator, ModerationRecord } from "@/features/visionkids/types/market.types";

export interface QueueEntry {
  product: Product;
  moderation: ModerationRecord | null;
}

/** Products awaiting human review (status = 'pending'), newest first, with
 *  their moderation record. Visible only to moderators (RLS enforces it). */
export async function fetchModerationQueue(): Promise<QueueEntry[]> {
  const { data, error } = await kidsDb
    .from("kids_market_products")
    .select("*, kids_market_moderation(*)")
    .eq("status", "pending")
    .order("updated_at", { ascending: true })
    .limit(100)
    .returns<(Product & { kids_market_moderation: ModerationRecord | ModerationRecord[] | null })[]>();
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { kids_market_moderation, ...product } = row;
    const moderation = Array.isArray(kids_market_moderation) ? kids_market_moderation[0] ?? null : kids_market_moderation;
    return { product: product as Product, moderation };
  });
}

export async function moderateProduct(productId: string, approve: boolean, notes?: string): Promise<void> {
  const { error } = await kidsDb.rpc("moderate_kids_product", { _product_id: productId, _approve: approve, _notes: notes ?? null });
  if (error) throw error;
}

export async function fetchPendingVerifications(): Promise<Creator[]> {
  const { data, error } = await kidsDb
    .from("kids_market_creators").select("*").eq("verification_status", "pending").order("updated_at", { ascending: true })
    .returns<Creator[]>();
  if (error) throw error;
  return data ?? [];
}

export async function verifyCreator(userId: string, approve: boolean, note?: string): Promise<void> {
  const { error } = await kidsDb.rpc("verify_kids_creator", { _user_id: userId, _approve: approve, _note: note ?? null });
  if (error) throw error;
}
