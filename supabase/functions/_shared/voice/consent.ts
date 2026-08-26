// The rules about cloning somebody's voice, with nothing else attached.
//
// Cloning is the one operation in this system that produces a lasting copy of a
// real person. Everything here exists so that three questions always have an
// answer: did they agree, is that agreement still standing, and when the answer
// became no, was the copy actually destroyed.
//
// Pure — no `Deno`, no fetch, no database client. The database enforces the same
// rules in `voice_state` (migration 20260929000000); this is the same policy
// stated where the edge function can act on it before spending anything, and
// where a test can exercise every transition without a Postgres.

/** The single vocabulary. Mirrors the generated `voice_state` column exactly. */
export type VoiceState =
  | "pending_consent"
  | "ready"
  | "revoked"
  | "deleting"
  | "deleted"
  | "error";

export type ConsentStatus = "pending" | "granted" | "revoked";
export type LifecycleState = "active" | "deleting" | "deleted" | "error";

/**
 * The wording somebody agrees to, kept verbatim on the row.
 *
 * Versioned in the text itself. When it changes, existing records still say
 * what was actually agreed to rather than what the current wording happens to
 * be — which is the only reason to store a statement rather than a boolean.
 */
export const CONSENT_STATEMENT_V1 =
  "v1: I confirm the recordings are of my own voice, or that I have the " +
  "documented permission of the person speaking, and I consent to a synthetic " +
  "copy of that voice being created and used on my Visionex account. I " +
  "understand I can withdraw this at any time, and that withdrawing deletes " +
  "the synthetic voice and the recordings.";

/** How long uploaded recordings are kept once a profile exists. */
export const SAMPLE_RETENTION_DAYS = 90;

export const sampleRetentionFrom = (now: Date): Date =>
  new Date(now.getTime() + SAMPLE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

export interface VoiceProfileFacts {
  status: string;
  consentStatus: string;
  lifecycleState: string;
  providerVoiceId: string | null;
}

/**
 * The same derivation the database performs, in TypeScript.
 *
 * Duplicated deliberately and in exactly one direction: the column is
 * authoritative, and this exists so the edge function can refuse before it
 * spends money rather than after. The test suite pins the two together.
 */
export function voiceStateOf(facts: VoiceProfileFacts): VoiceState {
  if (facts.lifecycleState === "deleted") return "deleted";
  if (facts.lifecycleState === "deleting") return "deleting";
  if (facts.lifecycleState === "error") return "error";
  if (facts.consentStatus === "revoked") return "revoked";
  if (facts.consentStatus !== "granted") return "pending_consent";
  if (facts.status === "completed" && facts.providerVoiceId) return "ready";
  if (facts.status === "failed") return "error";
  return "pending_consent";
}

/** Whether this voice may be spoken with. The only question callers should ask. */
export const isUsableVoice = (facts: VoiceProfileFacts): boolean =>
  voiceStateOf(facts) === "ready";

/**
 * Whether cloning may start.
 *
 * Consent is checked here rather than only in the UI because the UI is not the
 * boundary: this function is what stands between a request and a permanent copy
 * of somebody's voice at a third party.
 */
export type CloneRefusal =
  | "consent_missing"
  | "consent_revoked"
  | "already_deleted"
  | "no_samples";

/**
 * Allowed, or refused with a reason.
 *
 * Discriminated on a string rather than a boolean: `tsconfig.app.json` sets
 * `strict: false`, and TypeScript does not narrow a union on a boolean literal
 * under it, so `if (!gate.ok) … gate.refusal` would not compile. `TtsResult`
 * and `VoiceAccessResult` are shaped this way for the same reason.
 */
export type CloneGate =
  | { gate: "allowed" }
  | { gate: "refused"; refusal: CloneRefusal };

export function mayStartCloning(input: {
  consentStatus: string;
  lifecycleState: string;
  sampleCount: number;
}): CloneGate {
  if (input.lifecycleState !== "active") return { gate: "refused", refusal: "already_deleted" };
  if (input.consentStatus === "revoked") return { gate: "refused", refusal: "consent_revoked" };
  if (input.consentStatus !== "granted") return { gate: "refused", refusal: "consent_missing" };
  if (!input.sampleCount) return { gate: "refused", refusal: "no_samples" };
  return { gate: "allowed" };
}

// ── Deletion, and telling the truth about it ────────────────────────────────

/**
 * What happened when we asked the provider to destroy the voice.
 *
 * Three outcomes, not two. `"absent"` is separate from `"deleted"` because a
 * voice that was never created and a voice that was destroyed are different
 * facts, and only one of them means an API call succeeded — but both mean
 * nothing of the person is left at the provider, which is what the caller
 * actually needs to know.
 */
export type ProviderDeletion =
  | { outcome: "deleted" }
  | { outcome: "absent" }
  | { outcome: "failed"; reason: string };

/**
 * Whether the whole deletion may be reported as done.
 *
 * A deletion is complete only when both halves are: the copy at the provider
 * and the recordings in storage. Reporting success while either survives is the
 * specific failure this phase exists to prevent, so the rule is written once,
 * here, rather than at each call site.
 */
export type DeletionOutcome =
  | { deletion: "complete" }
  | { deletion: "incomplete"; lifecycleState: "error"; reason: string };

export function deletionOutcome(input: {
  provider: ProviderDeletion;
  samplesRemoved: boolean;
}): DeletionOutcome {
  if (input.provider.outcome === "failed") {
    return {
      deletion: "incomplete",
      lifecycleState: "error",
      reason: `provider: ${input.provider.reason}`,
    };
  }
  if (!input.samplesRemoved) {
    return {
      deletion: "incomplete",
      lifecycleState: "error",
      reason: "samples: storage objects were not confirmed removed",
    };
  }
  return { deletion: "complete" };
}

/**
 * A provider error, reduced to something safe to store and read back.
 *
 * Truncated, stripped of anything resembling a key, and never the raw body: the
 * column it lands in is read by operators and this repository's logs are public.
 */
export function safeProviderReason(input: unknown): string {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof Error
        ? input.message
        : "unknown provider error";
  return raw
    // Anything that looks like a credential goes, whatever it is attached to.
    .replace(/(xi-api-key|api[_-]?key|authorization|bearer)\s*[:=]?\s*\S+/gi, "$1 [redacted]")
    .replace(/\b(sk|xi|el)[-_][A-Za-z0-9_-]{8,}/g, "[redacted]")
    // A URL can carry a token in its query string.
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
