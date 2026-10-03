import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// Metering PR 3: the provider calls outside aiProvider.ts — images, speech,
// transcription, moderation and the functions that call OpenAI directly — go
// through meteredFetch, which behaves exactly like fetch and reports what each
// call used on the side.

const { meteredFetch } = await import("../../supabase/functions/_shared/meteredFetch.ts");
const sinkMod = await import("../../supabase/functions/_shared/usageSink.ts");
const m = await import("../../supabase/functions/_shared/metering.ts");
type UsageEvent = import("../../supabase/functions/_shared/metering.ts").UsageEvent;

const enc = new TextEncoder();
const flush = () => new Promise((r) => setTimeout(r, 0));
const sink = () => { const events: UsageEvent[] = []; sinkMod.setUsageSink((e) => events.push(e)); return events; };
const sent: Array<{ url: string; body: unknown }> = [];
function stubFetch(respond: (url: string) => Response) {
  sent.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    sent.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body });
    return respond(url);
  }));
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const post = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

afterEach(() => { sinkMod.setUsageSink(null); vi.unstubAllGlobals(); });

describe("meteredFetch is fetch for the caller", () => {
  it("returns the provider's Response untouched — the caller still reads its body", async () => {
    sink();
    stubFetch(() => json({ model: "gpt-4o-2024-08-06", choices: [{ message: { content: "hi" } }], usage: { prompt_tokens: 3, completion_tokens: 1 } }));
    const res = await meteredFetch("https://api.openai.com/v1/chat/completions", post({ model: "gpt-4o", messages: [] }));
    expect((await res.json()).choices[0].message.content).toBe("hi");
  });

  it("any other host or path is plain fetch: nothing reported", async () => {
    const events = sink();
    stubFetch(() => json({ ok: true }));
    await meteredFetch("https://api.lumalabs.ai/dream-machine/v1/generations", post({ model: "ray-2" }));
    await meteredFetch("https://api.openai.com/v1/models", { method: "GET" });
    await meteredFetch("https://api.openai.com/v1/realtime/client_secrets", post({ session: { model: "gpt-realtime-2" } }));
    await flush();
    expect(events).toEqual([]);
  });

  it("a failed call is reported with its status and returned as is", async () => {
    const events = sink();
    stubFetch(() => json({ error: {} }, 429));
    const res = await meteredFetch("https://api.openai.com/v1/chat/completions", post({ model: "gpt-4o", messages: [] }));
    expect(res.status).toBe(429);
    expect(events).toEqual([{ operation: "chat", provider: "openai", model: "gpt-4o", outcome: "error", error_code: "http_429", usage_source: "missing" }]);
  });

  it("a network failure is reported and rethrown", async () => {
    const events = sink();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await expect(meteredFetch("https://api.openai.com/v1/moderations", post({ model: "omni-moderation-latest", input: "x" }))).rejects.toThrow("offline");
    expect(events[0]).toMatchObject({ operation: "moderation", outcome: "error", error_code: "network" });
  });

  it("a sink that throws never reaches the caller", async () => {
    sinkMod.setUsageSink(() => { throw new Error("boom"); });
    stubFetch(() => json({ usage: { prompt_tokens: 1 } }));
    await expect(meteredFetch("https://api.openai.com/v1/chat/completions", post({ model: "gpt-4o", messages: [] }))).resolves.toBeInstanceOf(Response);
  });
});

describe("usage by endpoint", () => {
  it("chat: the provider's tokens and the concrete model", async () => {
    const events = sink();
    stubFetch(() => json({ model: "gpt-4o-2024-08-06", usage: { prompt_tokens: 30, completion_tokens: 9, total_tokens: 39 } }));
    await meteredFetch("https://api.openai.com/v1/chat/completions", post({ model: "gpt-4o", messages: [] }));
    await flush();
    expect(events).toEqual([{
      operation: "chat", provider: "openai", model: "gpt-4o", resolved_model: "gpt-4o-2024-08-06", outcome: "ok",
      usage: { input_tokens: 30, output_tokens: 9, total_tokens: 39 }, usage_source: "reported",
    }]);
  });

  it("chat stream: include_usage asked for, the usage chunk read and removed", async () => {
    const events = sink();
    const body = [
      `data: ${JSON.stringify({ model: "gpt-4o-2024-08-06", choices: [{ delta: { content: "مرحبا" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } })}\n\n`,
      "data: [DONE]\n\n",
    ];
    stubFetch(() => new Response(new ReadableStream({ start(c) { for (const p of body) c.enqueue(enc.encode(p)); c.close(); } })));
    const res = await meteredFetch("https://api.openai.com/v1/chat/completions", post({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }], stream: true }));
    expect((sent[0].body as Record<string, unknown>).stream_options).toEqual({ include_usage: true });
    const text = await res.text();
    expect(text).toContain("مرحبا");
    expect(text).not.toContain('"choices":[]');
    expect(events[0]).toMatchObject({ operation: "stream", outcome: "ok", usage: { input_tokens: 12, output_tokens: 3 }, usage_source: "reported" });
  });

  it("image: text and image input apart, image output, images returned", async () => {
    const events = sink();
    stubFetch(() => json({
      data: [{ b64_json: "AAAA" }],
      usage: { input_tokens: 50, input_tokens_details: { text_tokens: 20, image_tokens: 30 }, output_tokens: 272, total_tokens: 322 },
    }));
    await meteredFetch("https://api.openai.com/v1/images/generations", post({ model: "gpt-image-1", prompt: "p" }));
    await flush();
    expect(events[0]).toMatchObject({
      operation: "image", model: "gpt-image-1", usage_source: "reported",
      usage: { input_tokens: 50, image_input_tokens: 30, output_tokens: 272, total_tokens: 322, images: 1 },
    });
  });

  it("transcription: whisper's duration, a duration usage, or the gpt-4o family's tokens", async () => {
    const events = sink();
    const form = (model: string) => { const f = new FormData(); f.append("model", model); f.append("file", new Blob(["x"]), "a.mp3"); return f; };
    const replies = [
      json({ text: "hi", duration: 12.5 }),
      json({ text: "hi", usage: { type: "duration", seconds: 7 } }),
      json({ text: "hi", usage: { type: "tokens", input_tokens: 40, output_tokens: 5, total_tokens: 45 } }),
    ];
    let i = 0;
    vi.stubGlobal("fetch", vi.fn(async () => replies[i++]));
    await meteredFetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", body: form("whisper-1") });
    await meteredFetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", body: form("whisper-large-v3-turbo") });
    await meteredFetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", body: form("gpt-4o-transcribe") });
    await flush();
    expect(events.map((e) => [e.provider, e.model, e.usage])).toEqual([
      ["openai", "whisper-1", { seconds: 12.5 }],
      ["groq", "whisper-large-v3-turbo", { seconds: 7 }],
      ["openai", "gpt-4o-transcribe", { input_tokens: 40, output_tokens: 5, total_tokens: 45 }],
    ]);
  });

  it("speech: the characters sent, counted as characters (not UTF-16 units), without reading the audio", async () => {
    const events = sink();
    const audio = new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } });
    stubFetch(() => audio);
    const res = await meteredFetch("https://api.openai.com/v1/audio/speech", post({ model: "tts-1", input: "مرحبا 👋", voice: "alloy" }));
    await flush();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(events[0]).toMatchObject({ operation: "tts", model: "tts-1", usage: { characters: 7 }, usage_source: "reported" });
  });

  it("moderation: reported, with no usage to read — the free price makes it free", async () => {
    const events = sink();
    stubFetch(() => json({ results: [{ flagged: false }] }));
    await meteredFetch("https://api.openai.com/v1/moderations", post({ model: "omni-moderation-latest", input: "x" }));
    await flush();
    expect(events[0]).toMatchObject({ operation: "moderation", outcome: "ok", usage_source: "missing" });
    const free = { id: 9, provider: "openai", model_id: "omni-moderation-latest", unit: "free" as const, rates: {}, effective_from: "2026-01-01T00:00:00Z", effective_to: null };
    expect(m.costOf(events[0].usage, free)).toEqual({ status: "free", cost_usd: 0, price_id: 9 });
  });
});

describe("costOf with image input priced apart", () => {
  const img = { id: 1, provider: "openai", model_id: "gpt-image-1", unit: "usd_per_1m_tokens" as const,
    rates: { input: 5, cached_input: 1.25, image_input: 10, output: 40 }, effective_from: "2026-01-01T00:00:00Z", effective_to: null };

  it("text at the text rate, image input at the image rate, output at the output rate", () => {
    // (20×5 + 30×10 + 272×40) / 1e6
    expect(m.costOf({ input_tokens: 50, image_input_tokens: 30, output_tokens: 272 }, img)).toMatchObject({ status: "priced", cost_usd: 0.01128 });
  });

  it("image tokens with no image rate are unpriced, not charged at the text rate", () => {
    expect(m.costOf({ input_tokens: 50, image_input_tokens: 30 }, { ...img, rates: { input: 5, output: 40 } }))
      .toMatchObject({ status: "unpriced", reason: "no image input rate" });
  });

  it("speech priced per token but reported in characters stays unpriced — never guessed", () => {
    const tts = { ...img, model_id: "gpt-4o-mini-tts", rates: { input: 0.6, output: 12 } };
    expect(m.costOf({ characters: 120 }, tts)).toMatchObject({ status: "unpriced", reason: "usage has no token counts" });
  });
});

describe("call sites", () => {
  const read = (p: string) => readFileSync(`supabase/functions/${p}`, "utf8");

  it("no function calls an OpenAI generation endpoint with bare fetch any more", () => {
    for (const fn of ["academy-chat", "analyze-meal", "analytics-insights", "enrich-product", "generate-diet-plan",
      "news-generate", "radar-ai", "moderate-content", "image-generate"]) {
      const src = read(`${fn}/index.ts`);
      expect(src, fn).not.toMatch(/(?<!metered)[Ff]etch\(\s*"https:\/\/api\.openai\.com/);
      expect(src, fn).toMatch(/meteredFetch\("https:\/\/api\.openai\.com/);
    }
  });

  it("ocr-scan goes through the provider chain, never a bare OpenAI fetch", () => {
    const src = read("ocr-scan/index.ts");
    expect(src).not.toContain("api.openai.com");
    expect(src).toContain("structuredCompletionWithFallback(");
  });

  it("speech, transcription and generated media default to meteredFetch", () => {
    expect(read("_shared/voice/tts.ts")).toContain("(request.fetchImpl ?? meteredFetch)(url, init)");
    expect(read("_shared/voice/providers/whisper.ts")).toContain("(input.fetchImpl ?? meteredFetch)(config.endpoint");
    expect(read("_shared/ownerContentActions.ts")).toContain("fetchImpl: typeof fetch = meteredFetch,");
    expect(read("kids-drawing-to-art/index.ts")).toContain("fetchImpl: meteredFetch,");
    expect(read("kids-story-generate/index.ts")).toContain("fetchImpl: meteredFetch,");
  });
});
