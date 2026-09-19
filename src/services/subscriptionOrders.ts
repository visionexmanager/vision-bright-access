// Subscription orders — the plan checkout that is paid through the owner on
// WhatsApp. Every write is a SECURITY DEFINER function; see
// supabase/migrations/20261013000000_subscription_orders.sql.

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  normalizeWhatsAppNumber,
  PAYMENT_OMT_NAME_SETTING,
  PAYMENT_WHATSAPP_SETTING,
  type PaymentMethod,
  type PlanMonths,
} from "@/lib/billing/whatsappCheckout";

export type SubscriptionOrderRow = Database["public"]["Tables"]["subscription_orders"]["Row"];
export type SubscriptionOrderStatus = "pending" | "approved" | "rejected";

export interface SubscriptionOrderWithBuyer extends SubscriptionOrderRow {
  buyer_display_name: string | null;
}

export interface PaymentContact {
  /** Digits, or null when an admin has not set a usable number. */
  number: string | null;
  /** The name an OMT transfer is sent to, or null when unset. */
  omtName: string | null;
}

/** Where a subscriber pays: the owner's number, and the name for OMT. */
export async function fetchPaymentContact(): Promise<PaymentContact> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", [PAYMENT_WHATSAPP_SETTING, PAYMENT_OMT_NAME_SETTING]);
  if (error) throw new Error(error.message);
  const value = (key: string) => (data ?? []).find((row) => row.key === key)?.value;
  const name = value(PAYMENT_OMT_NAME_SETTING);
  return {
    number: normalizeWhatsAppNumber(value(PAYMENT_WHATSAPP_SETTING)),
    omtName: typeof name === "string" && name.trim() ? name.trim() : null,
  };
}

export async function createSubscriptionOrder(
  planId: string,
  method: PaymentMethod,
  months: PlanMonths,
  whatsappPhone: string,
): Promise<SubscriptionOrderRow> {
  const { data, error } = await supabase.rpc("create_subscription_order", {
    _plan_id: planId,
    _payment_method: method,
    _months: months,
    _whatsapp_phone: whatsappPhone,
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
