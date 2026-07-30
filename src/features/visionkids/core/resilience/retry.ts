/**
 * VisionKids resilience — retry with exponential backoff + dead-letter.
 *
 * Dependency-free and deterministic-testable: the clock (`sleep`) and jitter
 * source (`random`) are injectable so the behaviour can be unit-tested without
 * real timers. Serves Phase 19 spec item 13 (Retry / Exponential Backoff /
 * Dead Letter Queue / Failure Logging).
 *
 * This module never throws away a permanently-failed operation silently: once
 * retries are exhausted the payload is handed to the `deadLetter` sink (with the
 * final error) *before* the error is re-thrown, so the caller and the DLQ both
 * learn about it.
 */

export interface RetryOptions {
  /** Total attempts including the first. Default 3. */
  maxAttempts?: number;
  /** Base delay in ms for the first backoff. Default 300. */
  baseDelayMs?: number;
  /** Upper bound for any single backoff. Default 10_000. */
  maxDelayMs?: number;
  /** Multiplier applied per attempt. Default 2 (exponential). */
  factor?: number;
  /** Full-jitter fraction in [0,1]; 1 = up to ±100% jitter. Default 0.5. */
  jitter?: number;
  /**
   * Decide whether an error is worth retrying. Default: retry everything
   * except an `AbortError` (a deliberate cancellation).
   */
  isRetryable?: (error: unknown) => boolean;
  /** Called once per failed attempt (for logging/telemetry). */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
  /**
   * Called once when all attempts fail, right before the error is re-thrown.
   * Wire this to a durable dead-letter store (e.g. IndexedDB / kids_sync_events).
   */
  deadLetter?: (entry: DeadLetterEntry) => void | Promise<void>;
  /** Abort signal to stop between attempts. */
  signal?: AbortSignal;
  /** Injectable sleep (tests). Default real setTimeout. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Injectable jitter source in [0,1) (tests). Default Math.random. */
  random?: () => number;
  /** Human label used in dead-letter entries + logs. */
  label?: string;
}

export interface DeadLetterEntry {
  label: string;
  attempts: number;
  error: unknown;
  failedAt: number;
}

function defaultRetryable(error: unknown): boolean {
  // A deliberate cancellation is never retried. Checked by `name` rather than
  // `instanceof Error` because a DOMException("AbortError") is not an Error
  // instance in every runtime (e.g. jsdom / Node).
  const name = (error as { name?: string } | null)?.name;
  return name !== "AbortError";
}

function realSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * Pure, testable backoff: `base * factor^(attempt-1)`, capped at `maxDelayMs`,
 * then full-jitter applied so retries from many clients don't thundering-herd.
 * `attempt` is 1-based (the delay *before* attempt N+1).
 */
export function computeBackoff(attempt: number, opts: RetryOptions = {}): number {
  const { baseDelayMs = 300, maxDelayMs = 10_000, factor = 2, jitter = 0.5, random = Math.random } = opts;
  const raw = baseDelayMs * Math.pow(factor, Math.max(0, attempt - 1));
  const capped = Math.min(raw, maxDelayMs);
  const spread = capped * Math.max(0, Math.min(1, jitter));
  // jitter in [-spread/2, +spread/2] keeps the mean at `capped`.
  const delta = (random() - 0.5) * spread;
  return Math.max(0, Math.round(capped + delta));
}

/** Run `fn`, retrying with exponential backoff. Re-throws the last error. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    isRetryable = defaultRetryable,
    onRetry,
    deadLetter,
    signal,
    sleep = realSleep,
    label = "operation",
  } = opts;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < maxAttempts && isRetryable(error);
      if (!canRetry) break;
      const delayMs = computeBackoff(attempt, opts);
      onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs, signal);
    }
  }

  if (deadLetter) {
    await deadLetter({ label, attempts: maxAttempts, error: lastError, failedAt: Date.now() });
  }
  throw lastError;
}
