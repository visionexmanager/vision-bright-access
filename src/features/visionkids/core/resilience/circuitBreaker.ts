/**
 * VisionKids resilience — circuit breaker.
 *
 * Wraps a flaky dependency (an AI provider, a recommendations service, an
 * external API) so that once it has failed repeatedly we stop hammering it for
 * a cool-down window and fail fast instead. Combined with `withFallback`
 * (see degradation.ts) this is how an optional service degrades gracefully
 * without dragging the core experience down — Phase 19 spec item 11.
 *
 * States:
 *   - closed    → calls pass through; failures are counted.
 *   - open      → calls fail fast with CircuitOpenError until resetTimeoutMs.
 *   - half-open → a single trial call is allowed; success closes, failure re-opens.
 *
 * The clock is injectable (`now`) so state transitions are unit-testable.
 */

export type CircuitState = "closed" | "open" | "half-open";

export class CircuitOpenError extends Error {
  constructor(label: string) {
    super(`Circuit "${label}" is open`);
    this.name = "CircuitOpenError";
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens. Default 5. */
  failureThreshold?: number;
  /** Cool-down in ms before a half-open trial is allowed. Default 30_000. */
  resetTimeoutMs?: number;
  /** Label used in errors + telemetry. */
  label?: string;
  /** Notified on every state transition. */
  onStateChange?: (state: CircuitState, label: string) => void;
  /** Injectable clock (tests). Default Date.now. */
  now?: () => number;
}

export interface CircuitBreaker {
  exec<T>(fn: () => Promise<T>): Promise<T>;
  readonly state: CircuitState;
  reset(): void;
}

export function createCircuitBreaker(opts: CircuitBreakerOptions = {}): CircuitBreaker {
  const { failureThreshold = 5, resetTimeoutMs = 30_000, label = "circuit", onStateChange, now = Date.now } = opts;

  let state: CircuitState = "closed";
  let failures = 0;
  let openedAt = 0;

  const transition = (next: CircuitState) => {
    if (state === next) return;
    state = next;
    onStateChange?.(next, label);
  };

  const onSuccess = () => {
    failures = 0;
    transition("closed");
  };

  const onFailure = () => {
    failures += 1;
    if (state === "half-open" || failures >= failureThreshold) {
      openedAt = now();
      transition("open");
    }
  };

  return {
    get state() {
      return state;
    },
    reset() {
      failures = 0;
      openedAt = 0;
      transition("closed");
    },
    async exec<T>(fn: () => Promise<T>): Promise<T> {
      if (state === "open") {
        if (now() - openedAt >= resetTimeoutMs) transition("half-open");
        else throw new CircuitOpenError(label);
      }
      try {
        const result = await fn();
        onSuccess();
        return result;
      } catch (error) {
        onFailure();
        throw error;
      }
    },
  };
}
