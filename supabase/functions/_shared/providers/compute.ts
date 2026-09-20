// What a compute job looks like to Visionex, whoever ran it.
//
// The three layers this sits between already exist and are already in
// production: `providerRouter.ts` chooses a vendor from `ph_providers`,
// `_shared/vx/meter.ts` reserves and settles VX, and each adapter speaks one
// vendor's dialect. This file is the vocabulary the middle one is written in —
// the normalized job and the normalized failure — so that adding an execution
// target touches an adapter and a provider row, and nothing else.
//
// ── Why normalize at all ───────────────────────────────────────────────────
//
// Because the alternative leaks. A RunPod job carries `IN_QUEUE`, a numeric
// `delayTime`, and an endpoint id that is infrastructure; an OpenAI call
// carries none of those. If either shape reaches a React component or a
// WhatsApp reply, the provider has become part of the product, and swapping it
// becomes a user-visible change. The user should experience Visionex, not
// Visionex-and-a-vendor.
//
// Nothing here calls a provider. This is types and mapping only, which is what
// lets it be tested without a network and without a key.

// ── The normalized job ─────────────────────────────────────────────────────

/**
 * Where a job is, in Visionex's words.
 *
 * Deliberately the same five words the Usage screen and the VX ledger already
 * use for a reservation, so a job's state and its billing state can be read
 * side by side without a translation table in the reader's head.
 */
export type ComputeStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

/** The terminal states. A job in one of these will not change again. */
export const TERMINAL: readonly ComputeStatus[] = [
  "completed", "failed", "cancelled", "timed_out",
] as const;

export function isTerminal(status: ComputeStatus): boolean {
  return TERMINAL.includes(status);
}

/**
 * Whether this outcome earned the VX that was reserved for it.
 *
 * Only a completed job did. Everything else releases — which is the existing
 * rule in `vx_release`, restated here so an adapter cannot invent a different
 * one for its own failures.
 */
export function isBillable(status: ComputeStatus): boolean {
  return status === "completed";
}

/**
 * One compute job, normalized.
 *
 * `providerJobId` is internal: it is stored against the Visionex reservation
 * and never returned to a browser or a WhatsApp reply. A job is addressed by
 * *our* reservation id, which is already owned by a user and already covered
 * by the ledger's admin-only policy — so there is no provider id to enumerate
 * and no cross-user handle to guess.
 */
export interface ComputeJob {
  /** The vendor's handle. Internal only. */
  providerJobId: string | null;
  status: ComputeStatus;
  /** Whatever the worker produced, unopened. Validated by the caller. */
  output: unknown;
  /** Internal timings and provider metadata. Never user-facing. */
  metadata: Record<string, unknown>;
  /** Milliseconds of actual execution, when the provider reports it. */
  durationMs: number | null;
  error: ComputeError | null;
}

// ── Failures, in Visionex's vocabulary ─────────────────────────────────────

/**
 * Provider-neutral error codes.
 *
 * A caller should be able to decide what to do — refuse, release, retry, fall
 * back — without knowing which vendor failed. `PROVIDER_*` deliberately does
 * not name the provider: the name goes in the internal log, not in the code
 * the frontend branches on.
 */
export type ComputeErrorCode =
  | "AUTH_REQUIRED"
  | "PLAN_REQUIRED"
  | "INSUFFICIENT_VX"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_INPUT"
  | "PROVIDER_DISABLED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_FAILED"
  | "JOB_NOT_FOUND"
  | "JOB_EXPIRED"
  | "OUTPUT_INVALID"
  | "NOT_CONFIGURED";

export interface ComputeError {
  code: ComputeErrorCode;
  /** Safe to show a person. Names no vendor, no endpoint, no cost. */
  message: string;
  /** True when the same request could reasonably succeed on a retry. */
  retryable: boolean;
}

/**
 * Which failures are worth trying again, and which are the caller's fault.
 *
 * Phase rule, encoded once: never retry invalid input, a policy rejection, an
 * auth failure, an entitlement failure or insufficient VX. Retrying any of
 * those burns money to reach the same answer.
 */
const RETRYABLE: readonly ComputeErrorCode[] = [
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
] as const;

export function computeError(code: ComputeErrorCode, message: string): ComputeError {
  return { code, message, retryable: RETRYABLE.includes(code) };
}

/** The sentences a person may see. Deliberately free of infrastructure. */
export const SAFE_MESSAGE: Readonly<Record<ComputeErrorCode, string>> = {
  AUTH_REQUIRED:        "Please sign in and try again.",
  PLAN_REQUIRED:        "Your plan does not include this service yet.",
  INSUFFICIENT_VX:      "You do not have enough VX for this request.",
  RATE_LIMITED:         "You have reached today's limit for this service. Try again tomorrow.",
  PAYLOAD_TOO_LARGE:    "That file is too large for this service.",
  INVALID_INPUT:        "That request could not be read. Please check it and try again.",
  PROVIDER_DISABLED:    "This service is temporarily unavailable.",
  PROVIDER_UNAVAILABLE: "This service is busy right now. Please try again shortly.",
  PROVIDER_TIMEOUT:     "That took longer than expected and was stopped. Nothing was charged.",
  PROVIDER_FAILED:      "That could not be completed. Nothing was charged.",
  JOB_NOT_FOUND:        "That request could not be found.",
  JOB_EXPIRED:          "That result is no longer available.",
  OUTPUT_INVALID:       "That finished but the result could not be read. Nothing was charged.",
  NOT_CONFIGURED:       "This service is not available yet.",
};

/**
 * A failure a person may read.
 *
 * Takes the code and nothing else on purpose: a provider's own message can
 * carry an endpoint id, a model name, a bucket path or a quota figure, and the
 * one place those must never arrive is a user's screen. The provider's text
 * belongs in `metadata`, which is admin-read.
 */
export function safeFailure(code: ComputeErrorCode): ComputeError {
  return computeError(code, SAFE_MESSAGE[code]);
}

// ── The adapter contract ───────────────────────────────────────────────────

/**
 * The operations a compute provider may offer.
 *
 * Only the ones Visionex actually has. `generateImage` exists because
 * `image-generate` does; there is no `trainModel` because nothing trains one.
 * A capability string on a `ph_providers` row is matched against these, which
 * is how the router knows a provider can serve a request before choosing it.
 */
export type ComputeOperation =
  | "generateImage"
  | "generateVideo"
  | "generateSpeech"
  | "transcribe"
  | "ocr"
  | "convertMedia";

export interface ComputeRequest {
  operation: ComputeOperation;
  /** The worker's input. Shape is the operation's business, not this file's. */
  input: Record<string, unknown>;
  /**
   * Visionex's own idempotency key — the reservation id, not the vendor's job
   * id. A provider handle cannot be the control: it does not exist until after
   * the call that a duplicate would repeat.
   */
  idempotencyKey: string;
  /** Hard ceiling for the whole operation. */
  timeoutMs: number;
}

/**
 * What every compute adapter implements.
 *
 * `submit` may return a job in any state: a fast operation can come back
 * already `completed`, a slow one `queued`. The caller polls with `poll` only
 * when it is not terminal, which is what keeps a short job from paying for a
 * polling loop it never needed.
 */
export interface ComputeAdapter {
  readonly slug: string;
  submit(request: ComputeRequest): Promise<ComputeJob>;
  poll(providerJobId: string): Promise<ComputeJob>;
  cancel(providerJobId: string): Promise<ComputeJob>;
  /** Cheap liveness check for the admin screen and the kill switch. */
  health(): Promise<{ healthy: boolean; detail: string }>;
}
