// The one path every surface bills through.
//
// Driven with functions rather than a database, which is the point of the
// seam: these assert what `meter()` *does* on each path, not that the right
// strings appear near each other in the source.

import { describe, expect, it, vi } from "vitest";

import { meter, type MeterPorts } from "../../supabase/functions/_shared/vx/meter.ts";
import type { ReserveResult, SettleResult } from "../../supabase/functions/_shared/vx/types.ts";

function ports(overrides: Partial<MeterPorts> = {}) {
  const calls: string[] = [];
  const settleArgs: unknown[] = [];
  const releaseArgs: unknown[] = [];

  const base: MeterPorts = {
    reserve: vi.fn(async (): Promise<ReserveResult> => {
      calls.push("reserve");
      return { ok: true, replayed: false, reservation_id: "res-1", reserved_vx: 60 };
    }),
    settle: vi.fn(async (args): Promise<SettleResult> => {
      calls.push("settle");
      settleArgs.push(args);
      return { ok: true, status: "settled", consumed_vx: args.consumedVx ?? 60, refunded_vx: 60 - (args.consumedVx ?? 60) };
    }),
    release: vi.fn(async (args): Promise<SettleResult> => {
      calls.push("release");
      releaseArgs.push(args);
      return { ok: true, status: "failed", refunded_vx: 60 };
    }),
  };
  return { ports: { ...base, ...overrides }, calls, settleArgs, releaseArgs };
}

const request = <T>(run: () => Promise<{ value: T; consumedVx?: number; provider?: string; actualCostUsd?: number }>) => ({
  userId: "user-1",
  serviceId: "image" as const,
  source: "website" as const,
  idempotencyKey: "job-1",
  run,
});

describe("the happy path", () => {
  it("reserves, runs, settles — in that order", async () => {
    const p = ports();
    const result = await meter(p.ports, request(async () => ({ value: "a-picture", consumedVx: 40 })));

    expect(p.calls).toEqual(["reserve", "settle"]);
    expect(result).toEqual({
      ok: true, value: "a-picture", reservationId: "res-1",
      reservedVx: 60, consumedVx: 40, refundedVx: 20,
    });
  });

  it("measures how long the work took and passes the vendor through", async () => {
    const p = ports();
    await meter(p.ports, request(async () => {
      await new Promise((r) => setTimeout(r, 12));
      return { value: 1, provider: "openai", actualCostUsd: 0.04 };
    }));

    const [args] = p.settleArgs as Array<{ executionTimeMs: number; provider: string; actualCostUsd: number }>;
    expect(args.executionTimeMs).toBeGreaterThanOrEqual(10);
    expect(args.provider).toBe("openai");
    expect(args.actualCostUsd).toBe(0.04);
  });

  it("settles for the whole hold when the work reports no cost of its own", async () => {
    const p = ports();
    const result = await meter(p.ports, request(async () => ({ value: 1 })));
    expect((p.settleArgs[0] as { consumedVx: number | null }).consumedVx).toBeNull();
    expect(result).toMatchObject({ ok: true, consumedVx: 60, refundedVx: 0 });
  });
});

describe("a refusal costs no provider call", () => {
  it("never runs the work when the hold is refused", async () => {
    const run = vi.fn(async () => ({ value: "should not happen" }));
    const p = ports({
      reserve: async () => ({ ok: false, error: "insufficient_vx", balance: 10, required: 60, shortage: 50 }),
    });

    const result = await meter(p.ports, request(run));
    expect(run).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false, reason: "insufficient_vx",
      detail: { balance: 10, required: 60, shortage: 50 },
    });
  });

  it("carries each refusal code through, because each is a different sentence", async () => {
    for (const error of ["service_disabled", "admin_only", "daily_ceiling_reached", "plan_allowance_reached"] as const) {
      const p = ports({ reserve: async () => ({ ok: false, error }) });
      const result = await meter(p.ports, request(async () => ({ value: 1 })));
      expect(result, error).toMatchObject({ ok: false, reason: error });
    }
  });
});

describe("failure returns the whole hold", () => {
  it("releases when the work throws, and says why", async () => {
    const p = ports();
    const result = await meter(p.ports, request(async () => {
      throw new Error("provider timed out");
    }));

    expect(p.calls).toEqual(["reserve", "release"]);
    expect(p.releaseArgs[0]).toMatchObject({ reservationId: "res-1", reason: "provider timed out", status: "failed" });
    expect(result).toMatchObject({ ok: false, reason: "execution_failed" });
  });

  it("does not let a failed release hide the failure that caused it", async () => {
    const p = ports({ release: async () => { throw new Error("database unreachable"); } });
    const result = await meter(p.ports, request(async () => { throw new Error("upstream 500"); }));
    // The caller still learns the work failed; the reaper returns the hold.
    expect(result).toMatchObject({ ok: false, reason: "execution_failed" });
  });

  it("never settles a job it released", async () => {
    const p = ports();
    await meter(p.ports, request(async () => { throw new Error("nope"); }));
    expect(p.calls).not.toContain("settle");
  });
});

describe("duplicates and retries", () => {
  it("runs the work for a replayed reservation that is still open", async () => {
    // The first attempt reserved and then crashed before settling. The retry
    // gets the same reservation back and should finish the job, not refuse it.
    const run = vi.fn(async () => ({ value: "finished at last" }));
    const p = ports({
      reserve: async () => ({ ok: true, replayed: true, reservation_id: "res-1", reserved_vx: 60, status: "reserved" }),
    });

    const result = await meter(p.ports, request(run));
    expect(run).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ ok: true, value: "finished at last" });
  });

  it("refuses to do settled work a second time", async () => {
    // Known-bad input for the guard above: the same key arriving after the job
    // finished. Running it again would do the work twice and charge nothing,
    // which for a publish is the expensive kind of free.
    const run = vi.fn(async () => ({ value: "a second post" }));
    const p = ports({
      reserve: async () => ({ ok: true, replayed: true, reservation_id: "res-1", reserved_vx: 60, status: "settled" }),
    });

    const result = await meter(p.ports, request(run));
    expect(run).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, reason: "already_completed" });
  });
});

describe("accounting that falls behind never fails finished work", () => {
  it("reports success when settling fails, and does not pretend it was free", async () => {
    const p = ports({ settle: async () => { throw new Error("database unreachable"); } });
    const result = await meter(p.ports, request(async () => ({ value: "done", consumedVx: 10 })));

    // The work succeeded, so the caller gets its value.
    expect(result).toMatchObject({ ok: true, value: "done" });
    // The hold still stands, so what the person has paid is the whole
    // reservation — saying 10 would disagree with their balance.
    expect(result).toMatchObject({ consumedVx: 60, refundedVx: 0 });
  });
});
