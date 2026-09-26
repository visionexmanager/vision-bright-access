// Health-aware ordering of the chat and vision chains (provider audit, 2026-09-26).
//
// The chains in assistants.ts / generators.ts are quality policy. Health may
// move a target *later* — a per-isolate cooldown after a failure that would
// repeat, or a registry row that is inactive, errored or unhealthy — but it
// never removes one, and a cooldown ends by itself. These tests drive the real
// loops with a fake fetch, so "was tried later" means the loop really asked
// that host later.

import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type * as AiProviderModule from "../../supabase/functions/_shared/aiProvider.ts";

const env: Record<string, string | undefined> = {};
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

let ai: typeof AiProviderModule;
let rec: typeof import("../../supabase/functions/_shared/providerRecording.ts");
let sel: typeof import("../../supabase/functions/_shared/providerSelection.ts");

beforeAll(async () => {
  ai = await import("../../supabase/functions/_shared/aiProvider.ts");
  rec = await import("../../supabase/functions/_shared/providerRecording.ts");
  sel = await import("../../supabase/functions/_shared/providerSelection.ts");
});

afterEach(() => {
  ai.resetProviderCooldowns();
  ai.setProviderRegistryView(null);
  ai.setProviderAttemptRecorder(null);
  for (const k of Object.keys(env)) delete env[k];
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
});

const OPENAI = "api.openai.com";
const GROQ = "api.groq.com";
const MISTRAL = "api.mistral.ai";
const G = { provider: "groq", model: "openai/gpt-oss-20b" } as const;
const M = { provider: "mistral", model: "ministral-14b-latest" } as const;
const O = { provider: "openai", model: "gpt-4.1" } as const;

const answer = () => new Response(JSON.stringify({
  choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ ok: true }) } }] } }],
}), { status: 200 });

/** Every host fails with `failing[host]` (a status, or a thrown error); the rest answer. */
function fetchFailing(failing: Record<string, number | Error>) {
  const hosts: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const host = new URL(url).host;
    hosts.push(host);
    const f = failing[host];
    if (f instanceof Error) throw f;
    return f ? new Response("", { status: f }) : answer();
  }));
  return hosts;
}

function keys() {
  env.OPENAI_API_KEY = "k";
  env.GROQ_API_KEY = "k";
  env.MISTRAL_API_KEY = "k";
}

const ask = (targets: AiProviderModule.ProviderTarget[]) =>
  ai.structuredCompletionWithFallback({ targets, system: "s", userText: "u", schema: { type: "object" }, toolName: "answer" });

describe("cooldowns: a failure that would repeat moves the target to the back", () => {
  it("a 429 sends the next request straight to the next provider, not back into the limit", async () => {
    keys();
    let hosts = fetchFailing({ [GROQ]: 429 });
    await ask([G, M, O]);
    expect(hosts).toEqual([GROQ, MISTRAL]);

    hosts = fetchFailing({ [GROQ]: 429 });
    const second = await ask([G, M, O]);
    expect(hosts).toEqual([MISTRAL]);
    expect(second.provider).toBe("mistral");
  });

  it("5xx, timeouts, dropped connections, refused keys and missing models all cool", async () => {
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    for (const failure of [503, 401, 403, 404, timeout, new TypeError("fetch failed")]) {
      ai.resetProviderCooldowns();
      keys();
      fetchFailing({ [GROQ]: failure });
      await ask([G, M, O]);
      const hosts = fetchFailing({});
      await ask([G, M, O]);
      expect(hosts, String(failure)).toEqual([MISTRAL]);
    }
  });

  it("a missing key cools too, so the loop stops re-reading an absent secret", async () => {
    env.MISTRAL_API_KEY = "k"; // no GROQ_API_KEY
    fetchFailing({});
    await ask([G, M]);
    expect(ai.orderTargets([G, M], "chat")).toEqual([M, G]);
  });

  it("a request the provider rejected as malformed does not cool: the next request is a different request", async () => {
    for (const status of [400, 413, 422]) {
      ai.resetProviderCooldowns();
      keys();
      fetchFailing({ [GROQ]: status });
      await ask([G, M, O]);
      const hosts = fetchFailing({});
      await ask([G, M, O]);
      expect(hosts, String(status)).toEqual([GROQ]);
    }
  });

  it("the cooldown is per model: one refused model does not bench its provider's others", () => {
    keys();
    const other = { provider: "groq", model: "openai/gpt-oss-120b" } as const;
    fetchFailing({ [GROQ]: 429 });
    return ask([G, M]).then(() => {
      expect(ai.orderTargets([G, other, M], "chat")).toEqual([other, M, G]);
    });
  });

  it("a cooldown ends by itself — a recovered provider is first again with no admin step", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    keys();
    fetchFailing({ [GROQ]: 429 });
    await ask([G, M, O]);
    expect(ai.orderTargets([G, M, O], "chat")[0]).toEqual(M);
    vi.setSystemTime(Date.now() + ai.COOLDOWN_MS.http_429! + 1);
    expect(ai.orderTargets([G, M, O], "chat")).toEqual([G, M, O]);
  });

  it("a success clears the cooldown at once", async () => {
    keys();
    fetchFailing({ [GROQ]: 503, [MISTRAL]: 503 });
    await ask([G, M, O]);
    // Groq and Mistral are both cooling; only a last-resort attempt reaches Groq.
    fetchFailing({ [OPENAI]: 503, [MISTRAL]: 503 });
    await ask([G, M, O]);
    expect(ai.orderTargets([G, M, O], "chat")[0]).toEqual(G);
  });

  it("nothing is ever dropped: when every target is cooling, every one is still tried", async () => {
    keys();
    fetchFailing({ [GROQ]: 503, [MISTRAL]: 503, [OPENAI]: 503 });
    await ask([G, M, O]).catch(() => undefined);
    const hosts = fetchFailing({ [GROQ]: 503, [MISTRAL]: 503 });
    const result = await ask([G, M, O]);
    expect(result.provider).toBe("openai");
    expect([...hosts].sort()).toEqual([GROQ, MISTRAL, OPENAI].sort());
  });

  it("the attempt numbers follow the order actually tried", async () => {
    keys();
    fetchFailing({ [GROQ]: 429 });
    await ask([G, M, O]);
    const attempts: AiProviderModule.ProviderAttempt[] = [];
    ai.setProviderAttemptRecorder((a) => attempts.push(a));
    fetchFailing({ [MISTRAL]: 503 });
    await ask([G, M, O]);
    expect(attempts.map((a) => [a.provider, a.attempt])).toEqual([["mistral", 1], ["openai", 2]]);
  });
});

describe("the registry: demoted rows wait their turn, switched-off rows never run", () => {
  const view = (verdict: (t: AiProviderModule.ProviderTarget) => AiProviderModule.RegistryVerdict, extras: AiProviderModule.ProviderTarget[] = []) =>
    ({ verdict, extras: () => extras });

  it("a demoted target moves after the healthy ones, keeping policy order within each group", () => {
    ai.setProviderRegistryView(view((t) => (t.provider === "groq" ? "demoted" : "ready")));
    expect(ai.orderTargets([G, M, O], "chat")).toEqual([M, O, G]);
  });

  it("an excluded target (a row an admin set inactive or error) is never tried", () => {
    ai.setProviderRegistryView(view((t) => (t.provider === "groq" ? "excluded" : "ready")));
    expect(ai.orderTargets([G, M, O], "chat")).toEqual([M, O]);
  });

  it("a view that throws changes nothing for established providers", () => {
    ai.setProviderRegistryView({ verdict: () => { throw new Error("boom"); }, extras: () => { throw new Error("boom"); } });
    expect(ai.orderTargets([G, M, O], "chat")).toEqual([G, M, O]);
  });

  it("verdicts: inactive/error exclude; degraded or health <= 20 demote except on the recovery share", () => {
    const row = (status: string, health_score: number) => ({ slug: "x", status, health_score });
    const never = () => 0.99; // outside the recovery share
    const trial = () => 0;    // inside it
    expect(sel.registryVerdict(undefined, false, never)).toBe("ready");
    expect(sel.registryVerdict(row("active", 90), false, never)).toBe("ready");
    expect(sel.registryVerdict(row("active", 21), false, never)).toBe("ready");
    expect(sel.registryVerdict(row("active", 20), false, never)).toBe("demoted");
    expect(sel.registryVerdict(row("degraded", 80), false, never)).toBe("demoted");
    expect(sel.registryVerdict(row("inactive", 100), false, trial)).toBe("excluded");
    expect(sel.registryVerdict(row("error", 100), false, trial)).toBe("excluded");
    // A health-demoted row keeps its place on the recovery share, so it can earn its way back.
    expect(sel.registryVerdict(row("active", 5), false, trial)).toBe("ready");
    expect(sel.registryVerdict(row("degraded", 5), false, trial)).toBe("ready");
    expect(sel.RECOVERY_TRIAL_SHARE).toBeGreaterThan(0);
    expect(sel.RECOVERY_TRIAL_SHARE).toBeLessThanOrEqual(0.2);
  });

  it("gated providers: no row, a switched-off row, or a row not marked production-eligible is excluded", () => {
    const row = (status: string, eligible: unknown) => ({ slug: "openrouter-chat", status, health_score: 100, config: { production_eligible: eligible } });
    expect(sel.registryVerdict(undefined, true)).toBe("excluded");
    expect(sel.registryVerdict(row("inactive", true), true)).toBe("excluded");
    expect(sel.registryVerdict(row("active", false), true)).toBe("excluded");
    expect(sel.registryVerdict(row("active", "true"), true)).toBe("excluded");
    expect(sel.registryVerdict(row("active", true), true, () => 0.99)).toBe("ready");
  });
});

describe("OpenRouter is activation-gated: nothing reaches it until its row is switched on", () => {
  const OR = { provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free" } as const;

  it("with no registry view installed, a gated target is never tried, even if a chain named it", () => {
    expect(ai.ACTIVATION_GATED.has("openrouter")).toBe(true);
    expect(ai.orderTargets([OR, O], "chat")).toEqual([O]);
  });

  it("a view that throws cannot switch a gated provider on", () => {
    ai.setProviderRegistryView({ verdict: () => { throw new Error("x"); }, extras: () => [] });
    expect(ai.orderTargets([OR, O], "chat")).toEqual([O]);
  });

  it("the registry contributes the gated provider's target, after the policy chain", () => {
    ai.setProviderRegistryView({ verdict: () => "ready", extras: () => [OR] });
    expect(ai.orderTargets([G, O], "chat")).toEqual([G, O, OR]);
  });

  it("the static chains never name a gated provider", () => {
    for (const file of ["assistants.ts", "generators.ts", "visionAnalysts.ts", "whatsappUnderstand.ts"]) {
      const src = readFileSync(`supabase/functions/_shared/${file}`, "utf8");
      expect(src, file).not.toMatch(/provider:\s*"openrouter"/);
    }
  });

  it("sends OpenRouter's app headers, and the key only as Bearer auth", async () => {
    env.OPENROUTER_API_KEY = "or-test";
    ai.setProviderRegistryView({ verdict: () => "ready", extras: () => [] });
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      seen.push({ url, headers: init.headers as Record<string, string> });
      return answer();
    }));
    await ai.structuredCompletionWithFallback({ targets: [OR], system: "s", userText: "u", schema: { type: "object" }, toolName: "answer" });
    expect(seen[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(seen[0].headers).toMatchObject({ "HTTP-Referer": "https://visionex.app", "X-Title": "Visionex", Authorization: "Bearer or-test" });
  });
});

describe("registryViewFrom: reading the snapshot never holds up a request", () => {
  function fakeDb(rows: unknown, opts: { hang?: boolean; fail?: boolean } = {}) {
    const calls: unknown[][] = [];
    const db = {
      from: (table: string) => ({
        select: (cols: string) => ({
          in: (col: string, vals: string[]) => {
            calls.push([table, cols, col, vals]);
            if (opts.fail) return Promise.reject(new Error("db down"));
            if (opts.hang) return new Promise(() => undefined);
            return Promise.resolve({ data: rows });
          },
        }),
      }),
    };
    return { db, calls };
  }

  const orRow = (over: Record<string, unknown> = {}) => ({
    slug: "openrouter-chat", status: "active", health_score: 100, default_model: "m-free",
    config: { production_eligible: true, verified_models: { "m-free": ["chat"] } }, ...over,
  });

  it("answers from the snapshot by kind: established providers default to ready, gated ones to excluded", async () => {
    const { db, calls } = fakeDb([
      { slug: "groq-chat", status: "degraded", health_score: 10 },
      { slug: "gemini-vision", status: "inactive", health_score: 50 },
      { slug: "openai-chat", status: "active", health_score: 90 },
    ]);
    const work: Promise<unknown>[] = [];
    const v = rec.registryViewFrom(db, { background: (p) => work.push(p), random: () => 0.99 });

    expect(v.verdict(G, "chat")).toBe("ready"); // nothing known yet: policy order
    expect(v.verdict({ provider: "openrouter", model: "m" }, "chat")).toBe("excluded"); // silence never enables
    await Promise.all(work);
    expect(calls).toEqual([["ph_providers", "slug, status, health_score, default_model, config", "type", ["chat", "vision"]]]);
    expect(v.verdict(G, "chat")).toBe("demoted");
    expect(v.verdict(O, "chat")).toBe("ready");
    expect(v.verdict({ provider: "gemini", model: "gemini-flash-latest" }, "vision")).toBe("excluded");
    expect(v.verdict({ provider: "gemini", model: "gemini-flash-latest" }, "chat")).toBe("ready"); // no chat row here
    expect(v.verdict({ provider: "anthropic", model: "x" }, "chat")).toBe("ready"); // no row, not gated
    expect(v.extras("chat", "stream")).toEqual([]); // no gated row
  });

  it("contributes a gated target only with an admin-chosen model verified for what the request needs", async () => {
    const cases: Array<[Record<string, unknown>, "stream" | "structured", "chat" | "vision", boolean]> = [
      [{}, "stream", "chat", true],
      [{}, "structured", "chat", false], // not verified for tools
      [{ config: { production_eligible: true, verified_models: { "m-free": ["chat", "tools"] } } }, "structured", "chat", true],
      [{}, "stream", "vision", false], // no vision row, and not verified for vision
      [{ default_model: null }, "stream", "chat", false],
      [{ status: "inactive" }, "stream", "chat", false],
      [{ config: { production_eligible: false, verified_models: { "m-free": ["chat"] } } }, "stream", "chat", false],
    ];
    for (const [over, mode, kind, expected] of cases) {
      const { db } = fakeDb([orRow(over)]);
      const work: Promise<unknown>[] = [];
      const v = rec.registryViewFrom(db, { background: (p) => work.push(p) });
      v.extras(kind, mode);
      await Promise.all(work);
      expect(v.extras(kind, mode), JSON.stringify([over, mode, kind])).toEqual(expected ? [{ provider: "openrouter", model: "m-free" }] : []);
    }
  });

  it("refreshes at most once per TTL, one read at a time", async () => {
    let t = 0;
    const { db, calls } = fakeDb([]);
    const work: Promise<unknown>[] = [];
    const v = rec.registryViewFrom(db, { background: (p) => work.push(p), now: () => t });
    v.verdict(G, "chat"); v.verdict(M, "chat"); v.extras("chat", "stream");
    await Promise.all(work);
    expect(calls).toHaveLength(1);
    t += rec.REGISTRY_SNAPSHOT_TTL_MS - 1;
    v.verdict(G, "chat");
    expect(calls).toHaveLength(1);
    t += 2;
    v.verdict(G, "chat");
    await Promise.all(work);
    expect(calls).toHaveLength(2);
  });

  it("a registry that fails or hangs changes nothing for established providers and enables nothing gated", async () => {
    vi.useFakeTimers();
    for (const opts of [{ fail: true }, { hang: true }]) {
      const { db } = fakeDb(null, opts);
      const work: Promise<unknown>[] = [];
      const v = rec.registryViewFrom(db, { background: (p) => work.push(p) });
      expect(v.verdict(G, "chat")).toBe("ready");
      await vi.advanceTimersByTimeAsync(rec.REGISTRY_READ_TIMEOUT_MS + 1);
      await Promise.all(work);
      expect(v.verdict(G, "chat")).toBe("ready");
      expect(v.verdict({ provider: "openrouter", model: "m" }, "chat")).toBe("excluded");
      expect(v.extras("chat", "stream")).toEqual([]);
    }
  });
});

describe("wiring", () => {
  it("the entry points that record attempts also install the registry view, in the same call", () => {
    const src = readFileSync("supabase/functions/_shared/chatRecorder.ts", "utf8");
    expect(src).toMatch(/setProviderAttemptRecorder\(/);
    expect(src).toMatch(/setProviderRegistryView\(registryViewFrom\(db\(\), \{ background: waitUntil \}\)\)/);
  });

  it("Gemini's rows are activated only from 'inactive', idempotently, with health floored at 50", () => {
    const sql = readFileSync("supabase/migrations/20261049000000_gemini_chat_vision_active.sql", "utf8").replace(/--.*$/gm, "");
    expect(sql).toMatch(/UPDATE public\.ph_providers/);
    expect(sql).toMatch(/SET status\s+= 'active'/);
    expect(sql).toMatch(/health_score = GREATEST\(health_score, 50\)/);
    expect(sql).toMatch(/WHERE slug IN \('gemini-chat', 'gemini-vision'\)\s+AND status = 'inactive';/);
    expect(sql).not.toMatch(/DELETE|DROP|TRUNCATE|INSERT/i);
  });
});

describe("only failures that would repeat count against a provider (review of #350)", () => {
  it("Gemini's unreadable answers are invalid_response, not an outage, and set no cooldown", () => {
    for (const message of ["No structured response from Gemini", "Gemini returned non-JSON output despite responseSchema"]) {
      expect(ai.attemptErrorCode(new ai.ProviderError(500, message)), message).toBe("invalid_response");
    }
    expect(ai.attemptErrorCode(new ai.ProviderError(500, "Gemini request failed"))).toBe("http_5xx");
    expect(ai.COOLDOWN_MS.invalid_response).toBeUndefined();
  });

  function fakeDb() {
    const rpcs: string[] = [];
    const logs: Record<string, unknown>[] = [];
    const db = {
      rpc: async (fn: string) => { rpcs.push(fn); return { data: null, error: null }; },
      from: (table: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "ph_providers" ? { id: "id-gc", slug: "groq-chat" } : null }) }) }),
        insert: async (row: Record<string, unknown>) => { if (table === "ph_logs") logs.push(row); return { error: null }; },
      }),
    };
    return { db, rpcs, logs };
  }
  const attempt = (error: AiProviderModule.AttemptErrorCode | undefined) => ({
    kind: "chat" as const, mode: "structured" as const, provider: "groq" as const, model: "m", attempt: 1,
    success: error === undefined, ms: 5, ...(error ? { error } : {}),
  });

  it("a malformed request or unreadable answer is logged but does not lower health", async () => {
    for (const code of ["http_400", "http_413", "http_422", "http_4xx", "invalid_response", "unknown"] as const) {
      const { db, rpcs, logs } = fakeDb();
      await rec.recordProviderAttempt(db, attempt(code));
      expect(rpcs, code).toEqual([]);
      expect(logs.map((l) => [l.status, l.error_message]), code).toEqual([["failure", code]]);
    }
  });

  it("a failure that would repeat, and every success, still move the health metric", async () => {
    for (const code of [...Object.keys(ai.COOLDOWN_MS), undefined] as (AiProviderModule.AttemptErrorCode | undefined)[]) {
      const { db, rpcs, logs } = fakeDb();
      await rec.recordProviderAttempt(db, attempt(code));
      expect(rpcs, String(code)).toEqual(["ph_record_metric"]);
      expect(logs).toHaveLength(1);
    }
  });
});

describe("Groq gpt-oss budget: the answer must survive the reasoning", () => {
  it("gpt-oss asks for low effort and adds reasoning headroom on top of the caller's budget", () => {
    for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]) {
      expect(ai.completionBudget("groq", model, 200)).toEqual({ max_tokens: 200 + ai.GROQ_REASONING_HEADROOM, reasoning_effort: "low" });
    }
  });

  it("every other model keeps exactly the budget it had", () => {
    expect(ai.completionBudget("groq", "whisper-like-other", 200)).toEqual({ max_tokens: 200 });
    expect(ai.completionBudget("mistral", "ministral-14b-latest", 200)).toEqual({ max_tokens: 200 });
    expect(ai.completionBudget("openai", "gpt-4.1", 200)).toEqual({ max_tokens: 200 });
    expect(ai.completionBudget("openai", "gpt-5.6-luna", 200)).toEqual({ max_completion_tokens: 200, reasoning_effort: "none" });
  });

  it("the request actually sent to Groq carries it", async () => {
    env.GROQ_API_KEY = "k";
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return answer();
    }));
    await ai.structuredCompletionWithFallback({ targets: [G], system: "s", userText: "u", schema: { type: "object" }, toolName: "answer", maxTokens: 24 });
    expect(bodies[0]).toMatchObject({ model: "openai/gpt-oss-20b", max_tokens: 24 + ai.GROQ_REASONING_HEADROOM, reasoning_effort: "low" });
  });
});

describe("a stream is settled when it ends, not when it is accepted", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  const streamOf = (chunks: string[], fail?: Error) => new ReadableStream<Uint8Array>({
    start(c) {
      for (const x of chunks) c.enqueue(enc(x));
      if (fail) c.error(fail); else c.close();
    },
  });
  const frame = (t: string) => `data: {"choices":[{"delta":{"content":"${t}"}}]}\n\n`;

  function settled(stream: ReadableStream<Uint8Array>) {
    const codes: (string | undefined)[] = [];
    const observed = ai.observeStream(stream, (code) => codes.push(code));
    return { observed, codes };
  }

  it("passes every byte through unchanged and settles once, as success, when text arrived", async () => {
    const body = [frame("Hel"), frame("lo"), "data: [DONE]\n\n"];
    const { observed, codes } = settled(streamOf(body));
    expect(await new Response(observed).text()).toBe(body.join(""));
    expect(codes).toEqual([undefined]);
  });

  it("a stream that ends with no text is empty_response — a failure that sets no cooldown", async () => {
    const { observed, codes } = settled(streamOf(['data: {"choices":[{"delta":{"content":""}}]}\n\n', "data: [DONE]\n\n"]));
    await new Response(observed).text();
    expect(codes).toEqual(["empty_response"]);
    expect(ai.COOLDOWN_MS.empty_response).toBeUndefined();
  });

  it("a body that breaks mid-way is stream_interrupted, and the reader sees the error", async () => {
    const { observed, codes } = settled(streamOf([frame("partial")], new Error("reset")));
    await expect(new Response(observed).text()).rejects.toThrow();
    expect(codes).toEqual(["stream_interrupted"]);
    expect(ai.COOLDOWN_MS.stream_interrupted).toBeGreaterThan(0);
  });

  it("a frame split across chunks is still seen as text", async () => {
    const f = frame("word");
    const { observed, codes } = settled(streamOf([f.slice(0, 30), f.slice(30), "data: [DONE]\n\n"]));
    await new Response(observed).text();
    expect(codes).toEqual([undefined]);
  });

  it("a reader that leaves early is not the provider's failure", async () => {
    const { observed, codes } = settled(streamOf([frame("a"), frame("b")]));
    await observed.cancel("client went away");
    expect(codes).toEqual([undefined]);
  });

  it("through the loop: a broken stream cools its target, so the next request starts elsewhere", async () => {
    keys();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new URL(url).host === GROQ
      ? new Response(streamOf([frame("x")], new Error("reset")), { status: 200 })
      : new Response(streamOf([frame("ok"), "data: [DONE]\n\n"]), { status: 200 })));
    const params = { targets: [G, O], system: "s", messages: [{ role: "user" as const, content: "u" }] };
    const first = await ai.streamChatCompletionWithFallback(params);
    expect(first.provider).toBe("groq");
    await expect(new Response(first.result).text()).rejects.toThrow();
    expect(ai.orderTargets([G, O], "chat")).toEqual([O, G]);
  });
});
