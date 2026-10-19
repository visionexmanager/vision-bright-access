import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression tests for the places a fallback chain's usage records could go wrong
// that ai-usage-streaming.test.ts does not drive: a first-text timeout, an open that
// never answers, a usage sink that throws, malformed usage in a stream, and one
// event per attempt. Mocked providers, synthetic data. Nothing here sets a price or
// a charging rule; where the design leaves a gap the test says so ("CURRENT
// BEHAVIOUR") instead of inventing a policy.

const env: Record<string, string | undefined> = { OPENAI_API_KEY: "sk-test", GROQ_API_KEY: "gsk-test", MISTRAL_API_KEY: "m-test", GEMINI_API_KEY: "g-test" };
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

const ai = await import("../../supabase/functions/_shared/aiProvider.ts");
type UsageEvent = import("../../supabase/functions/_shared/metering.ts").UsageEvent;

const enc = new TextEncoder();
const data = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
const delta = (text: string, extra: Record<string, unknown> = {}) => data({ model: "gpt-test", choices: [{ delta: { content: text } }], ...extra });
const streamOf = (parts: string[]) => new ReadableStream<Uint8Array>({ start(c) { for (const p of parts) c.enqueue(enc.encode(p)); c.close(); } });
const sse = (parts: string[]) => new Response(streamOf(parts), { headers: { "content-type": "text/event-stream" } });
const silent = () => new Response(new ReadableStream<Uint8Array>({ start() { /* opens, never speaks */ } }), { headers: { "content-type": "text/event-stream" } });
const readAll = async (s: ReadableStream<Uint8Array>) => {
  const r = s.getReader(); const d = new TextDecoder(); let out = "";
  for (;;) { const { done, value } = await r.read(); if (done) return out + d.decode(); out += d.decode(value, { stream: true }); }
};
const sink = () => { const events: UsageEvent[] = []; ai.setUsageSink((e) => events.push(e)); return events; };
const USAGE = { prompt_tokens: 20, completion_tokens: 7, total_tokens: 27 };
const targets = [{ provider: "openai" as const, model: "gpt-4.1" }, { provider: "openai" as const, model: "gpt-4o-mini" }];
const run = (extra: Record<string, unknown> = {}) =>
  ai.streamChatCompletionWithFallback({ targets, system: "s", messages: [{ role: "user", content: "hello" }], ...extra });

beforeEach(() => vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } }));
afterEach(() => { ai.setUsageSink(null); ai.resetProviderCooldowns(); vi.unstubAllGlobals(); vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } }); });

describe("timeouts inside a chain", () => {
  it("an attempt that opens but says nothing before the deadline is abandoned, reported once, and the next target answers", async () => {
    const events = sink();
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (call++ === 0 ? silent() : sse([delta("fine"), data({ choices: [], usage: USAGE }), "data: [DONE]\n\n"]))));
    const { result, model } = await run({ attemptTimeoutMs: 30 });
    await readAll(result);
    expect(model).toBe("gpt-4o-mini");
    expect(events.map((e) => [e.model, e.outcome, e.attempt])).toEqual([["gpt-4.1", "error", 1], ["gpt-4o-mini", "ok", 2]]);
    expect(events[0].error_code).toBe("stream_cancelled");
    expect(events[1].chain_id).toBe(events[0].chain_id);
  });

  it("an attempt that is abandoned reports exactly one event even if the reader is cancelled again", async () => {
    const events = sink();
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (call++ === 0 ? silent() : sse([delta("fine"), "data: [DONE]\n\n"]))));
    const { result } = await run({ attemptTimeoutMs: 30 });
    await readAll(result);
    expect(events.filter((e) => e.model === "gpt-4.1")).toHaveLength(1);
  });

  it("every target silent: the request fails and each abandoned attempt is still reported once", async () => {
    const events = sink();
    vi.stubGlobal("fetch", vi.fn(async () => silent()));
    await expect(run({ attemptTimeoutMs: 30 })).rejects.toBeTruthy();
    expect(events.map((e) => [e.model, e.outcome, e.attempt])).toEqual([["gpt-4.1", "error", 1], ["gpt-4o-mini", "error", 2]]);
    expect(new Set(events.map((e) => e.chain_id)).size).toBe(1);
  });

  it("CURRENT BEHAVIOUR: an open that never answers is abandoned at the deadline and produces NO event for that attempt", async () => {
    const events = sink();
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(() => (call++ === 0
      ? new Promise<Response>(() => { /* never settles */ })
      : Promise.resolve(sse([delta("fine"), "data: [DONE]\n\n"])))));
    const { result, model } = await run({ attemptTimeoutMs: 30 });
    await readAll(result);
    expect(model).toBe("gpt-4o-mini");
    // The provider may still have started work for attempt 1; nothing records it.
    expect(events.map((e) => [e.model, e.attempt])).toEqual([["gpt-4o-mini", 2]]);
  });
});

describe("recording never reaches the answer", () => {
  it("a usage sink that throws on every event does not break the chain or the stream", async () => {
    ai.setUsageSink(() => { throw new Error("sink down"); });
    vi.stubGlobal("fetch", vi.fn(async () => sse([delta("still answered"), "data: [DONE]\n\n"])));
    const { result } = await run();
    expect(await readAll(result)).toContain("still answered");
  });
});

describe("malformed usage in a stream", () => {
  it("negative, non-numeric and absurd counts never become a negative or non-finite number on the event", async () => {
    const events = sink();
    vi.stubGlobal("fetch", vi.fn(async () => sse([
      delta("x"),
      data({ choices: [], usage: { prompt_tokens: -5, completion_tokens: "lots", total_tokens: Number.NaN } }),
      "data: [DONE]\n\n",
    ])));
    await readAll(await ai.streamChatCompletion({ provider: "openai", model: "gpt-4.1", system: "s", messages: [{ role: "user", content: "hi" }], maxTokens: 50 }));
    const usage = events[0].usage as Record<string, unknown>;
    for (const v of Object.values(usage)) {
      expect(typeof v === "number" && Number.isFinite(v) && v >= 0).toBe(true);
    }
  });

  it("a usage object that is not an object is ignored and the call is estimated, not zero", async () => {
    const events = sink();
    vi.stubGlobal("fetch", vi.fn(async () => sse([delta("some words here"), data({ choices: [], usage: "garbage" }), "data: [DONE]\n\n"])));
    await readAll(await ai.streamChatCompletion({ provider: "openai", model: "gpt-4.1", system: "s", messages: [{ role: "user", content: "hi" }], maxTokens: 50 }));
    expect(events[0]).toMatchObject({ outcome: "ok", usage_source: "estimated" });
    expect((events[0].usage as { output_tokens: number }).output_tokens).toBeGreaterThan(0);
  });
});

describe("one event per attempt", () => {
  it("an answered stream reports once when read to the end, and not again when the reader is cancelled afterwards", async () => {
    const events = sink();
    vi.stubGlobal("fetch", vi.fn(async () => sse([delta("done"), data({ choices: [], usage: USAGE }), "data: [DONE]\n\n"])));
    const s = await ai.streamChatCompletion({ provider: "openai", model: "gpt-4.1", system: "s", messages: [{ role: "user", content: "hi" }], maxTokens: 50 });
    const r = s.getReader();
    while (!(await r.read()).done) { /* drain */ }
    await r.cancel().catch(() => undefined);
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe("ok");
  });
});
