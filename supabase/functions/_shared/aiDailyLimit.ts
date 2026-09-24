// One unit of a user's daily allowance for a paid-provider edge function.
//
// The ceilings live in `check_ai_rate_limit` (see its latest migration), which
// counts per user, per function, per UTC day in `ai_usage_log` and serialises a
// user's concurrent calls. This file is only the edge-side half: ask the RPC,
// and turn a "no" into the same 429 `_shared/voice/access.ts` already returns.
//
// It takes the service client as an argument rather than importing
// supabase-js, so Vitest can drive it with a stub — the RPC is granted to
// `service_role` only, and a user-scoped client would be refused.
//
// Call it after the caller is identified and before anything reaches a
// provider. The row is written when the request is allowed, not when it
// succeeds: a failing provider still costs a unit, so forcing failures is not
// a way around the ceiling.

export interface DailyLimitClient {
  rpc(
    fn: "check_ai_rate_limit",
    args: { _user_id: string; _function_name: string },
  ): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}

export const RATE_LIMITED_MESSAGE = "Rate limit reached. Please try again later.";

/** Seconds until the RPC's window resets — the next UTC midnight. */
export function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/**
 * Charge one unit, or return the refusal to send instead.
 *
 * `null` means allowed. Anything else is a 429 carrying no ceiling, no count,
 * no provider and no cost — only when to come back. Fails closed: an
 * accounting system that cannot answer is not a reason to hand out a paid
 * provider call.
 */
export async function chargeDailyLimit(
  client: DailyLimitClient,
  userId: string,
  functionName: string,
  cors: Record<string, string>,
  now: () => Date = () => new Date(),
): Promise<Response | null> {
  let allowed = false;
  try {
    const { data, error } = await client.rpc("check_ai_rate_limit", {
      _user_id: userId,
      _function_name: functionName,
    });
    if (error) {
      console.error(`[${functionName}] quota check failed:`, error.code ?? "unknown");
    } else {
      allowed = data === true;
    }
  } catch {
    console.error(`[${functionName}] quota check threw`);
  }
  if (allowed) return null;

  return new Response(JSON.stringify({ error: RATE_LIMITED_MESSAGE }), {
    status: 429,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Retry-After": String(secondsUntilUtcMidnight(now())),
    },
  });
}
