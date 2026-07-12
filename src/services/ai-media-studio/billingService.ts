// Billing Service — client-facing layer over billing-engine edge function
import { callBillingEngine } from "@/lib/api/edgeFunctions";
import type {
  BillingStatus,
  BillingConsumeResult,
  BillingPlan,
  CreditTransaction,
  UsageLog,
  OperationType,
} from "@/lib/types/billing";

// ── Initialization ─────────────────────────────────────────────────────────────

export async function initializeBilling(): Promise<void> {
  await callBillingEngine({ action: "initialize" });
}

// ── Status ────────────────────────────────────────────────────────────────────

export async function getBillingStatus(): Promise<BillingStatus> {
  const res = await callBillingEngine<BillingStatus>({ action: "get_status" });
  if (!res.ok || !res.data) throw new Error(res.error ?? "Failed to load billing status");
  return res.data;
}

export async function getBalance(): Promise<{
  balance_vx: number;
  in_trial:   boolean;
  hours_left: number;
}> {
  const res = await callBillingEngine<{ balance_vx: number; in_trial: boolean; hours_left: number }>(
    { action: "get_balance" }
  );
  if (!res.ok) throw new Error(res.error);
  return res as { balance_vx: number; in_trial: boolean; hours_left: number };
}

// ── Consume / Refund ──────────────────────────────────────────────────────────

export async function consumeCredits(params: {
  operation_type:   OperationType;
  job_id?:          string;
  project_id?:      string;
  provider_slug?:   string;
  idempotency_key?: string;
  meta?:            Record<string, unknown>;
}): Promise<BillingConsumeResult> {
  const res = await callBillingEngine({ action: "consume", ...params });
  return res as BillingConsumeResult;
}

export async function refundCredits(params: {
  job_id: string;
  reason?: string;
}): Promise<{ ok: boolean; refunded: boolean; amount_vx?: number }> {
  const res = await callBillingEngine({ action: "refund", ...params });
  return res as { ok: boolean; refunded: boolean; amount_vx?: number };
}

// ── History & Logs ────────────────────────────────────────────────────────────

export async function getTransactionHistory(params: {
  limit?:  number;
  offset?: number;
  type?:   string;
} = {}): Promise<CreditTransaction[]> {
  const res = await callBillingEngine<CreditTransaction[]>({ action: "get_history", ...params });
  if (!res.ok) throw new Error(res.error);
  return res.data ?? [];
}

export async function getUsageLogs(params: {
  operation_type?: OperationType;
  limit?:          number;
  hours?:          number;
} = {}): Promise<UsageLog[]> {
  const res = await callBillingEngine<UsageLog[]>({ action: "get_usage_logs", ...params });
  if (!res.ok) throw new Error(res.error);
  return res.data ?? [];
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function getPlans(): Promise<BillingPlan[]> {
  const res = await callBillingEngine<BillingPlan[]>({ action: "get_plans" });
  if (!res.ok) throw new Error(res.error);
  return res.data ?? [];
}

// ── Subscription ──────────────────────────────────────────────────────────────

export async function upgradePlan(planId: string): Promise<void> {
  const res = await callBillingEngine({ action: "upgrade", plan_id: planId });
  if (!res.ok) throw new Error(res.error);
}

export async function cancelSubscription(): Promise<void> {
  const res = await callBillingEngine({ action: "cancel" });
  if (!res.ok) throw new Error(res.error);
}

// Buying VX happens via the real /coins-store checkout (WishMoney/OMT/PayPal,
// admin-reviewed) — there used to be a purchaseCredits() here calling
// billing-engine's "grant_credits" action, but that action grants an
// arbitrary caller-supplied amount with no payment verification and is now
// intentionally rejected server-side (see billing-engine/index.ts).
