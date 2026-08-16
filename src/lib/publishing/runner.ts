// Phase 8, PR C1 — the runner: one attempt, in a fixed order, exactly once.
//
// This function is the entire publishing protocol. It is deliberately small,
// deliberately linear, and deliberately incapable of retrying: every retry in
// this system is a fresh claim by a later invocation, bounded by the database's
// own ceiling, and permitted only for attempts the database can prove never
// dispatched. A loop in here would be a retry no marker covers.
//
//   1. claim                       — the database picks the slot and counts it
//   2. readiness                   — asked before anything is dispatched
//   3. mark dispatched             — the intent marker, committed first
//   4. publish                     — at most one call, never retried
//   5. record                      — the outcome, whatever it was
//
// Steps 2 and 3 are in that order for the reason the whole phase exists. An
// unconfigured platform must not leave a dispatch marker, because a marked
// attempt can never be retried automatically and would park a slot that was
// never at risk. Steps 3 and 4 are in that order for the opposite reason: if
// the marker is not committed before the call, a crash during the call is
// indistinguishable from a crash before it, and the system would have to guess.
//
// The one case this cannot make safe is a platform with no idempotency key,
// which today is all of them. If the process dies between step 4 and step 5,
// the post may be live and nothing here knows it. That attempt is not retried
// — the marker guarantees the reaper parks it — and a human decides. No
// idempotency guarantee is claimed that the platform does not actually provide.

import type {
  AdapterOutcome,
  AttemptReport,
  Platform,
  PublishAdapter,
  PublishRequest,
  PublishingPorts,
} from "./types";
import { NOT_CONFIGURED } from "./adapters";

/** Returned by the timeout race. Not an outcome — an absence of one. */
const TIMED_OUT = "__publish_timed_out__" as const;
type TimedOut = typeof TIMED_OUT;

export interface RunAttemptOptions {
  /** Restrict the claim to one platform. Null claims the oldest due slot on any. */
  platform?: Platform | null;
  /** How long to wait for the adapter before treating the outcome as unknown. */
  timeoutMs?: number;
  /**
   * Injected so tests are deterministic and do not sleep. Resolving means "the
   * deadline passed"; it is raced against the adapter, never used to cancel it,
   * because a call in flight cannot be un-made.
   */
  timer?: (ms: number) => Promise<void>;
}

const defaultTimer = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run at most one publish attempt.
 *
 * Returns a report rather than throwing: every terminal condition is a named
 * status, so a caller cannot mistake "nothing was due" or "no adapter" for a
 * success by checking only for an absence of errors. `ok` is true for exactly
 * one status, `published`.
 */
export async function runPublishAttempt(
  ports: PublishingPorts,
  adapters: ReadonlyMap<Platform, PublishAdapter>,
  options: RunAttemptOptions = {},
): Promise<AttemptReport> {
  const { platform = null, timeoutMs = 60_000, timer = defaultTimer } = options;

  // ── 1. Claim ──────────────────────────────────────────────────────────────
  const claim = await ports.claimSlot(platform);
  if (!claim.ok || !claim.request) {
    // `no_due_slot` is not the same as an empty calendar. The database refuses
    // to claim a slot whose platform holds no live OAuth grant — that costs the
    // slot no attempt, which is the point, but it also removes it from the
    // queue, so the count comes back with the refusal and is carried here.
    return claim.error === "no_due_slot"
      ? {
          status: "idle",
          ok: false,
          dispatched: false,
          withheldForConnection: claim.withheldForConnection,
          awaitingConnection: claim.awaitingConnection,
        }
      : { status: "claim_failed", ok: false, dispatched: false, errorCode: claim.error ?? "no_request" };
  }

  const request = claim.request;
  const base = {
    publicationId: request.publicationId,
    calendarId: request.calendarId,
    platform: request.platform,
    attempt: request.attempt,
  };

  /** Resolve the attempt as a failure. Used for every non-published path. */
  const fail = async (
    status: AttemptReport["status"],
    errorCode: string,
    dispatched: boolean,
    errorMessage?: string,
  ): Promise<AttemptReport> => {
    try {
      await ports.recordResult({
        publicationId: request.publicationId,
        success: false,
        errorCode,
        errorMessage,
      });
    } catch {
      // The failure could not be written. Nothing further is attempted: if the
      // attempt had dispatched, the reaper will park it, and if it had not, the
      // reaper will return it to the retry budget. Either way the decision
      // belongs to the database, not to a catch block.
      return { ...base, status: "record_failed", ok: false, dispatched, needsManualReview: dispatched, errorCode };
    }
    return { ...base, status, ok: false, dispatched, errorCode, needsManualReview: dispatched };
  };

  // ── 2. Readiness, before anything is dispatched ───────────────────────────
  const adapter = adapters.get(request.platform);
  if (!adapter) {
    return fail("not_configured", NOT_CONFIGURED, false, `No adapter registered for ${request.platform}.`);
  }

  const readiness = adapter.readiness(request);
  if (!readiness.ready) {
    // No marker is written, so this slot stays eligible for the ordinary retry
    // budget and is never parked by a missing integration.
    return fail("not_configured", readiness.errorCode ?? NOT_CONFIGURED, false, readiness.errorMessage);
  }

  // ── 3. The intent marker, committed before the call ───────────────────────
  const marked = await ports.markDispatched(request.publicationId);
  if (!marked.ok) {
    // The platform is deliberately not called. `already_dispatched` means some
    // other invocation is mid-flight or has been — publishing now would be the
    // duplicate this whole design exists to prevent.
    const alreadyDispatched = marked.error === "already_dispatched";
    return fail(
      "dispatch_refused",
      marked.error ?? "dispatch_marker_refused",
      alreadyDispatched,
      "The intent marker was refused; the platform was not called.",
    );
  }

  // ── 4. Exactly one external call ──────────────────────────────────────────
  let outcome: AdapterOutcome | TimedOut;
  try {
    outcome = await Promise.race<AdapterOutcome | TimedOut>([
      adapter.publish(request),
      timer(timeoutMs).then((): TimedOut => TIMED_OUT),
    ]);
  } catch (error) {
    // A thrown adapter says nothing about whether the request reached the
    // platform, so it is unknown rather than rejected, and the database parks
    // it. Treating a throw as a clean failure is how duplicates happen.
    return fail("ambiguous", "adapter_threw", true, error instanceof Error ? error.message : undefined);
  }

  if (outcome === TIMED_OUT) {
    // The call is still in flight. It is not cancelled, because it cannot be.
    return fail("ambiguous", "dispatch_timeout", true, "The adapter did not answer before the deadline.");
  }

  // ── 5. Record, whatever happened ──────────────────────────────────────────
  if (outcome.status === "rejected") {
    return fail("rejected", outcome.errorCode, true, outcome.errorMessage);
  }
  if (outcome.status === "unknown") {
    return fail("ambiguous", outcome.errorCode, true, outcome.errorMessage);
  }

  try {
    const recorded = await ports.recordResult({
      publicationId: request.publicationId,
      success: true,
      externalPostId: outcome.externalPostId,
      externalUrl: outcome.externalUrl,
    });
    if (!recorded.ok) {
      // The post exists and the database refused to record it — a duplicate id,
      // a proposal that moved, a replayed result. Not an error to retry, and
      // certainly not one to republish.
      return {
        ...base,
        status: "record_failed",
        ok: false,
        dispatched: true,
        needsManualReview: true,
        errorCode: recorded.error,
        externalPostId: outcome.externalPostId,
      };
    }
  } catch {
    return {
      ...base,
      status: "record_failed",
      ok: false,
      dispatched: true,
      needsManualReview: true,
      errorCode: "record_threw",
      externalPostId: outcome.externalPostId,
    };
  }

  return {
    ...base,
    status: "published",
    ok: true,
    dispatched: true,
    externalPostId: outcome.externalPostId,
  };
}

/**
 * Drain the queue, one attempt at a time, up to a bounded number.
 *
 * Sequential on purpose. Concurrency between workers is the database's problem
 * and it solves it with SKIP LOCKED; concurrency inside one worker would add a
 * second source of it for no benefit. The loop stops at the first idle result,
 * so it never spins on an empty queue, and it stops at `limit` so one
 * invocation cannot run unbounded.
 */
export async function runPublishBatch(
  ports: PublishingPorts,
  adapters: ReadonlyMap<Platform, PublishAdapter>,
  options: RunAttemptOptions & { limit?: number } = {},
): Promise<AttemptReport[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 10, 100));
  const reports: AttemptReport[] = [];

  for (let i = 0; i < limit; i += 1) {
    const report = await runPublishAttempt(ports, adapters, options);
    if (report.status === "idle") {
      // An empty queue is not worth a report and never was. A queue held back
      // by a disconnected platform is: "nothing happened" and "nothing happened
      // because four posts are waiting on a reconnection" are different
      // operational facts, and only the second one needs a human. Kept as the
      // last element rather than thrown away, then the loop still stops.
      if (report.withheldForConnection > 0) reports.push(report);
      break;
    }
    reports.push(report);
    // A claim that failed for any reason other than "nothing due" means the
    // queue is not answering normally. Stopping is better than hammering it.
    if (report.status === "claim_failed") break;
  }

  return reports;
}

export type { PublishRequest };
