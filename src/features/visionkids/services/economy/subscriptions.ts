import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { Subscription, Invoice, SubscribeResult, FinancialReports } from "@/features/visionkids/types/economy.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchMySubscriptions(): Promise<Subscription[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_subscriptions").select("*").order("created_at", { ascending: false })
    .returns<Subscription[]>();
  if (error) throw error;
  return data ?? [];
}

export async function subscribe(planSlug: string, orgId?: string): Promise<SubscribeResult> {
  const { data, error } = await kidsDb.rpc("subscribe_kids_plan", { _plan_slug: planSlug, _org_id: orgId ?? null });
  if (error) throw error;
  return data as SubscribeResult;
}

export async function approveSubscription(id: string): Promise<void> {
  const { error } = await kidsDb.rpc("approve_kids_subscription", { _id: id });
  if (error) throw error;
}

export async function cancelSubscription(id: string): Promise<void> {
  const { error } = await kidsDb.rpc("cancel_kids_subscription", { _id: id });
  if (error) throw error;
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_invoices").select("*").eq("user_id", userId).order("issued_at", { ascending: false })
    .returns<Invoice[]>();
  if (error) throw error;
  return data ?? [];
}

// ── Guardians ─────────────────────────────────────────────────────────────────
export async function fetchMyChildren(): Promise<{ child_id: string }[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_economy_guardians").select("child_id").eq("guardian_id", userId)
    .returns<{ child_id: string }[]>();
  if (error) throw error;
  return data ?? [];
}

export async function linkGuardian(guardianId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Must be signed in");
  const { error } = await kidsDb.from("kids_economy_guardians").insert({ guardian_id: guardianId, child_id: userId });
  if (error) throw error;
}

export async function fetchFinancialReports(): Promise<FinancialReports> {
  const { data, error } = await kidsDb.rpc("get_kids_financial_reports");
  if (error) throw error;
  return data as FinancialReports;
}
