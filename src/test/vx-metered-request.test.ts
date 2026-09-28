import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// Metering PR 4: reserve → run → settle, billed from the usage events.
// These drive the orchestration with ports that model the SQL contract; the
// SQL itself (vx_reserve_metered / vx_settle_metered) was executed against
// PGlite — see the PR. Nothing here is wired into a function yet, and every
// service is disabled, so production behaviour is unchanged.

const env: Record<string, string | undefined> = { OPENAI_API_KEY: "sk-test" };
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

const mr = await import("../../supabase/functions/_shared/vx/meteredRequest.ts");
const sinkMod = await import("../../supabase/functions/_shared/usageSink.ts");
const m = await import("../../supabase/functions/_shared/metering.ts");
const ai = await import("../../supabase/functions/_shared/aiProvider.ts");
const { meteredFetch } = await import("../../supabase/functions/_shared/meteredFetch.ts");
type ReserveResult = import("../../supabase/functions/_shared/vx/types.ts").ReserveResult;
type SettleResult = import("../../supabase/functions/_shared/vx/types.ts").SettleResult;
type UsageEvent = import("../../supabase/functions/_shared/metering.ts").UsageEvent;

const REQ = { userId: "u1", serviceId: "chat_ai", source: "website" as const, idempotencyKey: "msg-000001", maxCostUsd: 0.05 };

/** Ports over an in-memory ledger that behaves like the SQL: one hold per key, settle once. */
function ledger(opts: { refuse?: string; settleFails?: boolean } = {}) {
  const holds = new Map<string, { id: string; status: string }>();
  const calls: string[] = [];
  let n = 0;
  const ports = {
    reserve: vi.fn(async (a: { idempotencyKey: string }): Promise<ReserveResult> => {
      calls.push("reserve");
      if (opts.refuse) return { ok: false, error: opts.refuse as never };
      const existing = holds.get(a.idempotencyKey);
      if (existing) return { ok: true, replayed: true, reservation_id: existing.id, reserved_vx: 50, status: existing.status };
      const id = `res-${++n}`;
      holds.set(a.idempotencyKey, { id, status: "reserved" });
      return { ok: true, replayed: false, reservation_id: id, reserved_vx: 50 };
    }),
    settle: vi.fn(async (id: string): Promise<SettleResult> => {
      calls.push(`settle:${id}`);
      if (opts.settleFails) throw new Error("db down");
      for (const h of holds.values()) if (h.id === id) h.status = "settled";
      return { ok: true, status: "settled", consumed_vx: 13, refunded_vx: 37 };
    }),
    writesSettled: vi.fn(async (id: string) => { calls.push(`writes:${id}`); await sinkMod.reservationWritesSettled(id); }),
    background: vi.fn((p: Promise<unknown>) => { void p; }),
  };
  return { ports, calls, holds };
}

afterEach(() => { sinkMod.setUsageSink(null); vi.unstubAllGlobals(); vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } }); });

describe("shadow: a service that is not metered runs exactly as today", () => {
  for (const reason of ["service_disabled", "service_not_metered", "unknown_service"]) {
    it(`${reason}: runs once with no reservation, holds and settles nothing`, async () => {
      const { ports } = ledger({ refuse: reason });
      const run = vi.fn(async (rid: string | null) => ({ value: rid }));
      const out = await mr.meteredRequest(ports, REQ, run);
      expect(out).toEqual({ status: "shadow", value: null });
      expect(run).toHaveBeenCalledTimes(1);
      expect(ports.settle).not.toHaveBeenCalled();
    });
  }
});

describe("refusals happen before any provider call", () => {
  for (const reason of ["insufficient_vx", "over_reserve_cap", "conversion_not_configured", "daily_ceiling_reached", "idempotency_key_conflict"]) {
    it(`${reason}: nothing runs`, async () => {
      const { ports } = ledger({ refuse: reason });
      const run = vi.fn();
      expect(await mr.meteredRequest(ports, REQ, run)).toMatchObject({ status: "refused", reason });
      expect(run).not.toHaveBeenCalled();
    });
  }
});

describe("reserve → run → settle", () => {
  it("success: runs with the reservation, waits for its usage writes, settles once", async () => {
    const { ports, calls } = ledger();
    let release!: () => void;
    const write = new Promise<void>((r) => { release = r; });
    const run = vi.fn(async (rid: string | null) => {
      sinkMod.trackReservationWrite(rid!, write); // an event still being stored
      setTimeout(release, 20);
      return { value: "answer" };
    });
    const out = await mr.meteredRequest(ports, REQ, run);
    expect(out).toMatchObject({ status: "settled", value: "answer", reservationId: "res-1" });
    expect(calls).toEqual(["reserve", "writes:res-1", "settle:res-1"]);
    expect(ports.settle).toHaveBeenCalledTimes(1);
  });

  it("provider failure: still settles from the events (releasing when nothing is billable), then rethrows", async () => {
    const { ports } = ledger();
    await expect(mr.meteredRequest(ports, REQ, async () => { throw new Error("all providers failed"); })).rejects.toThrow("all providers failed");
    expect(ports.settle).toHaveBeenCalledTimes(1);
  });

  it("a settlement that fails never breaks the answer", async () => {
    const { ports } = ledger({ settleFails: true });
    const out = await mr.meteredRequest(ports, REQ, async () => ({ value: 42 }));
    expect(out).toMatchObject({ status: "settled", value: 42, settlement: { ok: false } });
  });

  it("stream: returns at once, settles only when the stream ends", async () => {
    const { ports, calls } = ledger();
    let end!: () => void;
    const done = new Promise<void>((r) => { end = r; });
    const out = await mr.meteredRequest(ports, REQ, async () => ({ value: "stream", done }));
    expect(out).toMatchObject({ status: "settling", reservationId: "res-1" });
    expect(ports.settle).not.toHaveBeenCalled();
    const background = ports.background.mock.calls[0][0] as Promise<unknown>;
    end();
    await background;
    expect(calls.at(-1)).toBe("settle:res-1");
  });
});

describe("never twice", () => {
  it("duplicate retry after completion: nothing runs, nothing is held again", async () => {
    const { ports } = ledger();
    const run = vi.fn(async () => ({ value: 1 }));
    await mr.meteredRequest(ports, REQ, run);
    const again = await mr.meteredRequest(ports, REQ, run);
    expect(again).toEqual({ status: "duplicate", reservationId: "res-1", state: "settled" });
    expect(run).toHaveBeenCalledTimes(1);
    expect(ports.settle).toHaveBeenCalledTimes(1);
  });

  it("concurrent submits of one action: one runs, the other is refused as in flight", async () => {
    const { ports } = ledger();
    let finish!: () => void;
    const gate = new Promise<void>((r) => { finish = r; });
    const run = vi.fn(async () => { await gate; return { value: "x" }; });
    const first = mr.meteredRequest(ports, REQ, run);
    const second = await mr.meteredRequest(ports, REQ, run);
    finish();
    expect(await first).toMatchObject({ status: "settled" });
    expect(second).toEqual({ status: "duplicate", reservationId: "res-1", state: "reserved" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("concurrent requests with different keys each hold and settle their own", async () => {
    const { ports } = ledger();
    const outs = await Promise.all([1, 2, 3].map((i) => mr.meteredRequest(ports, { ...REQ, idempotencyKey: `msg-00000${i}` }, async (rid) => ({ value: rid }))));
    expect(outs.map((o) => o.status === "settled" && o.value)).toEqual(["res-1", "res-2", "res-3"]);
    expect(ports.settle).toHaveBeenCalledTimes(3);
  });
});

describe("the reservation reaches every provider call's event", () => {
  const sink = () => { const events: UsageEvent[] = []; sinkMod.setUsageSink((e) => events.push(e)); return events; };

  it("aiProvider: a structured call carries it", async () => {
    const events = sink();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { tool_calls: [{ function: { arguments: "{\"a\":1}" } }] } }], usage: { prompt_tokens: 1, completion_tokens: 1 },
    }))));
    await ai.structuredCompletion({ provider: "openai", model: "gpt-4o-mini", system: "s", userText: "u", schema: { type: "object" }, toolName: "t", reservationId: "res-9" });
    expect(events[0]).toMatchObject({ reservation_id: "res-9", outcome: "ok" });
  });

  it("aiProvider: every attempt of a fallback chain carries it", async () => {
    const events = sink();
    let i = 0;
    vi.stubGlobal("fetch", vi.fn(async () => i++ === 0 ? new Response("{}", { status: 500 }) : new Response(JSON.stringify({
      choices: [{ message: { tool_calls: [{ function: { arguments: "{\"a\":1}" } }] } }],
    }))));
    await ai.structuredCompletionWithFallback({
      targets: [{ provider: "openai", model: "gpt-4.1" }, { provider: "openai", model: "gpt-4o-mini" }],
      system: "s", userText: "u", schema: { type: "object" }, toolName: "t", reservationId: "res-7",
    });
    expect(events.map((e) => [e.outcome, e.reservation_id])).toEqual([["error", "res-7"], ["ok", "res-7"]]);
  });

  it("meteredFetch: carries it, and settlement waits for the background read", async () => {
    const events = sink();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ usage: { prompt_tokens: 2, completion_tokens: 1 } }))));
    await meteredFetch("https://api.openai.com/v1/chat/completions",
      { method: "POST", body: JSON.stringify({ model: "gpt-4o", messages: [] }) }, { reservationId: "res-5" });
    await sinkMod.reservationWritesSettled("res-5");
    expect(events[0]).toMatchObject({ operation: "chat", reservation_id: "res-5", usage_source: "reported" });
  });

  it("without a reservation nothing changes: no reservation_id on the event", async () => {
    const events = sink();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ usage: { prompt_tokens: 2 } }))));
    await meteredFetch("https://api.openai.com/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-4o", messages: [] }) });
    await new Promise((r) => setTimeout(r, 0));
    expect(events[0]).not.toHaveProperty("reservation_id");
  });
});

describe("the worst case is bounded before anything is held", () => {
  const row = (model: string, rates: Record<string, number>, unit = "usd_per_1m_tokens") =>
    ({ id: 1, provider: "openai", model_id: model, unit, rates, effective_from: "2026-01-01T00:00:00Z", effective_to: null }) as never;
  const AT = "2026-10-01T00:00:00Z";

  it("a chain is bounded by its most expensive model, at the whole output budget", () => {
    const bound = m.chatUsageBound(4000, 1000); // 2000 input tokens, 1000 output
    const cost = m.worstCaseCostUsd([row("gpt-4o-mini", { input: 0.15, output: 0.6 }), row("gpt-4.1", { input: 2, output: 8 })],
      [{ provider: "openai", model: "gpt-4o-mini" }, { provider: "openai", model: "gpt-4.1" }], bound, AT);
    expect(cost).toBeCloseTo((2000 * 2 + 1000 * 8) / 1e6, 9);
  });

  it("a very expensive model raises the bound accordingly (the cap then refuses it)", () => {
    const cost = m.worstCaseCostUsd([row("gpt-6-astra", { input: 10, output: 50 })], [{ provider: "openai", model: "gpt-6-astra" }], m.chatUsageBound(4000, 1000), AT);
    expect(cost).toBeCloseTo(0.07, 9);
  });

  it("a target that cannot be priced makes the request unboundable — never reserved for", () => {
    expect(m.worstCaseCostUsd([row("gpt-4.1", { input: 2, output: 8 })],
      [{ provider: "openai", model: "gpt-4.1" }, { provider: "gemini", model: "gemini-flash-lite-latest" }], m.chatUsageBound(10, 10), AT)).toBeNull();
    expect(m.worstCaseCostUsd([], [], m.chatUsageBound(10, 10), AT)).toBeNull();
  });

  it("a free model bounds at zero", () => {
    expect(m.worstCaseCostUsd([row("omni-moderation-latest", {}, "free")], [{ provider: "openai", model: "omni-moderation-latest" }], { input_tokens: 10 }, AT)).toBe(0);
  });
});

describe("readiness gate", () => {
  const targets = [{ provider: "openai", model: "gpt-4.1" }, { provider: "openai", model: "gpt-6-astra" }, { provider: "gemini", model: "gemini-flash-lite-latest" }];

  it("a charged request may use only production-ready models", () => {
    expect(mr.readyTargets(targets, [
      { provider: "openai", model_id: "gpt-4.1", production_ready: true },
      { provider: "openai", model_id: "gpt-6-astra", production_ready: false },
    ])).toEqual([{ provider: "openai", model: "gpt-4.1" }]);
  });

  it("an unreadable readiness view allows none — fail closed", () => {
    expect(mr.readyTargets(targets, null)).toEqual([]);
  });
});

describe("the migration", () => {
  const SQL = readFileSync("supabase/migrations/20261055000000_vx_metered_settlement.sql", "utf8").replace(/--[^\n]*/g, "");

  it("turns nothing on: no service enabled, no policy row, fixed stays the default", () => {
    expect(SQL).not.toMatch(/INSERT INTO public\.vx_conversion_policy/);
    expect(SQL).not.toMatch(/UPDATE public\.central_pricing_registry/);
    expect(SQL).not.toMatch(/enabled\s*=\s*true/);
    expect(SQL).toMatch(/pricing_mode text NOT NULL DEFAULT 'fixed'/);
  });

  it("every new function and table is service-only", () => {
    for (const fn of ["vx_reserve_metered(uuid, text, text, text, numeric, jsonb)", "vx_settle_metered(uuid)", "vx_metered_charge(text, numeric)"]) {
      expect(SQL).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated;`);
      expect(SQL).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`);
    }
    for (const t of ["vx_conversion_policy", "ai_model_checks"]) {
      expect(SQL).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
      expect(SQL).toContain(`REVOKE ALL ON TABLE public.${t} FROM PUBLIC, anon, authenticated;`);
    }
    expect(SQL).toContain("REVOKE ALL ON public.ai_model_readiness FROM PUBLIC, anon, authenticated;");
    expect(SQL).not.toMatch(/CREATE POLICY/i);
  });

  it("checks the key for a replay only after taking the user's lock", () => {
    const body = SQL.slice(SQL.indexOf("FUNCTION public.vx_reserve_metered"), SQL.indexOf("FUNCTION public.vx_settle_metered"));
    expect(body.indexOf("pg_advisory_xact_lock")).toBeGreaterThan(0);
    expect(body.indexOf("pg_advisory_xact_lock")).toBeLessThan(body.indexOf("WHERE idempotency_key = _idempotency_key"));
  });

  it("settles from billable, priced events only — a failure is billed only if the policy says so", () => {
    const body = SQL.slice(SQL.indexOf("FUNCTION public.vx_settle_metered"));
    expect(body).toContain("(e.outcome = 'ok' OR (_bill_fail AND e.usage_source <> 'missing')) AS billable");
    expect(body).toContain("_bill_fail := COALESCE(_bill_fail, false);");
    expect(body).toMatch(/IF _billable = 0 THEN\s+RETURN public\.vx_release/);
  });
});
