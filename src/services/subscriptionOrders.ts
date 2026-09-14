// Subscription orders — the plan checkout that is paid through the owner on
// WhatsApp. Every write is a SECURITY DEFINER function; see
// supabase/migrations/20261013000000_subscription_orders.sql.

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  normalizeWhatsAppNumber,
  PAYMENT_WHATSAPP_SETTING,
  type PaymentMethod,
  type PlanMonths,
} from "@/lib/billing/whatsappCheckout";

export type SubscriptionOrderRow = Database["public"]["Tables"]["subscription_orders"]["Row"];
export type SubscriptionOrderStatus = "pending" | "approved" | "rejected";

export interface SubscriptionOrderWithBuyer extends SubscriptionOrderRow {
  buyer_display_name: string | null;
}

/** The number checkout opens, or null when an admin has not set one. */
export async function fetchPaymentWhatsAppNumber(): Promise<string | null> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", PAYMENT_WHATSAPP_SETTING)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeWhatsAppNumber(data?.value);
}

export async function createSubscriptionOrder(
  planId: string,
  method: PaymentMethod,
  months: PlanMonths,
): Promise<SubscriptionOrderRow> {
  const { data, error } = await supabase.rpc("create_subscription_order", {
    _plan_id: planId,
    _payment_method: method,
    _months: months,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchSubscriptionOrders(status?: SubscriptionOrderStatus): Promise<SubscriptionOrderWithBuyer[]> {
  let q = supabase.from("subscription_orders").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data: orders, error } = await q;
  if (error) throw new Error(error.message);

  const rows = orders ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  let names: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);
    names = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.display_name ?? ""]));
  }

  return rows.map((r) => ({ ...r, buyer_display_name: names[r.user_id] || null }));
}

export async function reviewSubscriptionOrder(args: {
  orderId: string;
  action: "approve" | "reject";
  adminNotes?: string;
}): Promise<SubscriptionOrderRow> {
  const params = { _order_id: args.orderId, _admin_notes: args.adminNotes };
  const { data, error } = args.action === "approve"
    ? await supabase.rpc("approve_subscription_order", params)
    : await supabase.rpc("reject_subscription_order", params);
  if (error) throw new Error(error.message);
  return data;
}
