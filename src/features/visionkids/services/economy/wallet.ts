import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { EconomySummary, DonationCause } from "@/features/visionkids/types/economy.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchEconomySummary(): Promise<EconomySummary> {
  const { data, error } = await kidsDb.rpc("get_kids_economy_summary");
  if (error) throw error;
  return data as EconomySummary;
}

export async function fetchCoinBalance(): Promise<number> {
  const userId = await currentUserId();
  if (!userId) return 0;
  const { data, error } = await kidsDb.from("user_points").select("points").eq("user_id", userId).returns<{ points: number }[]>();
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + (r.points ?? 0), 0);
}

export async function fetchPointsHistory(): Promise<{ points: number; reason: string; created_at: string }[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("user_points").select("points, reason, created_at").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(30)
    .returns<{ points: number; reason: string; created_at: string }[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchRedemptionSlugs(): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_redemptions").select("redeemable_slug").eq("user_id", userId)
    .returns<{ redeemable_slug: string }[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.redeemable_slug);
}

export async function redeemReward(slug: string): Promise<void> {
  const { error } = await kidsDb.rpc("redeem_kids_reward", { _slug: slug });
  if (error) throw error;
}

export async function donate(cause: DonationCause, amount: number): Promise<void> {
  const { error } = await kidsDb.rpc("donate_kids", { _cause: cause, _amount: amount });
  if (error) throw error;
}
