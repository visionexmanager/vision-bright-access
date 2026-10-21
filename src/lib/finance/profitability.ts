// Subscription unit economics: revenue, delivery cost and profit per plan.
//
// Pure and framework-free, like `lib/billing/plans.ts`, which stays the only
// place a price, a monthly VX figure or a WhatsApp cap is written. This module
// reads `PAID_PLANS`; it never restates them. Everything else it needs (unit
// costs, usage, fixed costs, payment fees) is passed in as `Assumptions`, shaped
// like docs/finance/profitability-assumptions.json, where each number says
// whether it was measured, published, read from code, estimated or is unknown.
//
// Definitions (the audit's, applied once each so nothing is subtracted twice):
//   net revenue        = price + measured extra − refunds − chargebacks − payment fees − fx − tax
//   contribution       = net revenue − variable delivery cost
//   operating profit   = contribution − allocated fixed cost
//   margin             = operating profit / net revenue × 100   (null when net ≤ 0)
//
// A cost that has no value is reported in `unknownCosts` and left out of the
// total; it is never silently treated as free.

import { PAID_PLANS, VX_PER_USD, type PaidPlanId } from "@/lib/billing/plans";

export type Basis = "measured" | "published" | "code" | "estimate" | "unknown";

export interface UsdItem { usd?: number | null; basis: Basis; note?: string }
export interface NumItem { value?: number | null; basis: Basis; note?: string }

export type OpKey =
  | "chat_messages"
  | "whatsapp_messages"
  | "image_medium"
  | "tts_clip"
  | "stt_voice_note"
  | "ocr"
  | "realtime_minutes"
  | "document_ai"
  | "voice_clone"
  | "video_clip";

export const OP_KEYS: readonly OpKey[] = [
  "chat_messages", "whatsapp_messages", "image_medium", "tts_clip", "stt_voice_note",
  "ocr", "realtime_minutes", "document_ai", "voice_clone", "video_clip",
] as const;

export type Usage = Partial<Record<OpKey, number>>;
export type ScenarioId = "light" | "typical" | "heavy";
export const SCENARIOS: readonly ScenarioId[] = ["light", "typical", "heavy"] as const;

export interface FeeRule { pct: number; fixed_usd: number }

export interface Assumptions {
  payment: {
    mix: Record<string, number | string>;
    fees: Record<string, FeeRule & { basis?: Basis }>;
    refund_rate: NumItem;
    chargeback_rate: NumItem;
    fx_fee_pct: NumItem;
    tax_pct: NumItem;
    measured_additional_revenue_usd_per_sub: NumItem;
  };
  unit_costs: Record<string, UsdItem & NumItem>;
  fixed_costs_monthly: Record<string, UsdItem>;
  step_costs_monthly: { id: string; from_paying_subscribers: number; usd: number }[];
  free_users: {
    per_paying_subscriber: NumItem;
    monthly_cost_usd_per_free_user: NumItem;
  };
  usage: Record<string, unknown>;
  mixes: Record<string, Record<string, number | string>>;
  registry_services: Record<string, { vx_price: number; base_cost: number } | string>;
}

export interface CostLine { op: string; units: number; unitUsd: number; usd: number; basis: Basis }

export interface PlanResult {
  plan: PaidPlanId;
  scenario: ScenarioId;
  price: number;
  netRevenue: number;
  paymentFees: number;
  variableCost: number;
  lines: CostLine[];
  unknownCosts: string[];
  contribution: number;
  allocatedFixed: number;
  operatingProfit: number;
  marginPct: number | null;
  /** How many times the scenario's usage fits before contribution reaches zero. */
  usageHeadroom: number | null;
  /** Variable cost the plan can carry before contribution reaches zero. */
  maxSustainableVariableUsd: number;
  /** Share of variable cost resting on each kind of evidence. */
  evidenceShare: Record<Basis, number>;
}

const num = (item: NumItem | undefined): number => {
  const v = item?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};

/** Revenue kept from one subscriber-month after every payment-related deduction. */
export function netRevenue(a: Assumptions, price: number): { net: number; fees: number; refunds: number } {
  if (!(price > 0)) return { net: 0, fees: 0, refunds: 0 };
  const taxPct = num(a.payment.tax_pct);
  const exTax = taxPct > 0 ? price / (1 + taxPct) : price;
  const refunds = exTax * num(a.payment.refund_rate);
  const chargebacks = exTax * num(a.payment.chargeback_rate);
  const fx = exTax * num(a.payment.fx_fee_pct);
  const collected = exTax - refunds - chargebacks;
  let fees = 0;
  for (const [method, share] of Object.entries(a.payment.mix)) {
    const rule = a.payment.fees[method];
    if (typeof share !== "number" || !rule) continue;
    fees += share * (rule.pct * collected + rule.fixed_usd);
  }
  const extra = num(a.payment.measured_additional_revenue_usd_per_sub);
  return { net: exTax + extra - refunds - chargebacks - fees - fx, fees: fees + fx, refunds: refunds + chargebacks };
}

/** Cost of one blended assistant answer, including failed-attempt overhead. */
export function chatUnitUsd(a: Assumptions): number | null {
  const hi = a.unit_costs.chat_message_gpt41?.usd;
  const lo = a.unit_costs.chat_message_cheap?.usd;
  if (typeof hi !== "number" || typeof lo !== "number") return null;
  const share = num(a.unit_costs.chat_share_expensive);
  const mult = a.unit_costs.chat_fallback_multiplier?.value ?? 1;
  return (share * hi + (1 - share) * lo) * mult;
}

function unitFor(a: Assumptions, op: OpKey): { usd: number | null; basis: Basis } {
  const c = a.unit_costs;
  switch (op) {
    case "chat_messages":
      return { usd: chatUnitUsd(a), basis: c.chat_message_gpt41?.basis ?? "unknown" };
    case "whatsapp_messages": {
      const chat = chatUnitUsd(a);
      const meta = c.whatsapp_service_message?.usd;
      if (chat === null || typeof meta !== "number") return { usd: null, basis: "unknown" };
      // Meta's leg is the least certain part; label the pair by it.
      return { usd: chat * (c.whatsapp_ai_share?.value ?? 1) + meta, basis: c.whatsapp_service_message.basis };
    }
    case "image_medium": return { usd: c.image_medium?.usd ?? null, basis: c.image_medium?.basis ?? "unknown" };
    case "tts_clip": return { usd: c.tts_clip?.usd ?? null, basis: c.tts_clip?.basis ?? "unknown" };
    case "stt_voice_note": return { usd: c.stt_voice_note?.usd ?? null, basis: c.stt_voice_note?.basis ?? "unknown" };
    case "ocr": return { usd: c.ocr?.usd ?? null, basis: c.ocr?.basis ?? "unknown" };
    case "realtime_minutes": return { usd: c.realtime_minute?.usd ?? null, basis: c.realtime_minute?.basis ?? "unknown" };
    case "document_ai": return { usd: c.document_ai?.usd ?? null, basis: c.document_ai?.basis ?? "unknown" };
    case "voice_clone": return { usd: c.voice_clone?.usd ?? null, basis: c.voice_clone?.basis ?? "unknown" };
    case "video_clip": return { usd: c.video_clip?.usd ?? null, basis: c.video_clip?.basis ?? "unknown" };
  }
}

/** Variable delivery cost of a usage vector. Unknown unit costs are listed, not zeroed. */
export function variableCost(a: Assumptions, usage: Usage): { total: number; lines: CostLine[]; unknown: string[] } {
  const lines: CostLine[] = [];
  const unknown: string[] = [];
  let total = 0;
  for (const op of OP_KEYS) {
    const units = usage[op] ?? 0;
    if (!(units > 0)) continue;
    const { usd, basis } = unitFor(a, op);
    if (usd === null) { unknown.push(op); continue; }
    const cost = units * usd;
    lines.push({ op, units, unitUsd: usd, usd: cost, basis });
    total += cost;
  }
  const perSub = a.unit_costs.bandwidth_storage_per_sub?.usd;
  if (typeof perSub === "number" && perSub > 0) {
    lines.push({ op: "bandwidth_storage", units: 1, unitUsd: perSub, usd: perSub, basis: a.unit_costs.bandwidth_storage_per_sub.basis });
    total += perSub;
  }
  return { total, lines, unknown };
}

/** Fixed monthly cost at a given number of paying subscribers: base items plus any step that has kicked in. */
export function fixedCostAt(a: Assumptions, paying: number): number {
  let total = 0;
  for (const item of Object.values(a.fixed_costs_monthly)) total += item.usd ?? 0;
  for (const step of a.step_costs_monthly) if (paying >= step.from_paying_subscribers) total += step.usd;
  return total;
}

export function usageFor(a: Assumptions, plan: PaidPlanId, scenario: ScenarioId): Usage {
  const byPlan = a.usage[plan] as Record<string, Usage> | undefined;
  return byPlan?.[scenario] ?? {};
}

/** One plan under one scenario. `payingSubscribers` sets how thin the fixed cost is spread. */
export function evaluatePlan(a: Assumptions, plan: PaidPlanId, scenario: ScenarioId, payingSubscribers: number): PlanResult {
  const def = PAID_PLANS[plan];
  const rev = netRevenue(a, def.price);
  const cost = variableCost(a, usageFor(a, plan, scenario));
  const contribution = rev.net - cost.total;
  const allocatedFixed = payingSubscribers > 0 ? fixedCostAt(a, payingSubscribers) / payingSubscribers : 0;
  const operatingProfit = contribution - allocatedFixed;
  const evidenceShare: Record<Basis, number> = { measured: 0, published: 0, code: 0, estimate: 0, unknown: 0 };
  if (cost.total > 0) for (const l of cost.lines) evidenceShare[l.basis] += l.usd / cost.total;
  return {
    plan, scenario, price: def.price, netRevenue: rev.net, paymentFees: rev.fees,
    variableCost: cost.total, lines: cost.lines, unknownCosts: cost.unknown,
    contribution, allocatedFixed, operatingProfit,
    marginPct: rev.net > 0 ? (operatingProfit / rev.net) * 100 : null,
    usageHeadroom: cost.total > 0 ? rev.net / cost.total : null,
    maxSustainableVariableUsd: Math.max(0, rev.net - allocatedFixed),
    evidenceShare,
  };
}

export interface Projection {
  paying: number;
  grossRevenue: number;
  netRevenue: number;
  variableCost: number;
  freeUserCost: number;
  fixedCost: number;
  operatingProfit: number;
  arpu: number;
  costPerSubscriber: number;
  contributionMarginPct: number | null;
  operatingMarginPct: number | null;
}

/**
 * The whole business at N paying subscribers. Each plan's subscribers split
 * across light/typical/heavy by `usageMix`. WhatsApp's monthly free service
 * messages are a business-level credit, applied once.
 */
export function projectBusiness(
  a: Assumptions,
  paying: number,
  subscriberMix: Record<string, number | string>,
  usageMix: Record<string, number | string>,
): Projection {
  let gross = 0, net = 0, variable = 0, waMessages = 0;
  for (const plan of Object.keys(PAID_PLANS) as PaidPlanId[]) {
    const share = Number(subscriberMix[plan] ?? 0);
    const count = paying * share;
    if (!(count > 0)) continue;
    const rev = netRevenue(a, PAID_PLANS[plan].price);
    gross += count * PAID_PLANS[plan].price;
    net += count * rev.net;
    for (const s of SCENARIOS) {
      const w = Number(usageMix[s] ?? 0);
      if (!(w > 0)) continue;
      const usage = usageFor(a, plan, s);
      variable += count * w * variableCost(a, usage).total;
      waMessages += count * w * (usage.whatsapp_messages ?? 0);
    }
  }
  const pool = num(a.unit_costs.whatsapp_free_service_messages_per_month);
  const meta = a.unit_costs.whatsapp_service_message?.usd ?? 0;
  variable -= Math.min(pool, waMessages) * meta;

  const freeUsers = paying * num(a.free_users.per_paying_subscriber);
  const freeUserCost = freeUsers * num(a.free_users.monthly_cost_usd_per_free_user);
  const fixed = fixedCostAt(a, paying);
  const profit = net - variable - freeUserCost - fixed;
  return {
    paying, grossRevenue: gross, netRevenue: net, variableCost: variable, freeUserCost, fixedCost: fixed,
    operatingProfit: profit,
    arpu: paying > 0 ? gross / paying : 0,
    costPerSubscriber: paying > 0 ? (variable + freeUserCost + fixed) / paying : 0,
    contributionMarginPct: net > 0 ? ((net - variable - freeUserCost) / net) * 100 : null,
    operatingMarginPct: net > 0 ? (profit / net) * 100 : null,
  };
}

/** Smallest number of paying subscribers whose operating profit is not negative, or null if none up to `limit`. */
export function breakEvenSubscribers(
  a: Assumptions,
  subscriberMix: Record<string, number | string>,
  usageMix: Record<string, number | string>,
  limit = 20_000,
): number | null {
  for (let n = 1; n <= limit; n++) {
    if (projectBusiness(a, n, subscriberMix, usageMix).operatingProfit >= 0) return n;
  }
  return null;
}

/** Provider cost per 1,000 VX of a registry service, from its own price and cost. */
export function costPer1000Vx(service: { vx_price: number; base_cost: number }): number | null {
  return service.vx_price > 0 ? (service.base_cost / service.vx_price) * 1000 : null;
}

/**
 * The most a plan's VX can cost per 1,000 spent before the plan stops earning,
 * if the subscriber spends the whole monthly allowance. Null when the plan
 * carries no VX.
 */
export function maxSustainableCostPer1000Vx(a: Assumptions, plan: PaidPlanId): number | null {
  const vx = PAID_PLANS[plan].vxMonthly;
  if (!(vx > 0)) return null;
  return netRevenue(a, PAID_PLANS[plan].price).net / (vx / VX_PER_USD); // USD per 1,000 VX
}

/** Cost of spending the entire monthly VX allowance on a service costing `per1000` USD per 1,000 VX. */
export function fullAllowanceCost(plan: PaidPlanId, per1000: number): number {
  return (PAID_PLANS[plan].vxMonthly / VX_PER_USD) * per1000;
}

/**
 * The share of subscribers who may be heavy users before the plan's
 * contribution turns negative, the rest being split light/typical by
 * `lightShareOfRest`. Null when heavy users do not lose money; 0 when even
 * a typical user does.
 */
export function maxHeavyShare(a: Assumptions, plan: PaidPlanId, lightShareOfRest = 0.5): number | null {
  const light = evaluatePlan(a, plan, "light", 1).contribution;
  const typical = evaluatePlan(a, plan, "typical", 1).contribution;
  const heavy = evaluatePlan(a, plan, "heavy", 1).contribution;
  const rest = lightShareOfRest * light + (1 - lightShareOfRest) * typical;
  if (heavy >= 0) return null;
  if (rest <= 0) return 0;
  return rest / (rest - heavy);
}
