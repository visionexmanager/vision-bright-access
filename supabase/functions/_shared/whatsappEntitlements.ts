// What a sender is allowed to spend today, and how that is said to them.
//
// The database function `whatsapp_entitlements` answers the question; this
// file reads the answer safely and turns it into a sentence. Pure — no `Deno`,
// no fetch, no database client — so the suite can pin the two things that
// matter: that a malformed answer never opens the gate, and that somebody who
// has run out is told what to do about it rather than met with silence.
//
// ── What is metered, and what is not ────────────────────────────────────────
//
// Only operations that cost money: an AI answer, a transcription, a spoken
// reply, a picture or a document understood. Navigation, the menu, the
// language switch, the weather, where you are, what is nearby, a place lookup
// — all free or keyless, none of them counted. Somebody pressing menu numbers
// never runs out, and somebody asking where the nearest pharmacy is never
// spends an allowance on it.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

/** Where somebody goes to pick a plan. */
export const PLANS_URL = "https://visionex.app/pricing";

/** The paid operations, named so the breakdown says where the money went. */
export type MeteredKind = "ai" | "voice_in" | "voice_out" | "image" | "document" | "video";

export interface Entitlement {
  linked: boolean;
  plan: string;
  planName: string;
  dailyLimit: number;
  usedToday: number;
  /** -1 means unlimited. */
  remaining: number;
  allowed: boolean;
}

/**
 * A refusal is the safe default.
 *
 * Used when the entitlement lookup itself failed — a database hiccup, a
 * migration not yet applied. It deliberately *allows*: an assistant that stops
 * answering because a billing table was briefly unreachable has turned a
 * billing problem into an outage, and this audience cannot tell the two apart.
 * Undercharging for a minute is the cheaper mistake.
 */
export const UNKNOWN_ENTITLEMENT: Entitlement = {
  linked: false,
  plan: "unknown",
  planName: "Free",
  dailyLimit: 0,
  usedToday: 0,
  remaining: -1,
  allowed: true,
};

function asInteger(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

/**
 * Read what the database said.
 *
 * Every field is checked rather than trusted: this is the only thing standing
 * between a malformed row and either a free-for-all or a locked-out customer.
 */
export function readEntitlement(payload: unknown): Entitlement {
  if (!payload || typeof payload !== "object") return UNKNOWN_ENTITLEMENT;
  const row = payload as Record<string, unknown>;

  // `allowed` has to be the literal true. A string, a null or a missing field
  // is not permission, and `Boolean("false")` is exactly the bug that would
  // make it look like one.
  const allowed = row.allowed === true;

  return {
    linked: row.linked === true,
    plan: typeof row.plan === "string" && row.plan ? row.plan : "none",
    planName: typeof row.plan_name === "string" && row.plan_name ? row.plan_name : "Free",
    dailyLimit: asInteger(row.daily_limit, 0),
    usedToday: asInteger(row.used_today, 0),
    remaining: asInteger(row.remaining, -1),
    allowed,
  };
}

/** True when the sender is on a plan with no ceiling. */
export function isUnlimited(entitlement: Entitlement): boolean {
  return entitlement.dailyLimit === 0 || entitlement.remaining < 0;
}

/**
 * Worth mentioning that the allowance is nearly gone?
 *
 * Once, at a quarter left, and never on an unlimited plan. A warning on every
 * message would be nagging; one warning is information.
 */
export function shouldWarn(entitlement: Entitlement): boolean {
  if (isUnlimited(entitlement) || !entitlement.allowed) return false;
  if (entitlement.dailyLimit <= 0) return false;
  return entitlement.remaining === Math.max(1, Math.floor(entitlement.dailyLimit / 4));
}

/**
 * "You have used today's allowance."
 *
 * Three things, in the order somebody needs them: that the free part of the
 * day is over, that it comes back tomorrow, and where to get more now. A
 * refusal without the third line is a dead end, and this audience cannot
 * skim a website to find the way out of one.
 */
export function planLimitNotice(language: Language, entitlement: Entitlement): string {
  return say("planLimitReached", language)
    .replace("{limit}", String(entitlement.dailyLimit))
    .replace("{url}", PLANS_URL);
}

/** "You have {remaining} left today." Said once, near the end. */
export function planWarningNotice(language: Language, entitlement: Entitlement): string {
  return say("planAlmostSpent", language)
    .replace("{remaining}", String(entitlement.remaining))
    .replace("{url}", PLANS_URL);
}

/** Longest a message can be and still be read as a question about the plan. */
export const PLAN_QUESTION_MAX_CHARS = 60;

const PLAN_QUESTION = [
  /\b(my (plan|subscription|quota|allowance|balance)|what'?s my plan|how many (messages|requests) (do i have|left)|usage)\b/i,
  /\b(subscription|plan) (status|details)\b/i,
  /(باقتي|اشتراكي|رصيدي|كم بقي لي|كم باقي لي|كم تبقى لي|حسابي كم|استهلاكي)/,
  /(شو باقتي|ما هي باقتي|وش باقتي|كم رسالة باقي)/,
];

/**
 * "What is my plan?"
 *
 * Answered from the entitlement row, which is one cheap query — and
 * deliberately not by the model, which would have to guess and would charge
 * somebody a request from the allowance to guess wrong about the allowance.
 */
export function asksAboutPlan(text: string | null | undefined): boolean {
  const trimmed = (text ?? "").trim();
  if (!trimmed || trimmed.length > PLAN_QUESTION_MAX_CHARS) return false;
  return PLAN_QUESTION.some((pattern) => pattern.test(trimmed));
}

/** The answer to "what is my plan?" — plan, allowance, and what is left. */
export function planStatusNotice(language: Language, entitlement: Entitlement): string {
  if (isUnlimited(entitlement)) {
    return say("planStatusUnlimited", language).replace("{plan}", entitlement.planName);
  }
  return say("planStatus", language)
    .replace("{plan}", entitlement.planName)
    .replace("{used}", String(entitlement.usedToday))
    .replace("{limit}", String(entitlement.dailyLimit))
    .replace("{url}", PLANS_URL);
}
