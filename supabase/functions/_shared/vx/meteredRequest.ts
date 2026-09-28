// Reserve → run → settle for a request billed by what its provider calls used.
//
// The sibling of meter.ts. meter() charges a fixed price per unit and refuses
// a disabled service; this charges the provider cost the calls actually
// recorded (ai_usage_events), converted by vx_conversion_policy, and — the
// difference that matters today — runs a disabled or fixed-price service in
// SHADOW: exactly as it runs now, nothing held, nothing charged. Every service
// is disabled, so wiring this in changes nothing until the owner turns one on.
//
//   worst case (the caller, from the price book: metering.ts worstCaseCostUsd)
//   → vx_reserve_metered   hold it; refused before any provider call when the
//                          balance, a ceiling or the service's cap says no
//   → run(reservationId)   the caller passes the id to its provider calls
//                          (aiProvider `reservationId`, meteredFetch `ctx`), so
//                          each call's event carries it
//   → wait for the events  their writes are tracked per reservation
//   → vx_settle_metered    billable cost → VX, clamped to the hold; nothing
//                          billable releases it in full
//
// Guarantees:
//  1. Nothing runs before the hold. A refusal costs no provider call.
//  2. One request, one hold, one settlement: the key is required, a replay of
//     finished work is refused as a duplicate, and one still in flight is
//     refused too — never run twice.
//  3. A failure still settles from the events: calls that failed with nothing
//     billable release the hold; the policy decides about the rest.
//  4. Accounting never breaks a request. If settling fails, the answer stands
//     and the reaper returns the hold.
//  5. A stream settles when it ends, not when it starts.

import type { ReserveResult, SettleResult, UsageSource } from "./types.ts";

/** The database calls this needs. A test passes functions instead. */
export interface MeteredPorts {
  reserve(args: {
    userId: string;
    serviceId: string;
    source: UsageSource;
    idempotencyKey: string;
    maxCostUsd: number;
    metadata?: Record<string, unknown>;
  }): Promise<ReserveResult>;
  settle(reservationId: string): Promise<SettleResult>;
  /** Resolves once every usage event written for the reservation is stored (usageSink.ts). */
  writesSettled(reservationId: string): Promise<void>;
  /** Hand work that outlives the response to the runtime (usageSink.ts inBackground). */
  background(work: Promise<unknown>): void;
}

export interface MeteredRequest {
  userId: string;
  serviceId: string;
  source: UsageSource;
  /** Required. A WhatsApp message id, or a client request id: one per user action. */
  idempotencyKey: string;
  /** The request's worst-case provider cost (metering.ts worstCaseCostUsd). */
  maxCostUsd: number;
  metadata?: Record<string, unknown>;
}

/** What the work returns. `done` (a stream's end) defers settlement until it resolves. */
export interface MeteredRun<T> {
  value: T;
  done?: Promise<unknown>;
}

export type MeteredResult<T> =
  /** Not a metered service (disabled, or priced per unit): it ran as before, nothing held. */
  | { status: "shadow"; value: T }
  | { status: "settled"; value: T; reservationId: string; settlement: SettleResult }
  /** A stream: settlement runs when it ends. */
  | { status: "settling"; value: T; reservationId: string }
  /** Refused before anything ran. */
  | { status: "refused"; reason: string; detail?: Record<string, unknown> }
  /** The same key again: nothing ran, nothing was held. */
  | { status: "duplicate"; reservationId: string; state: string };

/** The refusals that mean "this service is not metered": run it exactly as today. */
const SHADOW_REASONS = new Set(["service_disabled", "service_not_metered", "unknown_service"]);

export async function meteredRequest<T>(
  ports: MeteredPorts,
  request: MeteredRequest,
  run: (reservationId: string | null) => Promise<MeteredRun<T>>,
): Promise<MeteredResult<T>> {
  const held = await ports.reserve({
    userId: request.userId,
    serviceId: request.serviceId,
    source: request.source,
    idempotencyKey: request.idempotencyKey,
    maxCostUsd: request.maxCostUsd,
    metadata: request.metadata ?? {},
  });

  if (held.ok === false) {
    if (SHADOW_REASONS.has(held.error)) {
      const { value, done } = await run(null);
      if (done) ports.background(done);
      return { status: "shadow", value };
    }
    const { ok: _ok, error, ...detail } = held;
    return { status: "refused", reason: error, detail: detail as Record<string, unknown> };
  }

  const reservationId = held.reservation_id;
  if (held.replayed) {
    // Finished or still running: either way this is a second submit of one
    // action, and running it again would be a second provider bill.
    return { status: "duplicate", reservationId, state: held.status ?? "reserved" };
  }

  const settle = async (): Promise<SettleResult> => {
    await ports.writesSettled(reservationId);
    return ports.settle(reservationId).catch((): SettleResult => ({ ok: false }));
  };

  let outcome: MeteredRun<T>;
  try {
    outcome = await run(reservationId);
  } catch (error) {
    // Settle, not release: an attempt that failed after using billable tokens
    // is the policy's to bill or not; with nothing billable this releases.
    await settle().catch(() => undefined);
    throw error;
  }

  if (outcome.done) {
    const done = outcome.done;
    ports.background((async () => {
      await done.catch(() => undefined);
      await settle();
    })());
    return { status: "settling", value: outcome.value, reservationId };
  }

  const settlement = await settle();
  return { status: "settled", value: outcome.value, reservationId, settlement };
}

/**
 * The targets a CHARGED request may use: those `ai_model_readiness` reports
 * production-ready (priced, usage reported, a recent passing live check).
 * An unreadable readiness view leaves none — fail closed — and the caller
 * refuses rather than bill a model nobody has proven. Never used in shadow:
 * today's routing is not touched.
 */
export function readyTargets<T extends { provider: string; model: string }>(
  targets: readonly T[],
  readiness: ReadonlyArray<{ provider: string; model_id: string; production_ready: boolean }> | null,
): T[] {
  if (!readiness) return [];
  const ready = new Set(readiness.filter((r) => r.production_ready === true).map((r) => `${r.provider}/${r.model_id}`));
  return targets.filter((t) => ready.has(`${t.provider}/${t.model}`));
}
