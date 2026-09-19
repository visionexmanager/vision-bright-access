// Reserve, run, settle — as one function, with the work handed to it.
//
// Every surface bills the same way or none of them do. The alternative is what
// the repository has today: `billing_consume` in one place, `spend_vx` inside
// `charge_file_conversion` in another, a per-day count for WhatsApp in a third,
// and each one deciding its own prices. `meter()` is the single path, and the
// thing it meters arrives as an argument — the same seam `whatsappAsk.ts`
// already uses for the model, and for the same reason: a test drives it with a
// function of its own rather than reading the source and hoping.
//
// This module deliberately knows nothing about RunPod, OpenAI, Hetzner or any
// other executor. `run` is a promise. When a GPU provider is added later it
// becomes a different `run`, and nothing here changes.

import type { ReserveResult, ServiceId, SettleResult, UsageSource } from "./types.ts";

/** The database calls this needs. A test passes two functions instead. */
export interface MeterPorts {
  reserve(args: {
    userId: string;
    serviceId: ServiceId;
    source: UsageSource;
    idempotencyKey?: string | null;
    units?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ReserveResult>;
  settle(args: {
    reservationId: string;
    consumedVx?: number | null;
    executionTimeMs?: number | null;
    provider?: string | null;
    actualCostUsd?: number | null;
  }): Promise<SettleResult>;
  release(args: {
    reservationId: string;
    reason: string;
    status?: "failed" | "expired";
  }): Promise<SettleResult>;
}

/** What the metered work reports back about itself. */
export interface Outcome<T> {
  value: T;
  /**
   * What it actually cost, in VX. Omitted means "it cost what was held" —
   * which is the honest answer for anything whose price does not vary.
   *
   * Never larger than the reservation: `vx_settle` clamps, and the table has a
   * CHECK behind it. A caller cannot charge more than the person agreed to.
   */
  consumedVx?: number;
  /** The vendor that served it. Recorded, never shown to the user. */
  provider?: string;
  /** Internal cost in USD, for the admin view. Never shown to the user. */
  actualCostUsd?: number;
}

export type MeterResult<T> =
  | { ok: true; value: T; reservationId: string; reservedVx: number; consumedVx: number; refundedVx: number }
  | { ok: false; reason: string; detail?: Record<string, unknown> };

export interface MeterRequest<T> {
  userId: string;
  serviceId: ServiceId;
  source: UsageSource;
  /**
   * The duplicate guard. Two submits carrying the same key reserve once.
   *
   * Strongly recommended for anything a person can double-tap or a platform
   * can redeliver — a WhatsApp message id is a natural one, and the webhook
   * already dedupes on it.
   */
  idempotencyKey?: string | null;
  units?: number;
  metadata?: Record<string, unknown>;
  run: () => Promise<Outcome<T>>;
}

/**
 * Hold the VX, do the work, then settle up.
 *
 * Three guarantees, and they are the reason this exists rather than three
 * copies of the same six lines:
 *
 *  1. Nothing runs before the hold succeeds. A refusal costs no provider call.
 *  2. A thrown error returns the whole hold. The failure path is not something
 *     each caller has to remember; forgetting it is how a crashed job keeps
 *     somebody's VX, which is exactly what `refund_stale_file_conversions`
 *     exists to clean up after.
 *  3. A settlement failure never turns a completed job into a failed one. The
 *     work succeeded; the accounting is behind, and the scheduled reaper is
 *     what reconciles it.
 */
export async function meter<T>(
  ports: MeterPorts,
  request: MeterRequest<T>,
): Promise<MeterResult<T>> {
  const held = await ports.reserve({
    userId: request.userId,
    serviceId: request.serviceId,
    source: request.source,
    idempotencyKey: request.idempotencyKey ?? null,
    units: request.units ?? 1,
    metadata: request.metadata ?? {},
  });

  // `held.ok === false` rather than `!held.ok`: the app's TypeScript project
  // and Deno's disagree about narrowing a union through a negated discriminant,
  // and this file is compiled by both.
  if (held.ok === false) {
    const { ok: _ok, error, ...detail } = held;
    return { ok: false, reason: error, detail: detail as Record<string, unknown> };
  }

  // A replayed reservation that has already been settled is a duplicate of
  // finished work. Running it again would charge nothing and do the work twice,
  // which for a publish or a payment is the expensive kind of nothing.
  if (held.replayed && held.status && held.status !== "reserved") {
    return { ok: false, reason: "already_completed", detail: { reservation_id: held.reservation_id } };
  }

  const startedAt = Date.now();
  let outcome: Outcome<T>;
  try {
    outcome = await request.run();
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 200) : "run_failed";
    await ports.release({ reservationId: held.reservation_id, reason, status: "failed" })
      // Reported, never rethrown: the caller's problem is the failure it
      // already has, and the reaper returns the hold if this did not.
      .catch(() => {});
    return { ok: false, reason: "execution_failed", detail: { message: reason } };
  }

  const settled = await ports.settle({
    reservationId: held.reservation_id,
    consumedVx: outcome.consumedVx ?? null,
    executionTimeMs: Date.now() - startedAt,
    provider: outcome.provider ?? null,
    actualCostUsd: outcome.actualCostUsd ?? null,
  }).catch((): SettleResult => ({ ok: false, error: "settle_failed" }));

  return {
    ok: true,
    value: outcome.value,
    reservationId: held.reservation_id,
    reservedVx: held.reserved_vx,
    // When settling failed the hold still stands, so what the person has paid
    // so far is the whole reservation. Saying it cost zero would be a lie the
    // balance disagrees with.
    consumedVx: settled.ok ? (settled.consumed_vx ?? held.reserved_vx) : held.reserved_vx,
    refundedVx: settled.ok ? (settled.refunded_vx ?? 0) : 0,
  };
}

/**
 * The ports, against a Supabase service-role client.
 *
 * Kept apart from `meter()` so the logic above can be driven by a test with no
 * database at all — the same split as `whatsappAsk.ts` and
 * `whatsappAskProvider.ts`.
 */
// deno-lint-ignore no-explicit-any
export function databasePorts(db: any): MeterPorts {
  return {
    async reserve(args) {
      const { data, error } = await db.rpc("vx_reserve", {
        _user_id: args.userId,
        _service_id: args.serviceId,
        _source: args.source,
        _idempotency_key: args.idempotencyKey ?? null,
        _units: args.units ?? 1,
        _metadata: args.metadata ?? {},
      });
      // A database fault is a refusal, never an allowance. The opposite — "the
      // billing table was unreachable, so have it free" — is how a metering
      // fault becomes a bill.
      if (error) {
        console.error("[vx] reserve failed:", error.message);
        return { ok: false, error: "unknown_service" };
      }
      return data as ReserveResult;
    },
    async settle(args) {
      const { data, error } = await db.rpc("vx_settle", {
        _reservation_id: args.reservationId,
        _consumed_vx: args.consumedVx ?? null,
        _execution_time_ms: args.executionTimeMs ?? null,
        _provider: args.provider ?? null,
        _actual_cost_usd: args.actualCostUsd ?? null,
      });
      if (error) {
        console.error("[vx] settle failed:", error.message);
        return { ok: false, error: "settle_failed" };
      }
      return data as SettleResult;
    },
    async release(args) {
      const { data, error } = await db.rpc("vx_release", {
        _reservation_id: args.reservationId,
        _reason: args.reason,
        _status: args.status ?? "failed",
      });
      if (error) {
        console.error("[vx] release failed:", error.message);
        return { ok: false, error: "release_failed" };
      }
      return data as SettleResult;
    },
  };
}
