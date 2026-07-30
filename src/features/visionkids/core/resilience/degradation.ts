/**
 * VisionKids resilience — graceful degradation.
 *
 * `withFallback` runs a primary operation and, if it fails, returns a fallback
 * value instead of throwing — so an optional dependency (AI, recommendations,
 * analytics) failing degrades one feature rather than crashing the page.
 * Phase 19 spec item 11. Critical services should NOT use this — let them throw
 * so the error surfaces (see criticality.ts).
 */

export interface FallbackOptions<T> {
  /** Static fallback value, or a function producing one from the error. */
  fallback: T | ((error: unknown) => T);
  /** Label for telemetry. */
  label?: string;
  /** Notified when the primary fails and the fallback is used. */
  onDegraded?: (info: { label: string; error: unknown }) => void;
}

function isFallbackFn<T>(f: FallbackOptions<T>["fallback"]): f is (error: unknown) => T {
  return typeof f === "function";
}

/** Run `primary`; on any rejection, log degradation and resolve with the fallback. */
export async function withFallback<T>(primary: () => Promise<T>, opts: FallbackOptions<T>): Promise<T> {
  const { fallback, label = "optional-service", onDegraded } = opts;
  try {
    return await primary();
  } catch (error) {
    onDegraded?.({ label, error });
    return isFallbackFn(fallback) ? fallback(error) : fallback;
  }
}
