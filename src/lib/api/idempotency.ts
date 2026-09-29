/**
 * The Idempotency-Key a browser sends with every request that may cost VX.
 *
 * The four functions below reserve VX before they call a provider, and each
 * reservation is keyed. Without a key from the client, the server makes a
 * fresh one per HTTP request (supabase/functions/_shared/vx/billing.ts,
 * `requestIdempotencyKey`), so a repeat of the same attempt cannot be told
 * apart from a new one. With it, the server can.
 *
 * The rule for callers: **one key per attempt.**
 *  - Re-sending the same attempt whose outcome is unknown — the connection
 *    dropped before an answer arrived — reuses its key, so it is charged once.
 *  - A new attempt, including a "try again" after a clear failure, gets a new
 *    key. Reusing a key after a failure is answered 409 (duplicate), because
 *    that reservation is already closed.
 *
 * The server scopes the key to the signed-in account (#384) and accepts
 * 8–120 characters of [A-Za-z0-9_-]; anything else is ignored there.
 */

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** The edge functions that bill through the VX registry. */
export const BILLED_FUNCTIONS: ReadonlySet<string> = new Set([
  "ai-chat",
  "image-generate",
  "document-generate",
  "text-to-speech",
]);

/** A fresh key for one attempt: a UUID, which the server's pattern accepts. */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Browsers older than crypto.randomUUID (Safari < 15.4) still have
  // getRandomValues; 16 random bytes as hex is 32 accepted characters.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
