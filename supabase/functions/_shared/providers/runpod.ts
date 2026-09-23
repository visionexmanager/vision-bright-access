// RunPod Serverless, speaking Visionex.
//
// Server-only, and structurally so: it reads `RUNPOD_API_KEY` from the Edge
// Function environment, which no browser bundle, no `VITE_*` variable and no
// database row can reach. Nothing in `src/` imports this file, and a test
// asserts that.
//
// ── What this is and is not ────────────────────────────────────────────────
//
// It is an adapter: it turns a `ComputeRequest` into RunPod's dialect and
// RunPod's answer back into a `ComputeJob`. It does not decide who may run a
// job (entitlements do), what it costs (`central_pricing_registry` does),
// whether the caller can afford it (`vx_reserve` does), or whether RunPod is
// the right provider at all (`providerRouter` does). It is the last layer, and
// the least privileged one.
//
// ── The API, verified against the current documentation ────────────────────
//
//   POST https://api.runpod.ai/v2/{endpointId}/run      → async, returns {id, status}
//   POST https://api.runpod.ai/v2/{endpointId}/runsync  → waits for the result
//   GET  https://api.runpod.ai/v2/{endpointId}/status/{jobId}
//   POST https://api.runpod.ai/v2/{endpointId}/cancel/{jobId}
//   GET  https://api.runpod.ai/v2/{endpointId}/health
//
//   Authorization: Bearer <RUNPOD_API_KEY>
//   Body: { "input": { … } }
//   Status: IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED | CANCELLED | TIMED_OUT
//
// Checked against docs.runpod.io rather than carried over from an example:
// `/status` and `/cancel` take the job id as a *path* segment, which an older
// shape did not.
//
// ── Results expire ─────────────────────────────────────────────────────────
//
// RunPod keeps an async result for about 30 minutes and a sync one for about a
// minute. A job whose result has aged out reads as missing, which is why
// `JOB_EXPIRED` exists as a distinct outcome from `JOB_NOT_FOUND`: one means
// we were too slow, the other means it was never ours. They settle differently.

import {
  type ComputeAdapter,
  type ComputeJob,
  type ComputeRequest,
  type ComputeStatus,
  computeError,
  safeFailure,
} from "./compute.ts";

const API_ROOT = "https://api.runpod.ai/v2";

/** RunPod's words for where a job is, mapped to ours. */
const STATUS: Readonly<Record<string, ComputeStatus>> = {
  IN_QUEUE:    "queued",
  IN_PROGRESS: "running",
  COMPLETED:   "completed",
  FAILED:      "failed",
  CANCELLED:   "cancelled",
  TIMED_OUT:   "timed_out",
};

/**
 * An unrecognised status is a failure, not a guess.
 *
 * A new vendor state that this map does not know could mean anything, and the
 * expensive way to be wrong is to read it as `completed` and settle the
 * reservation. Reading it as `failed` releases the hold, which costs revenue
 * and never costs a customer.
 */
function toStatus(raw: unknown): ComputeStatus {
  return (typeof raw === "string" && STATUS[raw]) || "failed";
}

export interface RunPodConfig {
  /** Which Serverless endpoint serves this operation. Internal configuration. */
  endpointId: string;
  apiKey: string;
}

/**
 * Read the key from the environment, once, at call time.
 *
 * Returned rather than thrown so a missing key is `NOT_CONFIGURED` — a state
 * the caller reports and releases from — instead of an exception that a
 * generic catch might turn into `PROVIDER_FAILED` and blame the vendor for.
 */
export function runpodApiKey(): string | null {
  const key = Deno.env.get("RUNPOD_API_KEY");
  return key && key.trim() ? key : null;
}

/** The whole-provider kill switch, independent of any service's `enabled`. */
export function runpodEnabled(): boolean {
  return Deno.env.get("RUNPOD_ENABLED") === "true";
}

/**
 * Everything that must be true before a single request is sent.
 *
 * Checked in one place so the answer cannot differ between operations, and so
 * "off" and "misconfigured" stay distinct: the first is a decision, the second
 * is a fault, and an operator needs to tell them apart.
 */
export function runpodReadiness(endpointId: string | null): { ready: boolean; reason: ComputeJob["error"] } {
  if (!runpodEnabled()) return { ready: false, reason: safeFailure("PROVIDER_DISABLED") };
  if (!runpodApiKey()) return { ready: false, reason: safeFailure("NOT_CONFIGURED") };
  if (!endpointId) return { ready: false, reason: safeFailure("NOT_CONFIGURED") };
  return { ready: true, reason: null };
}

function refused(error: NonNullable<ComputeJob["error"]>): ComputeJob {
  return { providerJobId: null, status: "failed", output: null, metadata: {}, durationMs: null, error };
}

/**
 * One RunPod call, with a hard deadline and nothing sensitive in what comes
 * back out.
 *
 * The Authorization header is built here and never returned, logged or placed
 * in `metadata`. What the caller gets is a status, a parsed body and a
 * duration — enough to decide, and nothing that could end up in a log line.
 */
async function call(
  cfg: RunPodConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; timeoutMs: number },
): Promise<{ ok: boolean; status: number; body: Record<string, unknown>; timedOut: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    const response = await fetch(`${API_ROOT}/${cfg.endpointId}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${cfg.apiKey}`,
        "content-type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    let body: Record<string, unknown> = {};
    try { body = (await response.json()) as Record<string, unknown>; } catch { /* empty or not JSON */ }
    return { ok: response.ok, status: response.status, body, timedOut: false };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return { ok: false, status: 0, body: {}, timedOut: aborted };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * RunPod's answer, as a `ComputeJob`.
 *
 * `metadata` keeps the vendor's own timings and message for the admin screen
 * and the internal log. It is not returned to a user by any path — the ledger
 * row it lands on is admin-read, and `my_vx_usage()` does not select it.
 */
function toJob(body: Record<string, unknown>): ComputeJob {
  const status = toStatus(body.status);
  const executionTime = typeof body.executionTime === "number" ? body.executionTime : null;
  const providerMessage = typeof body.error === "string" ? body.error : null;

  return {
    providerJobId: typeof body.id === "string" ? body.id : null,
    status,
    output: status === "completed" ? (body.output ?? null) : null,
    metadata: {
      provider: "runpod",
      providerStatus: body.status ?? null,
      delayTimeMs: typeof body.delayTime === "number" ? body.delayTime : null,
      executionTimeMs: executionTime,
      // The vendor's own words, kept for an operator. Never shown to a person:
      // `safeFailure` decides what they read.
      providerMessage,
    },
    durationMs: executionTime,
    error: status === "completed" || status === "queued" || status === "running"
      ? null
      : safeFailure(status === "timed_out" ? "PROVIDER_TIMEOUT" : "PROVIDER_FAILED"),
  };
}

/**
 * The adapter.
 *
 * Built per call with the endpoint the router chose, rather than a module-level
 * singleton, because one provider row can serve several endpoints and a
 * long-lived object would have to be told which — at which point it is a
 * parameter pretending to be state.
 */
export function runpodAdapter(cfg: RunPodConfig): ComputeAdapter {
  return {
    slug: "runpod",

    async submit(request: ComputeRequest): Promise<ComputeJob> {
      // Async by default. `/runsync` holds the HTTP connection for the whole
      // GPU job, which is exactly what an Edge Function must not do — the
      // function would be paying to wait, and its own limit would cut the job
      // off mid-execution with the VX already reserved.
      const result = await call(cfg, "/run", {
        method: "POST",
        // RunPod requires the payload under `input`. The idempotency key rides
        // along so a worker can dedupe too, but it is *our* control: the
        // binding decision is made by the unique index on the reservation
        // before this is ever called.
        body: { input: { ...request.input, visionex_request_id: request.idempotencyKey } },
        timeoutMs: request.timeoutMs,
      });

      if (result.timedOut) return refused(safeFailure("PROVIDER_TIMEOUT"));
      if (result.status === 401 || result.status === 403) return refused(safeFailure("NOT_CONFIGURED"));
      if (result.status === 429) return refused(safeFailure("PROVIDER_UNAVAILABLE"));
      if (result.status >= 500 || result.status === 0) return refused(safeFailure("PROVIDER_UNAVAILABLE"));
      if (!result.ok) {
        // A 4xx that is not auth or rate limiting is this request's fault, and
        // retrying it would fail identically.
        return refused(computeError("INVALID_INPUT", safeFailure("INVALID_INPUT").message));
      }
      return toJob(result.body);
    },

    async poll(providerJobId: string): Promise<ComputeJob> {
      const result = await call(cfg, `/status/${encodeURIComponent(providerJobId)}`, {
        method: "GET",
        timeoutMs: 15_000,
      });
      if (result.timedOut) return refused(safeFailure("PROVIDER_TIMEOUT"));
      // A result that has aged out reads as missing. Distinguished from a job
      // that never existed because the accounting differs: an expired result
      // means the work may well have been done, and that is an operator's
      // problem to see rather than a customer's to pay for.
      if (result.status === 404) return refused(safeFailure("JOB_EXPIRED"));
      if (!result.ok) return refused(safeFailure("PROVIDER_UNAVAILABLE"));
      return toJob({ id: providerJobId, ...result.body });
    },

    async cancel(providerJobId: string): Promise<ComputeJob> {
      const result = await call(cfg, `/cancel/${encodeURIComponent(providerJobId)}`, {
        method: "POST",
        timeoutMs: 15_000,
      });
      if (!result.ok && result.status !== 404) return refused(safeFailure("PROVIDER_UNAVAILABLE"));
      return {
        providerJobId,
        status: "cancelled",
        output: null,
        metadata: { provider: "runpod", cancelled: true },
        durationMs: null,
        error: null,
      };
    },

    async health(): Promise<{ healthy: boolean; detail: string }> {
      const result = await call(cfg, "/health", { method: "GET", timeoutMs: 10_000 });
      if (!result.ok) return { healthy: false, detail: `endpoint unhealthy (${result.status})` };
      const workers = result.body.workers as Record<string, unknown> | undefined;
      const ready = typeof workers?.ready === "number" ? workers.ready : 0;
      const idle = typeof workers?.idle === "number" ? workers.idle : 0;
      // Scale-to-zero is the point: zero idle workers is normal, not a fault.
      return { healthy: true, detail: `ready=${ready} idle=${idle}` };
    },
  };
}
