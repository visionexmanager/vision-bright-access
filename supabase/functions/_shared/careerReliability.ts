// Reliability primitives for Phase 11 Career Center Edge Functions: timeout
// wrapping, retry with backoff, and a per-instance circuit breaker. Generic
// utilities — not wired into the existing Phase 10 AI orchestrator (which
// already has its own fallback/degradation logic); available for new
// dependencies this phase adds, e.g. calling the Stripe API.

export async function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
}

/** Retries `fn` with exponential backoff. Throws the last error if every attempt fails. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
      }
    }
  }
  throw lastError;
}

type BreakerState = "closed" | "open" | "half-open";

/**
 * In-memory circuit breaker scoped to a single Edge Function instance.
 * Deno isolates are short-lived and don't share memory across invocations,
 * so this protects a hot instance from hammering a dead dependency within
 * its own lifetime — it isn't a durable, cross-instance breaker (that would
 * need a shared store). Good enough for "stop retrying a clearly-down
 * third-party API for the next N seconds" without adding infrastructure.
 */
export class CircuitBreaker {
  private failureCount = 0;
  private state: BreakerState = "closed";
  private openedAt = 0;

  constructor(private readonly threshold = 5, private readonly resetMs = 30000) {}

  isOpen(): boolean {
    if (this.state === "open" && Date.now() - this.openedAt > this.resetMs) {
      this.state = "half-open";
    }
    return this.state === "open";
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error("Circuit breaker is open — dependency recently failed repeatedly");
    }
    try {
      const result = await fn();
      this.failureCount = 0;
      this.state = "closed";
      return result;
    } catch (err) {
      this.failureCount++;
      if (this.failureCount >= this.threshold) {
        this.state = "open";
        this.openedAt = Date.now();
      }
      throw err;
    }
  }
}
