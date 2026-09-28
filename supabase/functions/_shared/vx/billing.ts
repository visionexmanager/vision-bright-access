// One entry for billing an AI request, whatever its service is set to.
//
//   central_pricing_registry says   the request
//   ─────────────────────────────   ─────────────────────────────────────────
//   disabled (every service today)  runs exactly as it does now — SHADOW
//   enabled, pricing_mode fixed     meter(): vx_price per unit (vx_reserve)
//   enabled, pricing_mode metered   meteredRequest(): its worst case held,
//                                   then settled from what its calls used;
//                                   only production-ready models may run
//
// So an Edge Function wired through here changes behaviour only when the owner
// enables its service. Turning a service on is configuration, not code.
//
// The service's mode is read from the registry and cached per isolate for a
// minute, so a disabled service costs no reservation call and no latency. If
// the registry cannot be read and nothing is cached, the request runs in
// shadow: every service is disabled today, and a metering fault must not take
// the product offline. Once a service is enabled, a failed reservation is a
// refusal, never a free run (reserve_failed).

import { inBackground, reservationWritesSettled } from "../usageSink.ts";
import { worstCaseCostUsd, type NormalizedUsage } from "../metering.ts";
import { priceBook, type UsageDb } from "../usageRecording.ts";
import { databasePorts, meter } from "./meter.ts";
import { type MeteredPorts, meteredRequest, type MeteredResult, type MeteredRun, readyTargets } from "./meteredRequest.ts";
import type { ReserveResult, SettleResult, UsageSource } from "./types.ts";

/** A service-role client: reads two tables and one view, calls four RPCs. */
export interface BillingDb extends UsageDb {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

type Target = { provider: string; model: string };

export interface BilledRequest<T extends Target = Target> {
  serviceId: string;
  /** No user (a guest): always shadow — there is no balance to bill. */
  userId: string | null;
  source: UsageSource;
  idempotencyKey: string;
  /** Metered services only: the chain the request may use, and its usage bound. */
  targets?: readonly T[];
  bound?: NormalizedUsage;
  units?: number;
  metadata?: Record<string, unknown>;
}

/** What the work is given: the hold to bill against, and — when metered — the ready targets only. */
export interface BillingContext<T extends Target = Target> {
  reservationId: string | null;
  targets: T[] | null;
}

export type BilledResult<T> =
  | MeteredResult<T>
  | { status: "charged"; value: T; reservationId: string; consumedVx: number };

// ── Cached reads ────────────────────────────────────────────────────────────

export const BILLING_CACHE_TTL_MS = 60_000;
type Mode = { enabled: boolean; pricing_mode: string };
let modes: { at: number; byService: Map<string, Mode> } | null = null;
let readiness: { at: number; rows: Array<{ provider: string; model_id: string; production_ready: boolean }> | null } | null = null;

/** For tests: forget both caches. */
export function resetBillingCaches(): void {
  modes = null;
  readiness = null;
}

async function serviceMode(db: BillingDb, serviceId: string, now: number): Promise<Mode | null> {
  if (!modes || now - modes.at >= BILLING_CACHE_TTL_MS) {
    try {
      const { data, error } = await db.from("central_pricing_registry").select("service_id, enabled, pricing_mode");
      if (!error && Array.isArray(data)) {
        const byService = new Map<string, Mode>();
        for (const r of data as Array<{ service_id?: unknown; enabled?: unknown; pricing_mode?: unknown }>) {
          if (typeof r.service_id === "string") {
            byService.set(r.service_id, { enabled: r.enabled === true, pricing_mode: String(r.pricing_mode ?? "fixed") });
          }
        }
        modes = { at: now, byService };
      }
    } catch {
      // Keep the last good copy, if any.
    }
  }
  return modes?.byService.get(serviceId) ?? null;
}

async function readinessRows(db: BillingDb, now: number) {
  if (!readiness || now - readiness.at >= BILLING_CACHE_TTL_MS) {
    try {
      const { data, error } = await db.from("ai_model_readiness").select("provider, model_id, production_ready");
      readiness = { at: now, rows: !error && Array.isArray(data) ? data as never : null };
    } catch {
      readiness = { at: now, rows: null };
    }
  }
  return readiness.rows;
}

// ── Ports ───────────────────────────────────────────────────────────────────

export function meteredPorts(db: BillingDb): MeteredPorts {
  return {
    async reserve(a) {
      try {
        const { data, error } = await db.rpc("vx_reserve_metered", {
          _user_id: a.userId, _service_id: a.serviceId, _source: a.source,
          _idempotency_key: a.idempotencyKey, _max_cost_usd: a.maxCostUsd, _metadata: a.metadata ?? {},
        });
        if (error) return { ok: false, error: "reserve_failed" };
        return data as ReserveResult;
      } catch {
        return { ok: false, error: "reserve_failed" };
      }
    },
    async settle(reservationId) {
      const { data, error } = await db.rpc("vx_settle_metered", { _reservation_id: reservationId });
      return error ? { ok: false } : data as SettleResult;
    },
    writesSettled: reservationWritesSettled,
    background: inBackground,
  };
}

// ── The entry ───────────────────────────────────────────────────────────────

export async function billedRequest<V, T extends Target = Target>(
  db: BillingDb,
  request: BilledRequest<T>,
  run: (ctx: BillingContext<T>) => Promise<MeteredRun<V>>,
  now: number = Date.now(),
): Promise<BilledResult<V>> {
  const shadow = async (): Promise<BilledResult<V>> => {
    const { value, done } = await run({ reservationId: null, targets: null });
    if (done) inBackground(done);
    return { status: "shadow", value };
  };

  if (!request.userId) return shadow();
  const mode = await serviceMode(db, request.serviceId, now);
  if (!mode || !mode.enabled) return shadow();

  if (mode.pricing_mode === "fixed") {
    let thrown: unknown;
    const result = await meter(databasePorts(db), {
      userId: request.userId,
      serviceId: request.serviceId as never,
      source: request.source,
      idempotencyKey: request.idempotencyKey,
      units: request.units ?? 1,
      metadata: request.metadata ?? {},
      run: async () => {
        try {
          const { value, done } = await run({ reservationId: null, targets: null });
          if (done) inBackground(done);
          return { value };
        } catch (error) {
          thrown = error;
          throw error;
        }
      },
    });
    // `=== false`, not `!result.ok`: the app's TypeScript and Deno disagree
    // about narrowing through a negated discriminant (see meter.ts).
    if (result.ok === false) {
      // meter() has already released the hold; the caller still gets its error.
      if (thrown !== undefined) throw thrown;
      if (result.reason === "already_completed") {
        return { status: "duplicate", reservationId: String(result.detail?.reservation_id ?? ""), state: "settled" };
      }
      return { status: "refused", reason: result.reason, detail: result.detail };
    }
    return { status: "charged", value: result.value, reservationId: result.reservationId, consumedVx: result.consumedVx };
  }

  // Metered: only models proven ready, and a worst case that can be bounded.
  const allowed = readyTargets(request.targets ?? [], await readinessRows(db, now));
  if (allowed.length === 0) return { status: "refused", reason: "no_ready_model" };
  const maxCostUsd = worstCaseCostUsd(await priceBook(db, now), allowed, request.bound ?? {}, new Date(now).toISOString());
  if (maxCostUsd === null) return { status: "refused", reason: "unpriced_model" };

  return meteredRequest(meteredPorts(db), {
    userId: request.userId,
    serviceId: request.serviceId,
    source: request.source,
    idempotencyKey: request.idempotencyKey,
    maxCostUsd,
    metadata: request.metadata,
  }, (reservationId) => run({ reservationId, targets: allowed }));
}

/**
 * The same stream, byte for byte, and a promise that settles when it ends —
 * read to the end, cancelled by its reader, or broken. A metered stream
 * settles on that promise, not when it starts.
 */
export function streamWithEnd(src: ReadableStream<Uint8Array>): { stream: ReadableStream<Uint8Array>; done: Promise<void> } {
  let finish!: () => void;
  const done = new Promise<void>((resolve) => { finish = resolve; });
  const reader = src.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done: ended, value } = await reader.read();
        if (ended) {
          controller.close();
          finish();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        finish();
        controller.error(error);
      }
    },
    cancel(reason) {
      finish();
      return reader.cancel(reason);
    },
  });
  return { stream, done };
}

/**
 * The idempotency key for a website request: the client's `Idempotency-Key`
 * header when it sends a well-formed one (a retry of the same action then
 * reuses its hold), otherwise a fresh key per HTTP request.
 */
export function requestIdempotencyKey(req: Request, functionName: string): string {
  const sent = req.headers.get("Idempotency-Key") ?? "";
  if (/^[A-Za-z0-9_-]{8,120}$/.test(sent)) return `${functionName}:${sent}`;
  return `${functionName}:${crypto.randomUUID()}`;
}

/** The HTTP answer for a request billing refused or found duplicated. */
export function billingRefusalResponse(
  result: Extract<BilledResult<unknown>, { status: "refused" | "duplicate" }>,
  headers: Record<string, string>,
): Response {
  const json = { ...headers, "Content-Type": "application/json" };
  if (result.status === "duplicate") {
    return new Response(JSON.stringify({ error: "This request was already submitted.", code: "duplicate_request" }), { status: 409, headers: json });
  }
  const status = result.reason === "insufficient_vx" ? 402
    : result.reason === "daily_ceiling_reached" || result.reason === "plan_allowance_reached" ? 429
    : 503;
  return new Response(JSON.stringify({ error: "This service is not available for your account right now.", code: result.reason }), { status, headers: json });
}
