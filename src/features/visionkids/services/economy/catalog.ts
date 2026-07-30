import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { SubscriptionPlan, Redeemable, Partner } from "@/features/visionkids/types/economy.types";

export async function fetchPlans(audience?: string): Promise<SubscriptionPlan[]> {
  let query = kidsDb.from("kids_subscription_plans").select("*").eq("status", "published").order("order_index");
  if (audience) query = query.eq("audience", audience);
  const { data, error } = await query.returns<SubscriptionPlan[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchRedeemables(category?: string): Promise<Redeemable[]> {
  let query = kidsDb.from("kids_redeemables").select("*").eq("status", "published").order("order_index");
  if (category && category !== "all") query = query.eq("category", category);
  const { data, error } = await query.returns<Redeemable[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchPartners(): Promise<Partner[]> {
  const { data, error } = await kidsDb
    .from("kids_partners").select("*").eq("status", "published").order("order_index")
    .returns<Partner[]>();
  if (error) throw error;
  return data ?? [];
}
