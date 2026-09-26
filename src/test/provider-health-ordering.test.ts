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
  ai.setProviderRegistryDemotion(null);
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

describe("the registry: rows an admin or the recorded health has demoted wait their turn", () => {
  it("an injected demotion moves a target after the healthy ones, keeping policy order within each group", () => {
    ai.setProviderRegistryDemotion((t) => t.provider === "groq");
    expect(ai.orderTargets([G, M, O], "chat")).toEqual([M, O, G]);
  });

  it("a demotion hook that throws changes nothing", () => {
    ai.setProviderRegistryDemotion(() => { throw new Error("boom"); });
    expect(ai.orderTargets([G, M, O], "chat")).toEqual([G, M, O]);
  });

  it("inactive and error always demote; degraded or health <= 20 demote except on the recovery share", () => {
    const row = (status: string, health_score: number) => ({ slug: "x", status, health_score });
    const never = () => 0.99; // outside the recovery share
    const trial = () => 0;    // inside it
    expect(sel.registryDemotes(undefined, never)).toBe(false);
    expect(sel.registryDemotes(row("active", 90), never)).toBe(false);
    expect(sel.registryDemotes(row("active", 21), never)).toBe(false);
    expect(sel.registryDemotes(row("active", 20), never)).toBe(true);
    expect(sel.registryDemotes(row("degraded", 80), never)).toBe(true);
    expect(sel.registryDemotes(row("inactive", 100), trial)).toBe(true);
    expect(sel.registryDemotes(row("error", 100), trial)).toBe(true);
    // A health-demoted row keeps its place on the recovery share, so it can earn its way back.
    expect(sel.registryDemotes(row("active", 5), trial)).toBe(false);
    expect(sel.registryDemotes(row("degraded", 5), trial)).toBe(false);
    expect(sel.RECOVERY_TRIAL_SHARE).toBeGreaterThan(0);
    expect(sel.RECOVERY_TRIAL_SHARE).toBeLessThanOrEqual(0.2);
  });
});

describe("registryDemotionFrom: reading the snapshot never holds up a request", () => {
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

  it("answers 'no demotion' until the first read lands, then from the snapshot, by kind", async () => {
    const { db, calls } = fakeDb([
      { slug: "groq-chat", status: "degraded", health_score: 10 },
      { slug: "gemini-vision", status: "inactive", health_score: 50 },
      { slug: "openai-chat", status: "active", health_score: 90 },
    ]);
    const work: Promise<unknown>[] = [];
    const demote = rec.registryDemotionFrom(db, { background: (p) => work.push(p), random: () => 0.99 });

    expect(demote(G, "chat")).toBe(false); // nothing known yet: policy order
    await Promise.all(work);
    expect(calls).toEqual([["ph_providers", "slug, status, health_score", "type", ["chat", "vision"]]]);
    expect(demote(G, "chat")).toBe(true);
    expect(demote(O, "chat")).toBe(false);
    expect(demote({ provider: "gemini", model: "gemini-flash-latest" }, "vision")).toBe(true);
    expect(demote({ provider: "gemini", model: "gemini-flash-latest" }, "chat")).toBe(false); // no chat row in this snapshot
    expect(demote({ provider: "anthropic", model: "x" }, "chat")).toBe(false); // no row at all
  });

  it("refreshes at most once per TTL, one read at a time", async () => {
    let t = 0;
    const { db, calls } = fakeDb([]);
    const work: Promise<unknown>[] = [];
    const demote = rec.registryDemotionFrom(db, { background: (p) => work.push(p), now: () => t });
    demote(G, "chat"); demote(M, "chat"); demote(O, "chat");
    await Promise.all(work);
    expect(calls).toHaveLength(1);
    t += rec.REGISTRY_SNAPSHOT_TTL_MS - 1;
    demote(G, "chat");
    expect(calls).toHaveLength(1);
    t += 2;
    demote(G, "chat");
    await Promise.all(work);
    expect(calls).toHaveLength(2);
  });

  it("a registry that fails or hangs demotes nothing, and the request never waits for it", async () => {
    vi.useFakeTimers();
    for (const opts of [{ fail: true }, { hang: true }]) {
      const { db } = fakeDb(null, opts);
      const work: Promise<unknown>[] = [];
      const demote = rec.registryDemotionFrom(db, { background: (p) => work.push(p) });
      expect(demote(G, "chat")).toBe(false);
      await vi.advanceTimersByTimeAsync(rec.REGISTRY_READ_TIMEOUT_MS + 1);
      await Promise.all(work);
      expect(demote(G, "chat")).toBe(false);
    }
  });
});

describe("wiring", () => {
  it("the entry points that record attempts also install the registry reader, in the same call", () => {
    const src = readFileSync("supabase/functions/_shared/chatRecorder.ts", "utf8");
    expect(src).toMatch(/setProviderAttemptRecorder\(/);
    expect(src).toMatch(/setProviderRegistryDemotion\(registryDemotionFrom\(db\(\), \{ background: waitUntil \}\)\)/);
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
