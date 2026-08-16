// Phase 8, PR C1 — the publishing contract, with no implementation of it.
//
// Nothing in this directory contacts a platform: no fetch, no URL, no
// credential, no environment read, no platform SDK. What lives here is the
// shape a real adapter will have to satisfy in PR C2, and the ports the runner
// drives the database through.

/**
 * The platforms with an external identity. website/newsletter publish
 * themselves and are absent here for that reason, not by oversight.
 *
 * Kept byte-for-byte in step with the CHECK in
 * 20260909000000_social_platform_vocabulary.sql — a value this union accepts
 * and the database refuses would fail at INSERT, after the code that built it
 * had every reason to believe it was valid.
 */
export type Platform =
  | "facebook"
  | "instagram"
  | "threads"
  | "tiktok"
  | "youtube"
  | "x"
  | "linkedin";

export const PLATFORMS: readonly Platform[] = [
  "facebook",
  "instagram",
  "threads",
  "tiktok",
  "youtube",
  "x",
  "linkedin",
];

/**
 * The account fields claim_due_content_slot() returns. `apiKeyRef` is the NAME
 * of an Edge Function secret, never its value — the database constrains it to
 * an environment-variable identifier and has no access to the secret itself.
 */
export interface PublishAccount {
  id: string;
  handle: string;
  externalAccountId: string | null;
  capabilities: string[];
  apiKeyRef: string | null;
  baseUrl: string | null;
  config: Record<string, unknown>;
}

/** One claimed attempt, exactly as the claim RPC describes it. */
export interface PublishRequest {
  publicationId: string;
  calendarId: string;
  proposalRef: string;
  platform: Platform;
  contentType: string;
  language: string;
  hook: string;
  body: string;
  hashtags: string[];
  attempt: number;
  maxAttempts: number;
  account: PublishAccount;
}

/**
 * What an adapter is allowed to report.
 *
 * `rejected` versus `unknown` is about evidence rather than blame: `rejected`
 * means the platform answered, `unknown` means it did not. Once an attempt has
 * dispatched the database parks both — see the migration — but the codes stay
 * separate because a human reviewing a parked slot needs to know which happened.
 */
export type AdapterOutcome =
  | { readonly status: "published"; readonly externalPostId: string; readonly externalUrl?: string }
  | { readonly status: "rejected"; readonly errorCode: string; readonly errorMessage?: string }
  | { readonly status: "unknown"; readonly errorCode: string; readonly errorMessage?: string };

/**
 * Whether this adapter could publish at all, answered without contacting
 * anything. The runner asks first, so an unconfigured platform costs no
 * dispatch marker and therefore never parks a slot.
 *
 * A flag with optional detail rather than a discriminated union: this project
 * compiles with `strict: false` and `strictNullChecks: false`, under which
 * boolean-discriminant narrowing does not hold, and the same shape is what
 * RpcResult below already uses.
 */
export interface AdapterReadiness {
  readonly ready: boolean;
  /** Present when `ready` is false. */
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface PublishAdapter {
  readonly platform: Platform;
  /** A stable identifier for logs and tests. Never a credential. */
  readonly name: string;
  readiness(request: PublishRequest): AdapterReadiness;
  /**
   * Called at most once per attempt, and only after the intent marker has been
   * committed. An adapter must not retry internally: a retry inside here is a
   * second external call the database has no marker for.
   */
  publish(request: PublishRequest): Promise<AdapterOutcome>;
}

// ── Ports ────────────────────────────────────────────────────────────────────
//
// One method per database function, named after it. The runner knows nothing
// about Supabase, PostgREST or HTTP; in PR C2 a port implementation will be a
// thin wrapper over three `.rpc()` calls.

export interface ClaimResult {
  readonly ok: boolean;
  /** Present when `ok` is true. */
  readonly request?: PublishRequest;
  /** Present when `ok` is false. `no_due_slot` means the queue was empty. */
  readonly error?: string;
}

export interface RpcResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly state?: string;
}

export interface RecordInput {
  readonly publicationId: string;
  readonly success: boolean;
  readonly externalPostId?: string;
  readonly externalUrl?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface PublishingPorts {
  /** claim_due_content_slot(_platform, _max_attempts) */
  claimSlot(platform: Platform | null): Promise<ClaimResult>;
  /** mark_publication_dispatched(_publication_id) — the intent marker. */
  markDispatched(publicationId: string): Promise<RpcResult>;
  /** record_content_publication(...) */
  recordResult(input: RecordInput): Promise<RpcResult>;
}

// ── What one attempt did ─────────────────────────────────────────────────────
//
// Every terminal value is named, because "did this publish" must never be
// inferred from the absence of an error. `ok` is true for exactly one status.

export type AttemptStatus =
  /** Nothing was due. Not an error. */
  | "idle"
  /** The claim itself failed or was refused. Nothing was dispatched. */
  | "claim_failed"
  /** No adapter is wired for this platform, or it is not configured. Nothing was dispatched. */
  | "not_configured"
  /** The intent marker was refused, so the platform was deliberately not called. */
  | "dispatch_refused"
  /** Published, and the result was recorded. */
  | "published"
  /** The platform answered with a refusal, after dispatch. Parked. */
  | "rejected"
  /** No answer from the platform, after dispatch. Outcome unknown. Parked. */
  | "ambiguous"
  /** The platform answered but the result could not be written. Parked by the reaper. */
  | "record_failed";

export interface AttemptReport {
  readonly status: AttemptStatus;
  /** True for "published" and nothing else. */
  readonly ok: boolean;
  /** True once mark_publication_dispatched() has committed for this attempt. */
  readonly dispatched: boolean;
  readonly publicationId?: string;
  readonly calendarId?: string;
  readonly platform?: Platform;
  readonly attempt?: number;
  readonly externalPostId?: string;
  readonly errorCode?: string;
  /** Set when the slot needs manual review before any further attempt. */
  readonly needsManualReview?: boolean;
}
