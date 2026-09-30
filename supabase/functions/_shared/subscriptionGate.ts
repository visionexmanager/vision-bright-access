// No AI work for a caller without an active paid subscription.
//
// Every user-facing entry point that can reach an AI provider, a tool, a
// workflow or the VX meter asks this first — after it has proved who the caller
// is, and before any rate limit, daily allowance, VX charge or provider call:
//
//   REQUEST → IDENTIFY → subscriptionGate → (refused: stop) → the work
//
// The model is never the one deciding. A refused request never reaches it.
//
// ── Where the answer comes from ────────────────────────────────────────────
//
// `ai_subscription_gate` (migration 20261062000000). It reads
// `user_subscriptions` and `billing_plans` — the existing source of truth —
// and opens AI for an admin or an active, unexpired Kids/Basic/Pro/Business
// subscription, and for nothing else: not a trial, not a VX balance, not a
// pending order, not a lapsed subscription. The same call records, atomically,
// whether this caller has already been told, so exactly one of any number of
// simultaneous refused requests is `blocked_first_notice`.
//
// ── What is trusted ────────────────────────────────────────────────────────
//
// Only a user id the caller's Edge Function took from a verified JWT, or a
// WhatsApp number from a signature-checked webhook. Nothing in the request body
// or headers — plan, role, is_subscribed, x-plan, x-subscription-status — is
// read here or anywhere this gate is consulted.
//
// ── Failure ────────────────────────────────────────────────────────────────
//
// Closed. A gate that could not be asked refuses; anything other than the
// literal string 'authorized' refuses. Giving away a provider call is the
// expensive mistake here, and it is the one this file is written to never make.
//
// Pure: no `Deno`, no npm client — the caller passes its service-role client —
// so the suite can drive every branch.

import { anonymousCaller } from "./securityGuard.ts";

export type GateVerdict =
  | "authorized"
  | "blocked_first_notice"
  | "blocked_silent"
  | "unavailable";

/** Just enough of a Supabase service-role client to ask. */
export interface GateDb {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

export type GateSubject =
  /** A signed-in website/API caller. `userId` must come from a verified JWT. */
  | { channel: "web"; userId: string }
  /** An anonymous website caller, keyed by the keyed hash of its address. */
  | { channel: "web_anon"; callerId: string }
  /** A WhatsApp sender, as the signature-verified webhook delivered it. */
  | { channel: "whatsapp"; waPhone: string }
  /** A Messenger / Instagram sender id, from the signature-verified webhook. */
  | { channel: "meta"; senderId: string };

/** Only the literal 'authorized' passes. Everything else is a refusal. */
export function readGateVerdict(data: unknown, error: unknown): GateVerdict {
  if (error) return "unavailable";
  if (data === "authorized" || data === "blocked_first_notice" || data === "blocked_silent") return data;
  return "unavailable";
}

/** Ask the gate. Never throws; a failure is `unavailable`, which refuses. */
export async function requireActiveSubscription(db: GateDb, subject: GateSubject): Promise<GateVerdict> {
  try {
    if (subject.channel === "whatsapp") {
      if (!subject.waPhone?.trim()) return "blocked_silent";
      const { data, error } = await db.rpc("ai_subscription_gate_whatsapp", { _wa_phone: subject.waPhone });
      return readGateVerdict(data, error);
    }
    const [key, userId] = subject.channel === "web"
      ? [subject.userId, subject.userId]
      : subject.channel === "web_anon"
      ? [subject.callerId, null]
      : [subject.senderId, null];
    if (!key?.trim()) return "blocked_silent";
    const { data, error } = await db.rpc("ai_subscription_gate", {
      _channel: subject.channel,
      _subject: key,
      _user_id: userId,
    });
    return readGateVerdict(data, error);
  } catch {
    return "unavailable";
  }
}

/** Whether the work may run. The only branch that may lead to a provider. */
export function isAuthorized(verdict: GateVerdict): verdict is "authorized" {
  return verdict === "authorized";
}

export const PRICING_URL = "https://visionex.app/pricing";

/** Stable error code the website recognises and localizes. */
export const SUBSCRIPTION_REQUIRED = "subscription_required";

/**
 * The HTTP refusal. No English sentence: the website renders the localized
 * notice from the code, once, when `notify` is true. `notify: false` is the
 * silent refusal — the request is stopped and nothing new is said. Nothing
 * about the plan, the provider, the cost or the database is ever in it.
 */
export function subscriptionGateResponse(
  verdict: Exclude<GateVerdict, "authorized">,
  headers: Record<string, string> = {},
): Response {
  const body = verdict === "unavailable"
    ? { ok: false, error: "entitlement_unavailable" }
    : {
        ok: false,
        error: SUBSCRIPTION_REQUIRED,
        notify: verdict === "blocked_first_notice",
        upgrade_url: PRICING_URL,
      };
  return new Response(JSON.stringify(body), {
    status: verdict === "unavailable" ? 503 : 403,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/**
 * The one line every HTTP entry point calls:
 *
 *   const refused = await subscriptionGate(service, req, user?.id ?? null, corsHeaders);
 *   if (refused) return refused;
 *
 * `userId` must be the id of a JWT the function already verified, or null for
 * an anonymous caller. Returns null only when the caller is entitled.
 */
export async function subscriptionGate(
  db: GateDb,
  req: Request,
  userId: string | null | undefined,
  headers: Record<string, string> = {},
): Promise<Response | null> {
  let verdict: GateVerdict;
  if (userId) {
    verdict = await requireActiveSubscription(db, { channel: "web", userId });
  } else {
    let callerId = "";
    try {
      callerId = await anonymousCaller(req.headers);
    } catch {
      callerId = "";
    }
    verdict = await requireActiveSubscription(db, { channel: "web_anon", callerId });
  }
  return isAuthorized(verdict) ? null : subscriptionGateResponse(verdict, headers);
}
