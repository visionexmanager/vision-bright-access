import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// OpenAI as the reliability backend.
//
// Every chain names OpenAI (assistants.ts, generators.ts, the vision and
// WhatsApp readers). What decides whether a user waits on a failing provider
// first is the order, and the order now reads each model's latest live check
// (ai_model_checks): a model whose check genuinely failed is tried only after
// every model in good standing. These pin that, the fallback on every kind of
// provider failure, the clean error when nothing is left, and that a fallback
// never reaches billing while billing is off.

const env: Record<string, string | undefined> = {
  OPENAI_API_KEY: "sk-test", GROQ_API_KEY: "gsk-test", MISTRAL_API_KEY: "mk-test", GEMINI_API_KEY: "gk-test",
};
const stubDeno = () => vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
stubDeno();

const ai = await import("../../supabase/functions/_shared/aiProvider.ts");
const rec = await import("../../supabase/functions/_shared/providerRecording.ts");
const billing = await import("../../supabase/functions/_shared/vx/billing.ts");

const GROQ = { provider: "groq", model: "openai/gpt-oss-20b" } as const;
const MISTRAL = { provider: "mistral", model: "ministral-14b-latest" } as const;
const OPENAI = { provider: "openai", model: "gpt-4.1" } as const;
const LUNA = { provider: "openai", model: "gpt-5.6-luna" } as const;
const CHAIN = [GROQ, MISTRAL, OPENAI, LUNA];
const key = (t: { provider: string; model: string }) => `${t.provider}/${t.model}`;

const SCHEMA = { type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false };
const tool = (value: unknown) => new Response(JSON.stringify({
  choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(value) } }] } }],
}));
const sse = (text: string) => {
  const encoder = new TextEncoder();
  const events = [`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`, "data: [DONE]\n\n"];
  return new Response(new ReadableStream<Uint8Array>({ start(c) { for (const e of events) c.enqueue(encoder.encode(e)); c.close(); } }));
};
const hostOf = (url: string) => url.includes("groq.com") ? "groq" : url.includes("mistral.ai") ? "mistral" : url.includes("googleapis") ? "gemini" : "openai";

/** Every non-OpenAI host answers with `failing`; OpenAI answers `ok`. */
function fakeFetch(failing: () => Response | Promise<Response>, ok: () => Response) {
  const hosts: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const host = hostOf(String(url));
    hosts.push(host);
    return host === "openai" ? ok() : failing();
  }));
  return hosts;
}

/** A registry view that says only what the live checks say. */
function checksView(failed: Array<{ provider: string; model: string }>, passed: Array<{ provider: string; model: string }> = []) {
  const now = new Date().toISOString();
  const rows = [
    ...failed.map((t) => ({ provider: t.provider, model_id: t.model, passed: false, checked_at: now })),
    ...passed.map((t) => ({ provider: t.provider, model_id: t.model, passed: true, checked_at: now })),
  ];
  return fakeRegistryDb([], rows);
}

/** A client double answering both registry reads: ph_providers and ai_model_checks. */
function fakeRegistryDb(providerRows: unknown[], checkRows: unknown[] | Error) {
  const reads: string[] = [];
  const db = {
    from: (table: string) => ({
      select: () => ({
        in: async () => { reads.push(table); return { data: providerRows }; },
        gte: () => ({
          order: () => ({
            limit: async () => {
              reads.push(table);
              if (checkRows instanceof Error) throw checkRows;
              return { data: checkRows };
            },
          }),
        }),
      }),
    }),
  };
  return { db, reads };
}

async function installView(db: unknown) {
  const work: Promise<unknown>[] = [];
  const view = rec.registryViewFrom(db, { background: (p) => work.push(p), random: () => 0.99 });
  view.verdict(GROQ, "chat"); // the first touch starts the read
  await Promise.all(work);
  ai.setProviderRegistryView(view);
  return view;
}

beforeEach(() => { stubDeno(); ai.resetProviderCooldowns(); ai.setProviderRegistryView(null); });
afterEach(() => { ai.setProviderAttemptRecorder(null); ai.setProviderRegistryView(null); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("latestModelChecks: the verdict the router reads", () => {
  it("keeps each model's latest check, and ignores anything malformed", () => {
    const checks = rec.latestModelChecks([
      { provider: "groq", model_id: "openai/gpt-oss-20b", passed: true, checked_at: "2026-09-27T00:00:00Z" },
      { provider: "groq", model_id: "openai/gpt-oss-20b", passed: false, checked_at: "2026-09-28T00:00:00Z" },
      { provider: "openai", model_id: "gpt-4.1", passed: false, checked_at: "2026-09-27T00:00:00Z" },
      { provider: "openai", model_id: "gpt-4.1", passed: true, checked_at: "2026-09-28T00:00:00Z" },
      { provider: "mistral", model_id: "x", passed: "yes", checked_at: "2026-09-28T00:00:00Z" },
      { provider: "mistral", model_id: "y", passed: false, checked_at: "not a date" },
    ]);
    expect(checks.get("groq/openai/gpt-oss-20b")).toBe(false);
    expect(checks.get("openai/gpt-4.1")).toBe(true);
    expect(checks.has("mistral/x")).toBe(false);
    expect(checks.has("mistral/y")).toBe(false);
  });
});

describe("registryViewFrom: a failed live check demotes the model", () => {
  it("demotes a failed model, keeps a passed or unchecked one in policy order", async () => {
    const { db, reads } = checksView([GROQ], [OPENAI]);
    const view = await installView(db);
    expect(reads.sort()).toEqual(["ai_model_checks", "ph_providers"]);
    expect(view.verdict(GROQ, "chat")).toBe("demoted");
    expect(view.verdict(OPENAI, "chat")).toBe("ready");
    expect(view.verdict(MISTRAL, "chat")).toBe("ready"); // never checked: its policy place stands
  });

  it("a provider an admin switched off stays excluded, whatever its check says", async () => {
    const { db } = fakeRegistryDb([{ slug: "groq-chat", status: "inactive", health_score: 100 }], [
      { provider: "groq", model_id: GROQ.model, passed: true, checked_at: new Date().toISOString() },
    ]);
    const view = await installView(db);
    expect(view.verdict(GROQ, "chat")).toBe("excluded");
  });

  it("a checks read that fails leaves the provider snapshot and the policy order untouched", async () => {
    const { db } = fakeRegistryDb([{ slug: "groq-chat", status: "degraded", health_score: 10 }], new Error("down"));
    const view = await installView(db);
    expect(view.verdict(GROQ, "chat")).toBe("demoted"); // from the provider row, as before
    expect(view.verdict(MISTRAL, "chat")).toBe("ready");
  });

  it("orders a chain with verified OpenAI models first when the others failed their checks", async () => {
    await installView(checksView([GROQ, MISTRAL], [OPENAI, LUNA]).db);
    expect(ai.orderTargets([...CHAIN], "chat").map(key)).toEqual([key(OPENAI), key(LUNA), key(GROQ), key(MISTRAL)]);
  });

  it("with no checks at all, the chain keeps its policy order (a healthy preferred provider stays first)", async () => {
    await installView(checksView([]).db);
    expect(ai.orderTargets([...CHAIN], "chat").map(key)).toEqual(CHAIN.map(key));
  });
});

describe("a failed live check sends the request to OpenAI first", () => {
  it("structured: OpenAI answers without the failed providers ever being called", async () => {
    await installView(checksView([GROQ, MISTRAL]).db);
    const hosts = fakeFetch(() => tool({ answer: "never" }), () => tool({ answer: "ok" }));
    const out = await ai.structuredCompletionWithFallback({ targets: [...CHAIN], system: "s", userText: "u", schema: SCHEMA, toolName: "t" });
    expect(key(out)).toBe(key(OPENAI));
    expect(hosts).toEqual(["openai"]);
  });

  it("a demoted model is still the last resort when every verified one fails at runtime", async () => {
    await installView(checksView([GROQ]).db);
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const host = hostOf(String(url));
      calls.push(host);
      return host === "groq" ? tool({ answer: "from groq" }) : new Response("{}", { status: 500 });
    }));
    const out = await ai.structuredCompletionWithFallback({ targets: [GROQ, OPENAI], system: "s", userText: "u", schema: SCHEMA, toolName: "t" });
    expect(out.provider).toBe("groq");
    expect(calls).toEqual(["openai", "groq"]);
  });
});

describe("a fresh function instance: the first request waits for the verdicts", () => {
  // Production, 2026-09-28: three chats on fresh instances each tried the
  // failed gpt-oss-20b first, because the verdicts were read in the background.
  function slowDb(checkRows: unknown[], delayMs: number) {
    const later = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), delayMs));
    return {
      from: () => ({
        select: () => ({
          in: () => later({ data: [] }),
          gte: () => ({ order: () => ({ limit: () => later({ data: checkRows }) }) }),
        }),
      }),
    };
  }

  it("never calls a model whose check failed, even on the instance's first request", async () => {
    const view = rec.registryViewFrom(slowDb([{ provider: "groq", model_id: GROQ.model, passed: false, checked_at: new Date().toISOString() }], 20), {});
    ai.setProviderRegistryView(view); // no pre-read: exactly a cold instance
    const hosts = fakeFetch(() => tool({ answer: "groq" }), () => tool({ answer: "openai" }));
    const out = await ai.structuredCompletionWithFallback({ targets: [GROQ, OPENAI], system: "s", userText: "u", schema: SCHEMA, toolName: "t" });
    expect(key(out)).toBe(key(OPENAI));
    expect(hosts).toEqual(["openai"]);
  });

  it("the same for a stream", async () => {
    const view = rec.registryViewFrom(slowDb([{ provider: "groq", model_id: GROQ.model, passed: false, checked_at: new Date().toISOString() }], 20), {});
    ai.setProviderRegistryView(view);
    const hosts = fakeFetch(() => sse("from groq"), () => sse("from openai"));
    const out = await ai.streamChatCompletionWithFallback({ targets: [GROQ, OPENAI], system: "s", messages: [{ role: "user", content: "hi" }] });
    expect(key(out)).toBe(key(OPENAI));
    expect(hosts).toEqual(["openai"]);
  });

  it("waits once: after the first snapshot, ready() resolves at once", async () => {
    const view = rec.registryViewFrom(slowDb([], 20), {});
    await view.ready();
    let settled = false;
    void view.ready().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(true);
  });

  it("a verdict read that fails does not hold the request: policy order, at once", async () => {
    const failing = { from: () => ({ select: () => ({ in: () => Promise.reject(new Error("down")), gte: () => { throw new Error("down"); } }) }) };
    const view = rec.registryViewFrom(failing, {});
    ai.setProviderRegistryView(view);
    const hosts = fakeFetch(() => tool({ answer: "groq" }), () => tool({ answer: "openai" }));
    const out = await ai.structuredCompletionWithFallback({ targets: [GROQ, OPENAI], system: "s", userText: "u", schema: SCHEMA, toolName: "t" });
    expect(out.provider).toBe("groq");
    expect(hosts).toEqual(["groq"]);
  });
});

describe("runtime failure of the preferred provider falls back to OpenAI", () => {
  const FAILURES: Array<[string, () => Response | Promise<Response>]> = [
    ["401", () => new Response("{}", { status: 401 })],
    ["403", () => new Response("{}", { status: 403 })],
    ["404", () => new Response("{}", { status: 404 })],
    ["408", () => new Response("{}", { status: 408 })],
    ["429", () => new Response("{}", { status: 429 })],
    ["500", () => new Response("{}", { status: 500 })],
    ["503", () => new Response("{}", { status: 503 })],
    ["malformed body", () => new Response("not json at all", { status: 200 })],
    ["no tool call", () => new Response(JSON.stringify({ choices: [{ message: { content: "prose" } }] }))],
    ["missing required field", () => tool({ other: 1 })],
  ];
  for (const [name, failing] of FAILURES) {
    it(`structured, preferred answers ${name}: OpenAI answers`, async () => {
      const attempts: Array<{ provider: string; success: boolean; error?: string }> = [];
      ai.setProviderAttemptRecorder((a) => attempts.push({ provider: a.provider, success: a.success, error: a.error }));
      fakeFetch(failing, () => tool({ answer: "ok" }));
      const out = await ai.structuredCompletionWithFallback({ targets: [GROQ, OPENAI], system: "s", userText: "u", schema: SCHEMA, toolName: "t" });
      expect(key(out)).toBe(key(OPENAI));
      expect(out.result).toEqual({ answer: "ok" });
      expect(attempts[0]).toMatchObject({ provider: "groq", success: false });
      expect(attempts.at(-1)).toMatchObject({ provider: "openai", success: true });
    });
  }

  for (const status of [401, 403, 404, 408, 429, 500]) {
    it(`stream, preferred answers ${status}: OpenAI streams the answer`, async () => {
      fakeFetch(() => new Response("{}", { status }), () => sse("Hello from OpenAI."));
      const out = await ai.streamChatCompletionWithFallback({ targets: [GROQ, OPENAI], system: "s", messages: [{ role: "user", content: "hi" }] });
      expect(key(out)).toBe(key(OPENAI));
      expect(await new Response(out.result).text()).toContain("Hello from OpenAI.");
    });
  }

  it("stream, preferred ends before any text: OpenAI answers", async () => {
    fakeFetch(() => new Response("data: [DONE]\n\n"), () => sse("Hello from OpenAI."));
    const out = await ai.streamChatCompletionWithFallback({ targets: [GROQ, OPENAI], system: "s", messages: [{ role: "user", content: "hi" }] });
    expect(key(out)).toBe(key(OPENAI));
  });

  it("timeout: a preferred provider that never answers is abandoned for OpenAI", async () => {
    fakeFetch(() => new Promise<Response>(() => undefined), () => tool({ answer: "ok" }));
    const out = await ai.structuredCompletionWithFallback({
      targets: [GROQ, OPENAI], system: "s", userText: "u", schema: SCHEMA, toolName: "t", attemptTimeoutMs: 50,
    });
    expect(key(out)).toBe(key(OPENAI));
  });

  it("timeout on a stream's first text: OpenAI answers", async () => {
    fakeFetch(() => new Promise<Response>(() => undefined), () => sse("Hello from OpenAI."));
    const out = await ai.streamChatCompletionWithFallback({
      targets: [GROQ, OPENAI], system: "s", messages: [{ role: "user", content: "hi" }], attemptTimeoutMs: 50,
    });
    expect(key(out)).toBe(key(OPENAI));
  });
});

describe("no suitable fallback: a clean error, never a fake answer", () => {
  it("every provider fails: the chain throws a ProviderError", async () => {
    fakeFetch(() => new Response("{}", { status: 500 }), () => new Response("{}", { status: 500 }));
    await expect(ai.structuredCompletionWithFallback({ targets: [GROQ, OPENAI], system: "s", userText: "u", schema: SCHEMA, toolName: "t" }))
      .rejects.toBeInstanceOf(ai.ProviderError);
  });

  it("every target parked: 503 before any request is sent", async () => {
    const hosts = fakeFetch(() => tool({}), () => tool({}));
    const parked = { provider: "gemini", model: "gemini-flash-latest" } as const; // PAUSED_MODELS
    await expect(ai.structuredCompletionWithFallback({ targets: [parked], system: "s", userText: "u", schema: SCHEMA, toolName: "t" }))
      .rejects.toMatchObject({ status: 503 });
    expect(hosts).toEqual([]);
  });
});

describe("observability", () => {
  it("logs which model answered, on which attempt, and whether it was a fallback — ids only", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fakeFetch(() => new Response("{}", { status: 429 }), () => tool({ answer: "ok" }));
    await ai.structuredCompletionWithFallback({ targets: [GROQ, OPENAI], system: "secret system prompt", userText: "u", schema: SCHEMA, toolName: "t" });
    const line = info.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith("[ai-route]"));
    expect(line).toMatch(/^\[ai-route\] chat\/structured answered=openai\/gpt-4\.1 attempt=2 fallback=true ms=\d+$/);
    expect(line).not.toMatch(/sk-|secret|usd|cost|price/i);
  });
});

describe("the live probe that writes the checks", () => {
  const probe = readFileSync("scripts/ai-eval/live-route-contract.ts", "utf8");
  const verdictBlock = probe.slice(probe.indexOf("const checksOut = Deno.env.get(\"MODEL_CHECKS_OUT\")"));

  it("never counts a rate-limited row against a model", () => {
    expect(probe).toContain('if (error === "http_429" || (!pass && runAttempts.length > 0 && runAttempts.every((c) => c === "http_429"))) row.rateLimited = true;');
    expect(verdictBlock).toContain("if (r.rateLimited) continue;");
  });

  it("sees a 429 that a helper swallowed: one global recorder, each run's attempts reset", () => {
    // understandImage/understandDocument answer "not readable" instead of
    // throwing, so the row's own error is empty; its attempts say 429.
    expect(probe.match(/setProviderAttemptRecorder\(/g)).toHaveLength(1);
    expect(probe).toMatch(/async function run\(route: string, target: ProviderTarget, fn: \(\) => Promise<Record<string, boolean>>\) \{\s+await pace\(target\.provider\);\s+runAttempts = \[\];/);
    expect(probe).not.toContain("setProviderAttemptRecorder(null)");
  });

  it("judges the vision analyst by the keys the page renders, not by non-empty lists", () => {
    expect(probe).toContain("VISION_SCHEMA.required.every((k) => r[k] !== undefined && r[k] !== null)");
  });

  it("never certifies a model from a row that proved a chain or the router", () => {
    expect(verdictBlock).toContain("if (CHAIN_ROUTE.test(r.route)) continue;");
    const CHAIN_ROUTE = /^(chain |router |fallback )/;
    for (const route of ["chain generator travel-itinerary (ar)", "chain site assistant (ar)", "router skips parked flash-latest", "fallback past a refused model"]) {
      expect(CHAIN_ROUTE.test(route), route).toBe(true);
    }
    for (const route of ["adapter stream", "vision ar", "stt en", "image generation", "whatsapp image"]) {
      expect(CHAIN_ROUTE.test(route), route).toBe(false);
    }
    expect(probe).toContain("const CHAIN_ROUTE = /^(chain |router |fallback )/;");
  });

  it("paces the free-tier providers so it does not rate-limit itself", () => {
    expect(probe).toMatch(/fn: \(\) => Promise<Record<string, boolean>>\) \{\s+await pace\(target\.provider\);/);
    expect(probe).toContain("const PACE_MS: Partial<Record<string, number>> = { groq: 2_500, gemini: 4_500, mistral: 1_200 };");
  });

  it("proves every OpenAI capability a service relies on", () => {
    for (const route of ["vision ${lang}", "tts ${lang} (whatsapp voice)", "tts en (speech-generate)", "stt ${lang}", "image generation",
      "image edit (transparent background)", "embeddings", "realtime session"]) {
      expect(probe, route).toContain(route);
    }
  });

  it("prints limits as figures only, never a key or a body", () => {
    const k = probe.slice(probe.indexOf("// ── K."), probe.indexOf("// ── L."));
    expect(k).toContain('.replace(/[^0-9.a-z]/gi, "")');
    expect(k).not.toMatch(/console\.log\([^)]*(API_KEY|Authorization|gBody\))/);
  });

  it("runs daily on main, and records only from main", () => {
    const wf = readFileSync(".github/workflows/live-route-contract.yml", "utf8");
    expect(wf).toContain('- cron: "41 5 * * *"');
    expect(wf).toContain("if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'");
  });
});

describe("billing stays off when a request falls back", () => {
  it("a disabled service runs in shadow: a fallback reserves nothing, settles nothing, charges nothing", async () => {
    const rpcs: string[] = [];
    const db = {
      from: () => ({ select: async () => ({ data: [{ service_id: "ai_chat", enabled: false, pricing_mode: "metered" }], error: null }), insert: async () => ({ error: null }) }),
      rpc: async (fn: string) => { rpcs.push(fn); return { data: null, error: null }; },
    };
    billing.resetBillingCaches();
    fakeFetch(() => new Response("{}", { status: 429 }), () => tool({ answer: "ok" }));
    const out = await billing.billedRequest(db, {
      serviceId: "ai_chat", userId: "u1", source: "website", idempotencyKey: "ai-chat:u1:abcdefgh",
      targets: [GROQ, OPENAI], bound: { input_tokens: 10, output_tokens: 10 },
    }, async ({ reservationId }) => ({
      value: await ai.structuredCompletionWithFallback({
        targets: [GROQ, OPENAI], system: "s", userText: "u", schema: SCHEMA, toolName: "t", ...(reservationId ? { reservationId } : {}),
      }),
    }));
    expect(out.status).toBe("shadow");
    expect(rpcs).toEqual([]);
  });
});
