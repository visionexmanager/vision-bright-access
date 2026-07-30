/**
 * VisionKids resilience layer (Phase 19).
 *
 * Small, dependency-free primitives for production robustness:
 *   - withRetry / computeBackoff  — retry with exponential backoff + dead-letter
 *   - createCircuitBreaker        — fail fast on a repeatedly-failing dependency
 *   - withFallback                — graceful degradation for optional services
 *   - SERVICE_CRITICALITY         — which dependencies are load-bearing
 *
 * Usage pattern for an optional service (never lets it break core UX):
 *
 *   const ai = createCircuitBreaker({ label: "ai", failureThreshold: 3 });
 *   const tip = await withFallback(
 *     () => ai.exec(() => withRetry(() => generateTip(topic), { label: "ai-tip" })),
 *     { fallback: STATIC_TIP, label: "ai" },
 *   );
 */

export { withRetry, computeBackoff } from "./retry";
export type { RetryOptions, DeadLetterEntry } from "./retry";
export { createCircuitBreaker, CircuitOpenError } from "./circuitBreaker";
export type { CircuitState, CircuitBreaker, CircuitBreakerOptions } from "./circuitBreaker";
export { withFallback } from "./degradation";
export type { FallbackOptions } from "./degradation";
export { SERVICE_CRITICALITY, isCritical } from "./criticality";
export type { Criticality } from "./criticality";
