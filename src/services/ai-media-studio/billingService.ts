// Billing Service — client-facing layer over billing-engine edge function
import { callBillingEngine } from "@/lib/api/edgeFunctions";
import type {
  BillingStatus,
  BillingConsumeResult,
  BillingPlan,
  CreditTransaction,
  UsageLog,
  OperationType,
  VxUsageRow,
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
  if (!res.ok || !res.data) throw new Error(res.error ?? "Failed to load balance");
  return res.data;
}

// ── Consume / Refund ──────────────────────────────────────────────────────────
//
// Gone. `consumeCredits` and `refundCredits` charged `credit_wallets` from the
// browser, and no screen ever called them — `billing_consume` has never run in
// production, which is why `usage_logs` is empty. Charging VX is now
// `vx_reserve`/`vx_settle` behind `_shared/vx/meter.ts`, server-side only,
// because the decision to charge is not one a client should be able to skip.
//
// See .claude/references/vx-deprecations.md.

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

export async function cancelSubscription(): Promise<void> {
  const res = await callBillingEngine({ action: "cancel" });
  if (!res.ok) throw new Error(res.error);
}

// Buying VX happens via the real /coins-store checkout (WishMoney/OMT/PayPal,
// admin-reviewed) — there used to be a purchaseCredits() here calling
// billing-engine's "grant_credits" action, but that action grants an
// arbitrary caller-supplied amount with no payment verification and is now
// intentionally rejected server-side (see billing-engine/index.ts).

// ── The unified usage ledger ──────────────────────────────────────────────────
//
// `getUsageLogs` above reads `usage_logs`, which is empty and always was —
// `billing_consume` never ran in production. This reads `vx_usage_ledger`
// through `my_vx_usage()`, the column list that leaves `provider` and
// `actual_cost_usd` on the admin side.

export async function getMyVxUsage(params: {
  limit?:  number;
  offset?: number;
} = {}): Promise<VxUsageRow[]> {
  const res = await callBillingEngine<VxUsageRow[]>({ action: "my_usage", ...params });
  return (res as { data?: VxUsageRow[] })?.data ?? [];
}
