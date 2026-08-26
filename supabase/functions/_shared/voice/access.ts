// Who is allowed to spend money on speech, and how often.
//
// ── The hole this closes ────────────────────────────────────────────────────
//
// `text-to-speech` and `ai-voice-chat` performed no identity check at all. The
// Supabase gateway's `verify_jwt` was doing the only gatekeeping, and the anon
// publishable key *is* a valid JWT — it ships in the public bundle, where
// anybody can read it. Both endpoints call a paid provider on every request. So
// the practical position was an unlimited, unattributed, billable path, open to
// anyone who viewed source. `speech-generate` already did this correctly; this
// is that pattern, extracted once so the third and fourth callers cannot get it
// subtly different.
//
// ── Why the existing RPC and not a new quota system ─────────────────────────
//
// `check_ai_rate_limit(user_id, function_name)` already exists, is already
// granted to `service_role`, already writes `ai_usage_log`, and already carries
// per-function daily limits with a default of 30. A second quota system would
// be a second set of numbers to keep in step and a second table to prune. New
// function names fall to that default, which is why this needs no migration —
// moving the two voice limits off 30 would need one, and that is a product
// decision rather than a security fix.
//
// ── Accounting happens before the provider call, on purpose ─────────────────
//
// The RPC writes the usage row when it allows a request, not when the request
// succeeds, so a provider failure still consumes quota. That is deliberate: if
// failures were free, forcing them would be a way to call a paid API without
// limit, and a retry loop against a broken provider would cost the most exactly
// when it helps the least.
//
// ── Why the decision is pure ────────────────────────────────────────────────
//
// Everything below is a function of its arguments. The two ports — "who is
// this token" and "may they spend one more unit" — arrive as functions, so the
// whole policy, including the failure modes that matter most (no header, a
// token that resolves to nobody, a quota system that is itself down), is
// testable without a network, a Postgres or a running gateway. `guard.ts`
// supplies the real implementations.

/** What a caller is told, and nothing more than that. */
export type VoiceAccessRefusal =
  | { status: 401; error: "Unauthorized" }
  | { status: 429; error: "Rate limit reached. Please try again later." }
  | { status: 500; error: "Server not configured" };

/**
 * Allowed, or refused with a reason.
 *
 * Discriminated on a string rather than a boolean `ok`, which is not a style
 * preference: `tsconfig.app.json` sets `strict: false`, and TypeScript does not
 * narrow a union on a boolean literal under it. A caller writing the obvious
 * `if (result.ok) … else result.refusal` would fail to compile. `TtsResult` is
 * shaped this way for the same reason.
 */
export type VoiceAccessResult =
  | { outcome: "allowed"; userId: string }
  | { outcome: "refused"; refusal: VoiceAccessRefusal };

const UNAUTHORIZED: VoiceAccessResult = {
  outcome: "refused",
  refusal: { status: 401, error: "Unauthorized" },
};
const RATE_LIMITED: VoiceAccessResult = {
  outcome: "refused",
  refusal: { status: 429, error: "Rate limit reached. Please try again later." },
};
const MISCONFIGURED: VoiceAccessResult = {
  outcome: "refused",
  refusal: { status: 500, error: "Server not configured" },
};

export interface VoiceAccessPorts {
  /**
   * The user this Authorization header belongs to, or null.
   *
   * Null covers both "no such user" and "the token is the publishable key",
   * which is the case that used to slip through: that key is a valid JWT and
   * resolves to nobody at all.
   */
  identify(authHeader: string): Promise<{ id: string } | null>;
  /**
   * Whether this user may spend one more unit today, charging it if so.
   *
   * Three answers, not two. `"error"` is separate from `false` because the two
   * are refused for different reasons and only one of them is the user's fault.
   */
  checkLimit(userId: string, functionName: string): Promise<boolean | "error">;
}

/**
 * Verify the caller and charge them one unit of their daily voice quota.
 *
 * `functionName` is what lands in `ai_usage_log`, so it must match the edge
 * function's own name — that is what makes the spend attributable afterwards.
 *
 * Nothing about the request body is read: a caller that fails this check must
 * never have reached a provider, so this runs before the body is parsed.
 */
export async function decideVoiceAccess(input: {
  authHeader: string | null;
  configured: boolean;
  functionName: string;
  ports: VoiceAccessPorts;
}): Promise<VoiceAccessResult> {
  if (!input.authHeader) return UNAUTHORIZED;
  if (!input.configured) return MISCONFIGURED;

  const user = await input.ports.identify(input.authHeader);
  if (!user?.id) return UNAUTHORIZED;

  const allowed = await input.ports.checkLimit(user.id, input.functionName);

  // Fail closed. An accounting system that cannot answer is not a reason to
  // hand out free provider calls, and this line is only ever reached by a
  // request that is about to spend money.
  if (allowed === "error" || allowed === false) return RATE_LIMITED;

  return { outcome: "allowed", userId: user.id };
}

/** The refusal, as the JSON body these endpoints already return. */
export function refusalResponse(
  refusal: VoiceAccessRefusal,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: refusal.error }), {
    status: refusal.status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
