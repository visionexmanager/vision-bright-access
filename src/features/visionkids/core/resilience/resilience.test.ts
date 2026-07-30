import { describe, it, expect, vi } from "vitest";
import { computeBackoff, withRetry } from "./retry";
import { createCircuitBreaker, CircuitOpenError } from "./circuitBreaker";
import { withFallback } from "./degradation";
import { isCritical } from "./criticality";

const noSleep = () => Promise.resolve();

describe("computeBackoff", () => {
  it("grows exponentially and is capped at maxDelayMs (no jitter)", () => {
    const opts = { baseDelayMs: 100, factor: 2, maxDelayMs: 500, jitter: 0, random: () => 0.5 };
    expect(computeBackoff(1, opts)).toBe(100);
    expect(computeBackoff(2, opts)).toBe(200);
    expect(computeBackoff(3, opts)).toBe(400);
    expect(computeBackoff(4, opts)).toBe(500); // capped (would be 800)
    expect(computeBackoff(10, opts)).toBe(500); // still capped
  });

  it("never returns a negative delay even with extreme jitter", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(computeBackoff(3, { baseDelayMs: 100, jitter: 1, random: () => r })).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("withRetry", () => {
  it("returns immediately on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await withRetry(fn, { sleep: noSleep })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue("ok");
    const onRetry = vi.fn();
    expect(await withRetry(fn, { sleep: noSleep, onRetry })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("exhausts attempts, dead-letters, then re-throws the last error", async () => {
    const err = new Error("boom");
    const fn = vi.fn().mockRejectedValue(err);
    const deadLetter = vi.fn();
    await expect(withRetry(fn, { maxAttempts: 3, sleep: noSleep, deadLetter, label: "job" })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(deadLetter).toHaveBeenCalledTimes(1);
    expect(deadLetter.mock.calls[0][0]).toMatchObject({ label: "job", attempts: 3, error: err });
  });

  it("does not retry a non-retryable (AbortError)", async () => {
    const abort = new DOMException("Aborted", "AbortError");
    const fn = vi.fn().mockRejectedValue(abort);
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toBe(abort);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("createCircuitBreaker", () => {
  it("opens after the failure threshold, then fails fast", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000, now: () => 0 });
    const boom = () => Promise.reject(new Error("nope"));
    await expect(breaker.exec(boom)).rejects.toThrow("nope");
    await expect(breaker.exec(boom)).rejects.toThrow("nope");
    expect(breaker.state).toBe("open");
    // Now fails fast without calling through.
    await expect(breaker.exec(boom)).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("half-opens after the cool-down and closes on a successful trial", async () => {
    let clock = 0;
    const breaker = createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 100, now: () => clock });
    await expect(breaker.exec(() => Promise.reject(new Error("f")))).rejects.toThrow();
    expect(breaker.state).toBe("open");
    clock = 200; // past cool-down
    expect(await breaker.exec(() => Promise.resolve("recovered"))).toBe("recovered");
    expect(breaker.state).toBe("closed");
  });
});

describe("withFallback", () => {
  it("passes through the primary value on success", async () => {
    expect(await withFallback(() => Promise.resolve(1), { fallback: 0 })).toBe(1);
  });

  it("returns the fallback on failure and reports degradation", async () => {
    const onDegraded = vi.fn();
    const out = await withFallback(() => Promise.reject(new Error("down")), { fallback: 42, onDegraded });
    expect(out).toBe(42);
    expect(onDegraded).toHaveBeenCalledTimes(1);
  });

  it("supports a fallback function of the error", async () => {
    const out = await withFallback<string>(() => Promise.reject(new Error("x")), {
      fallback: (e) => (e instanceof Error ? e.message : "?"),
    });
    expect(out).toBe("x");
  });
});

describe("criticality", () => {
  it("classifies load-bearing vs optional services; unknown defaults to optional", () => {
    expect(isCritical("auth")).toBe(true);
    expect(isCritical("database")).toBe(true);
    expect(isCritical("ai")).toBe(false);
    expect(isCritical("analytics")).toBe(false);
    expect(isCritical("something-unknown")).toBe(false);
  });
});
