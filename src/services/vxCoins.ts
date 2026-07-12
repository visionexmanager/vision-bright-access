// ─── VX Coin Purchases — manual-verification checkout ─────────────────────────
// WishMoney/OMT/PayPal have no merchant API/webhook here, so payment is
// verified by an admin reviewing a buyer-submitted reference code + optional
// proof screenshot (see supabase/migrations/20260712100000_vx_coin_purchases.sql
// and supabase/functions/vx-coin-review). Writes go through SECURITY DEFINER
// RPCs only — vx_coin_orders has no client INSERT/UPDATE policy.

import { supabase } from "@/integrations/supabase/client";
import { callVxCoinReview } from "@/lib/api/edgeFunctions";

export type VxPaymentMethod = "wishmoney" | "omt" | "paypal";
export type VxCoinOrderStatus = "pending" | "approved" | "rejected";

export interface VxCoinOrderRow {
  id: string;
  user_id: string;
  coins: number;
  price_usd: number;
  fee_usd: number;
  total_usd: number;
  payment_method: VxPaymentMethod;
  reference_code: string;
  proof_url: string | null;
  status: VxCoinOrderStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export async function uploadPaymentProof(userId: string, file: File): Promise<string> {
  const path = `${userId}/${Date.now()}-${file.name}`;
  const { error: uploadErr } = await supabase.storage.from("payment-proofs").upload(path, file);
  if (uploadErr) throw new Error(uploadErr.message);

  const { data: signed, error: signErr } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr) throw new Error(signErr.message);

  return signed.signedUrl;
}

export async function createVxCoinOrder(args: {
  coins: number;
  paymentMethod: VxPaymentMethod;
  referenceCode: string;
  proofUrl?: string | null;
}): Promise<VxCoinOrderRow> {
  const { data, error } = await (supabase.rpc as any)("create_vx_coin_order", {
    _coins: args.coins,
    _payment_method: args.paymentMethod,
    _reference_code: args.referenceCode,
    _proof_url: args.proofUrl ?? null,
  });
  if (error) throw new Error(error.message);
  return data as VxCoinOrderRow;
}

export async function fetchMyVxCoinOrders(userId: string): Promise<VxCoinOrderRow[]> {
  const { data, error } = await (supabase.from("vx_coin_orders") as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as VxCoinOrderRow[];
}

export interface VxCoinOrderWithBuyer extends VxCoinOrderRow {
  buyer_display_name: string | null;
}

export async function fetchVxCoinOrders(status?: VxCoinOrderStatus): Promise<VxCoinOrderWithBuyer[]> {
  let q = (supabase.from("vx_coin_orders") as any).select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data: orders, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (orders ?? []) as VxCoinOrderRow[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  let names: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await (supabase.from("profiles") as any)
      .select("user_id, display_name")
      .in("user_id", userIds);
    names = Object.fromEntries((profiles ?? []).map((p: { user_id: string; display_name: string | null }) => [p.user_id, p.display_name ?? ""]));
  }

  return rows.map((r) => ({ ...r, buyer_display_name: names[r.user_id] || null }));
}

export async function reviewVxCoinOrder(args: {
  orderId: string;
  action: "approve" | "reject";
  adminNotes?: string;
}): Promise<VxCoinOrderRow> {
  const { order } = await callVxCoinReview(args);
  return order as unknown as VxCoinOrderRow;
}
