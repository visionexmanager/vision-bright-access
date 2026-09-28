import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Metering PR 5: functions bill through one entry (vx/billing.ts) that picks
// shadow, fixed or metered from the service registry. Every service is
// disabled, so today each wired function runs exactly as before — these tests
// pin that, and what happens the day a service is enabled.

const env: Record<string, string | undefined> = { OPENAI_API_KEY: "sk-test" };
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

const billing = await import("../../supabase/functions/_shared/vx/billing.ts");
const usageRecording = await import("../../supabase/functions/_shared/usageRecording.ts");
const checks = await import("../../scripts/ai-eval/record-model-checks.mjs");

type Registry = Array<{ service_id: string; enabled: boolean; pricing_mode: string }>;
const PRICE = { id: 1, provider: "openai", model_id: "gpt-4o-mini", unit: "usd_per_1m_tokens", rates: { input: 0.15, output: 0.6 }, effective_from: "2026-01-01T00:00:00Z", effective_to: null };

/** A service-role client double: the reads billing makes, and every RPC it calls. */
function fakeDb(opts: {
  registry?: Registry | Error;
  readiness?: Array<{ provider: string; model_id: string; production_ready: boolean }> | Error;
  rpc?: Record<string, unknown>;
} = {}) {
  const rpcs: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const selects: string[] = [];
  const db = {
    from: (table: string) => ({
      select: async () => {
        selects.push(table);
        const data = table === "central_pricing_registry" ? opts.registry
          : table === "ai_model_readiness" ? opts.readiness
          : table === "ai_price_book" ? [PRICE] : [];
        return data instanceof Error ? { data: null, error: data } : { data: data ?? [], error: null };
      },
      insert: async () => ({ error: null }),
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      const answer = opts.rpc?.[fn];
      return { data: answer ?? null, error: answer === undefined ? { message: "no stub" } : null };
    },
  };
  return { db, rpcs, selects };
}

const REQ = { serviceId: "ai_chat", userId: "u1", source: "website" as const, idempotencyKey: "ai-chat:abcdefgh",
  targets: [{ provider: "openai", model: "gpt-4o-mini" }, { provider: "openai", model: "gpt-4.1" }], bound: { input_tokens: 100, output_tokens: 100 } };

beforeEach(() => { billing.resetBillingCaches(); usageRecording.resetPriceBookCache(); });
afterEach(() => vi.useRealTimers());

describe("disabled (every service today): exactly as before", () => {
  it("runs once with no reservation and no ready-list, and calls no billing RPC", async () => {
    const { db, rpcs } = fakeDb({ registry: [{ service_id: "ai_chat", enabled: false, pricing_mode: "metered" }] });
    const run = vi.fn(async (ctx: unknown) => ({ value: ctx }));
    const out = await billing.billedRequest(db, REQ, run);
    expect(out).toEqual({ status: "shadow", value: { reservationId: null, targets: null } });
    expect(rpcs).toEqual([]);
  });

  it("a guest is never billed, whatever the service says", async () => {
    const { db, rpcs, selects } = fakeDb({ registry: [{ service_id: "ai_chat", enabled: true, pricing_mode: "metered" }] });
    expect((await billing.billedRequest(db, { ...REQ, userId: null }, async () => ({ value: 1 }))).status).toBe("shadow");
    expect(rpcs).toEqual([]);
    expect(selects).toEqual([]);
  });

  it("an unreadable registry with nothing cached runs in shadow — metering never takes the product down", async () => {
    const { db, rpcs } = fakeDb({ registry: new Error("down") });
    expect((await billing.billedRequest(db, REQ, async () => ({ value: 1 }))).status).toBe("shadow");
    expect(rpcs).toEqual([]);
  });

  it("the registry is read once a minute, not once a request", async () => {
    const { db, selects } = fakeDb({ registry: [] });
    const t = Date.parse("2026-10-01T00:00:00Z");
    for (let i = 0; i < 4; i++) await billing.billedRequest(db, REQ, async () => ({ value: 1 }), t + i * 1000);
    expect(selects.filter((s) => s === "central_pricing_registry")).toHaveLength(1);
    await billing.billedRequest(db, REQ, async () => ({ value: 1 }), t + billing.BILLING_CACHE_TTL_MS + 1);
    expect(selects.filter((s) => s === "central_pricing_registry")).toHaveLength(2);
  });
});

describe("fixed price (a service the owner enables with pricing_mode fixed)", () => {
  const registry: Registry = [{ service_id: "image", enabled: true, pricing_mode: "fixed" }];
  const req = { ...REQ, serviceId: "image" };

  it("holds, runs, settles the fixed price", async () => {
    const { db, rpcs } = fakeDb({ registry, rpc: {
      vx_reserve: { ok: true, replayed: false, reservation_id: "r1", reserved_vx: 60 },
      vx_settle: { ok: true, status: "settled", consumed_vx: 60, refunded_vx: 0 },
    } });
    const out = await billing.billedRequest(db, req, async () => ({ value: "img" }));
    expect(out).toEqual({ status: "charged", value: "img", reservationId: "r1", consumedVx: 60 });
    expect(rpcs.map((r) => r.fn)).toEqual(["vx_reserve", "vx_settle"]);
  });

  it("a failure returns the whole hold and the caller still gets its own error", async () => {
    const { db, rpcs } = fakeDb({ registry, rpc: {
      vx_reserve: { ok: true, replayed: false, reservation_id: "r1", reserved_vx: 60 },
      vx_release: { ok: true, status: "failed" },
    } });
    await expect(billing.billedRequest(db, req, async () => { throw new Error("not delivered"); })).rejects.toThrow("not delivered");
    expect(rpcs.map((r) => r.fn)).toEqual(["vx_reserve", "vx_release"]);
  });

  it("insufficient VX is refused before the work runs", async () => {
    const { db } = fakeDb({ registry, rpc: { vx_reserve: { ok: false, error: "insufficient_vx", balance: 5, required: 60 } } });
    const run = vi.fn();
    expect(await billing.billedRequest(db, req, run)).toMatchObject({ status: "refused", reason: "insufficient_vx" });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("metered (a service the owner enables with pricing_mode metered)", () => {
  const registry: Registry = [{ service_id: "ai_chat", enabled: true, pricing_mode: "metered" }];

  it("only production-ready models run, held at their worst case, billed against the reservation", async () => {
    const { db, rpcs } = fakeDb({ registry,
      readiness: [{ provider: "openai", model_id: "gpt-4o-mini", production_ready: true }, { provider: "openai", model_id: "gpt-4.1", production_ready: false }],
      rpc: {
        vx_reserve_metered: { ok: true, replayed: false, reservation_id: "r9", reserved_vx: 1 },
        vx_settle_metered: { ok: true, status: "settled", consumed_vx: 1, refunded_vx: 0 },
      } });
    const run = vi.fn(async (ctx: { reservationId: string | null; targets: unknown }) => ({ value: ctx }));
    const out = await billing.billedRequest(db, REQ, run);
    expect(out).toMatchObject({ status: "settled", reservationId: "r9", value: { reservationId: "r9", targets: [{ provider: "openai", model: "gpt-4o-mini" }] } });
    const reserve = rpcs.find((r) => r.fn === "vx_reserve_metered")!;
    expect(reserve.args._max_cost_usd).toBeCloseTo((100 * 0.15 + 100 * 0.6) / 1e6, 12);
    expect(reserve.args._idempotency_key).toBe("ai-chat:abcdefgh");
  });

  it("no ready model: refused before anything is held or run", async () => {
    const { db, rpcs } = fakeDb({ registry, readiness: [{ provider: "openai", model_id: "gpt-4.1", production_ready: false }] });
    const run = vi.fn();
    expect(await billing.billedRequest(db, REQ, run)).toEqual({ status: "refused", reason: "no_ready_model" });
    expect(run).not.toHaveBeenCalled();
    expect(rpcs).toEqual([]);
  });

  it("an unreadable readiness view: none is ready — fail closed", async () => {
    const { db, rpcs } = fakeDb({ registry, readiness: new Error("down") });
    expect(await billing.billedRequest(db, REQ, vi.fn())).toEqual({ status: "refused", reason: "no_ready_model" });
    expect(rpcs).toEqual([]);
  });

  it("a ready model with no price cannot be bounded: refused", async () => {
    const { db } = fakeDb({ registry, readiness: [{ provider: "openai", model_id: "gpt-4.1", production_ready: true }] });
    expect(await billing.billedRequest(db, REQ, vi.fn())).toEqual({ status: "refused", reason: "unpriced_model" });
  });

  it("a failed reservation call is a refusal, never a free run", async () => {
    const { db } = fakeDb({ registry, readiness: [{ provider: "openai", model_id: "gpt-4o-mini", production_ready: true }] });
    const run = vi.fn();
    expect(await billing.billedRequest(db, REQ, run)).toMatchObject({ status: "refused", reason: "reserve_failed" });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("streamWithEnd hands every byte on and settles when the stream ends", async () => {
    const enc = new TextEncoder();
    const src = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc.encode("ab")); c.enqueue(enc.encode("c")); c.close(); } });
    const { stream, done } = billing.streamWithEnd(src);
    let ended = false;
    void done.then(() => { ended = true; });
    expect(await new Response(stream).text()).toBe("abc");
    await done;
    expect(ended).toBe(true);
  });

  it("streamWithEnd settles when the reader walks away", async () => {
    const src = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); } }); // never closes
    const { stream, done } = billing.streamWithEnd(src);
    const r = stream.getReader();
    await r.read();
    await r.cancel();
    await expect(done).resolves.toBeUndefined();
  });

  it("the idempotency key: the client's header when well formed, a fresh one otherwise", () => {
    const withKey = new Request("https://x", { headers: { "Idempotency-Key": "abc_12345-XYZ" } });
    expect(billing.requestIdempotencyKey(withKey, "ai-chat", "user-a")).toBe("ai-chat:user-a:abc_12345-XYZ");
    const bad = new Request("https://x", { headers: { "Idempotency-Key": "'; drop" } });
    const a = billing.requestIdempotencyKey(bad, "ai-chat", "user-a");
    expect(a).toMatch(/^ai-chat:[0-9a-f-]{36}$/);
    expect(billing.requestIdempotencyKey(bad, "ai-chat", "user-a")).not.toBe(a);
  });

  it("one client key sent by two accounts is two keys — never another account's reservation", () => {
    // vx_usage_ledger.idempotency_key is unique across users, and the fixed-mode
    // vx_reserve replays a match without comparing users.
    const req = () => new Request("https://x", { headers: { "Idempotency-Key": "same-key-123" } });
    const a = billing.requestIdempotencyKey(req(), "image-generate", "user-a");
    const b = billing.requestIdempotencyKey(req(), "image-generate", "user-b");
    expect(a).not.toBe(b);
    expect(billing.requestIdempotencyKey(req(), "image-generate", "user-a")).toBe(a);
    expect(billing.requestIdempotencyKey(req(), "ai-chat", null)).toBe("ai-chat:guest:same-key-123");
  });

  it("the browser is allowed to send the header, on every wired function", () => {
    // Without it in Access-Control-Allow-Headers the preflight fails and the
    // call never reaches the function.
    for (const file of ["_shared/cors.ts", "image-generate/index.ts", "text-to-speech/index.ts"]) {
      const s = readFileSync(`supabase/functions/${file}`, "utf8");
      expect(s, file).toMatch(/Access-Control-Allow-Headers":\s*"[^"]*\bidempotency-key\b/);
    }
    for (const fn of ["ai-chat", "document-generate"]) {
      expect(readFileSync(`supabase/functions/${fn}/index.ts`, "utf8"), fn).toContain("_shared/cors");
    }
  });

  it("refusals answer with a status the client can act on, and a code — never internals", async () => {
    const res = (reason: string) => billing.billingRefusalResponse({ status: "refused", reason }, {});
    expect(res("insufficient_vx").status).toBe(402);
    expect(res("daily_ceiling_reached").status).toBe(429);
    expect(res("no_ready_model").status).toBe(503);
    expect(billing.billingRefusalResponse({ status: "duplicate", reservationId: "r", state: "settled" }, {}).status).toBe(409);
    expect(await res("insufficient_vx").json()).toEqual({ error: "This service is not available for your account right now.", code: "insufficient_vx" });
  });
});

describe("the wired functions", () => {
  const src = (fn: string) => readFileSync(`supabase/functions/${fn}/index.ts`, "utf8");

  for (const [fn, service] of [["ai-chat", "ai_chat"], ["image-generate", "image"], ["text-to-speech", "tts"], ["document-generate", "document_ai"]]) {
    it(`${fn} bills through the registry as "${service}", with a per-request key, and answers refusals`, () => {
      const s = src(fn);
      expect(s).toContain(`serviceId: "${service}"`);
      expect(s).toMatch(new RegExp(`requestIdempotencyKey\\(req, "${fn}", [^)]*\\)`));
      expect(s).toMatch(/billingRefusalResponse\(billed, /);
    });
  }

  it("ai-chat settles when the stream ends and passes the reservation to its chain", () => {
    const s = src("ai-chat");
    expect(s).toContain("streamWithEnd(answered.result)");
    expect(s).toContain("...(reservationId ? { reservationId } : {})");
    expect(s).toContain("targets: ready ?? targets");
    expect(s).toContain("userId: user?.id ?? null");
  });

  it("image-generate charges only an image the person receives: generation, storage and link all inside the billed work", () => {
    const s = src("image-generate");
    const billedAt = s.indexOf("billedRequest(serviceClient");
    const settledAt = s.indexOf("delivered = billed.value;");
    for (const step of ["await generateImage(", ".upload(objectPath", ".createSignedUrl(objectPath"]) {
      const at = s.indexOf(step);
      expect(at, step).toBeGreaterThan(billedAt);
      expect(at, step).toBeLessThan(settledAt);
    }
    expect(s.match(/throw new ImageNotDelivered/g)).toHaveLength(3);
  });

  it("text-to-speech: a refused synthesis throws inside the billed work, so no hold is kept", () => {
    expect(src("text-to-speech")).toContain('if (synthesized.outcome === "failed") throw new SynthesisFailed(synthesized);');
  });

  it("OCR is not wired here: its page charges in the browser (with bundles), and moving that is a separate change", () => {
    expect(src("ocr-scan")).not.toContain("billedRequest(");
  });
});

describe("the ai_chat registry row", () => {
  const SQL = readFileSync("supabase/migrations/20261056000000_ai_chat_billing_service.sql", "utf8").replace(/--[^\n]*/g, "");
  it("is disabled, metered, and inserted only if absent", () => {
    expect(SQL).toMatch(/'ai_chat', 'AI chat \(website\)', NULL, 0, 0, 0, '\{\}', NULL, false, 'metered'/);
    expect(SQL).toContain("ON CONFLICT (service_id) DO NOTHING");
    expect(SQL).not.toMatch(/INSERT INTO public\.vx_conversion_policy|UPDATE public\./);
  });
});

describe("recording model checks (main only)", () => {
  it("keeps only rows that match the table's patterns — never a value that could be SQL", () => {
    const { rows, refused } = checks.validChecks([
      { provider: "openai", model_id: "gpt-4o-mini", check_name: "live_route_contract", passed: true },
      { provider: "openai", model_id: "x'); drop table t; --", check_name: "live_route_contract", passed: true },
      { provider: "openai", model_id: "gpt-4.1", check_name: "live_route_contract", passed: "yes" },
    ], "https://github.com/o/r/actions/runs/1");
    expect(rows).toEqual([{ provider: "openai", model_id: "gpt-4o-mini", check_name: "live_route_contract", passed: true, run_url: "https://github.com/o/r/actions/runs/1" }]);
    expect(refused).toBe(2);
  });

  it("the batch travels as one dollar-quoted JSON literal", () => {
    const sql = checks.insertStatement([{ provider: "openai", model_id: "m", check_name: "c", passed: true, run_url: null }]);
    expect(sql).toMatch(/jsonb_to_recordset\(\$checks\$\[.*\]\$checks\$::jsonb\)/s);
  });

  it("the workflow records on main only, in its own step, and the probe never sees the database credentials", () => {
    const wf = readFileSync(".github/workflows/live-route-contract.yml", "utf8");
    const probe = wf.slice(wf.indexOf("- name: Probe live routes"), wf.indexOf("- name: Record model checks"));
    const record = wf.slice(wf.indexOf("- name: Record model checks"));
    expect(probe).not.toContain("SUPABASE_ACCESS_TOKEN");
    expect(record).toContain("if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'");
    expect(record).toContain("SUPABASE_ACCESS_TOKEN");
  });
});
