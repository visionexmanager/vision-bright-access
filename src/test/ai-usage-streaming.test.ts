import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Streaming usage (metering PR 2). A stream's token counts arrive in its last
// event — OpenAI and Groq only when asked (include_usage), Mistral always, our
// Gemini transform always. The meter reads them on the way through, removes
// the usage-only chunk so no client ever sees it, and reports each stream once
// when it ends. A stream that ends without counts is estimated, and says so.

const env: Record<string, string | undefined> = {
  OPENAI_API_KEY: "sk-test", GROQ_API_KEY: "gsk-test", MISTRAL_API_KEY: "m-test", GEMINI_API_KEY: "g-test",
};
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

const ai = await import("../../supabase/functions/_shared/aiProvider.ts");
const su = await import("../../supabase/functions/_shared/streamUsage.ts");
type UsageEvent = import("../../supabase/functions/_shared/metering.ts").UsageEvent;
type StreamUsageSeen = import("../../supabase/functions/_shared/streamUsage.ts").StreamUsageSeen;

const enc = new TextEncoder();
const streamOf = (parts: string[]) => new ReadableStream<Uint8Array>({
  start(c) { for (const p of parts) c.enqueue(enc.encode(p)); c.close(); },
});
const readAll = async (s: ReadableStream<Uint8Array>) => {
  const r = s.getReader(); const d = new TextDecoder(); let out = "";
  for (;;) { const { done, value } = await r.read(); if (done) return out + d.decode(); out += d.decode(value, { stream: true }); }
};
const data = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
const delta = (text: string, extra: Record<string, unknown> = {}) => data({ model: "gpt-4.1-2025-04-14", choices: [{ delta: { content: text } }], ...extra });
const USAGE = { prompt_tokens: 20, completion_tokens: 7, total_tokens: 27, prompt_tokens_details: { cached_tokens: 4 } };

beforeEach(() => vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } }));
afterEach(() => { ai.setUsageSink(null); ai.resetProviderCooldowns(); });

describe("meterSseStream", () => {
  const meter = (parts: string[]) => {
    const ends: StreamUsageSeen[] = [];
    return { out: su.meterSseStream(streamOf(parts), (s) => ends.push(s)), ends };
  };

  it("hands on every byte of the answer and removes only the usage-only chunk", async () => {
    const { out, ends } = meter([delta("Hel"), delta("lo"), data({ choices: [], usage: USAGE }), "data: [DONE]\n\n"]);
    const text = await readAll(out);
    expect(text).toContain(delta("Hel"));
    expect(text).toContain(delta("lo"));
    expect(text).toContain("data: [DONE]");
    expect(text).not.toContain('"choices":[]');
    expect(text).not.toContain("prompt_tokens");
    expect(ends).toEqual([{ usage: USAGE, model: "gpt-4.1-2025-04-14", outputBytes: 5, end: "done" }]);
  });

  it("keeps a final chunk that carries both an answer and usage (Mistral), and reads its counts", async () => {
    const last = data({ model: "ministral-14b-2512", choices: [{ delta: { content: "!" }, finish_reason: "stop" }], usage: USAGE });
    const { out, ends } = meter([delta("Hi"), last]);
    expect(await readAll(out)).toContain(last);
    expect(ends[0]).toMatchObject({ usage: USAGE, model: "ministral-14b-2512", outputBytes: 3 });
  });

  it("reads Groq's x_groq.usage", async () => {
    const { out, ends } = meter([data({ choices: [{ delta: {} , finish_reason: "stop" }], x_groq: { usage: USAGE } })]);
    await readAll(out);
    expect(ends[0].usage).toEqual(USAGE);
  });

  it("counts answer bytes in UTF-8, so Arabic is not under-counted", async () => {
    const { out, ends } = meter([delta("مرحبا")]);
    await readAll(out);
    expect(ends[0].outputBytes).toBe(10);
  });

  it("survives an event split across network chunks, and a last line with no newline", async () => {
    const usageLine = data({ choices: [], usage: USAGE }).trimEnd(); // no trailing newline at all
    const whole = delta("abc");
    const { out, ends } = meter([whole.slice(0, 9), whole.slice(9), usageLine]);
    const text = await readAll(out);
    expect(text).toBe(whole);
    expect(ends[0]).toMatchObject({ usage: USAGE, outputBytes: 3, end: "done" });
  });

  it("passes on lines it does not understand, untouched", async () => {
    const { out } = meter([": keep-alive\n", "data: not json\n\n", delta("x")]);
    expect(await readAll(out)).toBe(`: keep-alive\ndata: not json\n\n${delta("x")}`);
  });

  it("a reader that cancels ends it as cancelled, once", async () => {
    const ends: StreamUsageSeen[] = [];
    const src = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc.encode(delta("partial"))); } }); // never closes
    const r = su.meterSseStream(src, (s) => ends.push(s)).getReader();
    await r.read();
    await r.cancel();
    await r.cancel().catch(() => undefined);
    expect(ends).toEqual([{ model: "gpt-4.1-2025-04-14", outputBytes: 7, end: "cancelled" }]);
  });

  it("a stream that breaks ends as an error, and the reader sees the error", async () => {
    const ends: StreamUsageSeen[] = [];
    let n = 0;
    const src = new ReadableStream<Uint8Array>({
      pull(c) { if (n++ === 0) c.enqueue(enc.encode(delta("a"))); else c.error(new Error("reset")); },
    });
    await expect(readAll(su.meterSseStream(src, (s) => ends.push(s)))).rejects.toThrow("reset");
    expect(ends).toEqual([{ model: "gpt-4.1-2025-04-14", outputBytes: 1, end: "error" }]);
  });

  it("an onEnd that throws never reaches the reader", async () => {
    const out = su.meterSseStream(streamOf([delta("ok")]), () => { throw new Error("boom"); });
    await expect(readAll(out)).resolves.toBe(delta("ok"));
  });
});

// ── Through the adapter ─────────────────────────────────────────────────────

type Sent = { url: string; body: Record<string, unknown> };
function captureFetch(respond: (i: number) => Response): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) });
    return respond(sent.length - 1);
  }));
  return sent;
}
const sse = (parts: string[]) => new Response(streamOf(parts), { headers: { "content-type": "text/event-stream" } });
const sink = () => { const events: UsageEvent[] = []; ai.setUsageSink((e) => events.push(e)); return events; };
const chat = (provider: "openai" | "groq" | "mistral" | "gemini", model: string) => ({
  provider, model, system: "You are helpful.", messages: [{ role: "user" as const, content: "مرحبا، كيف حالك؟" }], maxTokens: 200,
});

describe("the adapter asks for stream usage where a provider needs asking", () => {
  it("OpenAI and Groq: stream_options.include_usage; Mistral: not sent", async () => {
    const sent = captureFetch(() => sse([delta("x")]));
    for (const [p, m] of [["openai", "gpt-4.1"], ["groq", "openai/gpt-oss-120b"], ["mistral", "ministral-14b-latest"]] as const) {
      await readAll(await ai.streamChatCompletion(chat(p, m)));
    }
    expect(sent[0].body.stream_options).toEqual({ include_usage: true });
    expect(sent[1].body.stream_options).toEqual({ include_usage: true });
    expect(sent[2].body).not.toHaveProperty("stream_options");
  });
});

describe("each stream is reported once, when it ends", () => {
  it("successful stream: the provider's counts, the concrete model, and no usage chunk for the caller", async () => {
    const events = sink();
    captureFetch(() => sse([delta("Hi"), data({ choices: [], usage: USAGE }), "data: [DONE]\n\n"]));
    const text = await readAll(await ai.streamChatCompletion(chat("openai", "gpt-4.1")));
    expect(text).not.toContain('"choices":[]');
    expect(events).toEqual([{
      operation: "stream", provider: "openai", model: "gpt-4.1", resolved_model: "gpt-4.1-2025-04-14", outcome: "ok",
      usage: { input_tokens: 20, cached_input_tokens: 4, output_tokens: 7, total_tokens: 27 }, usage_source: "reported",
    }]);
  });

  it("no usage in the stream: estimated from bytes, and marked estimated — never zero, never silent", async () => {
    const events = sink();
    captureFetch(() => sse([delta("Hello there"), "data: [DONE]\n\n"]));
    await readAll(await ai.streamChatCompletion(chat("openai", "gpt-4.1")));
    const promptBytes = enc.encode("You are helpful.").length + enc.encode("مرحبا، كيف حالك؟").length;
    expect(events[0]).toMatchObject({
      outcome: "ok", usage_source: "estimated",
      usage: { input_tokens: Math.ceil(promptBytes / 4), output_tokens: Math.ceil(11 / 4) },
    });
  });

  it("a stream the reader abandons: reported as cancelled, with what it produced so far", async () => {
    const events = sink();
    captureFetch(() => new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc.encode(delta("partial answer"))); } })));
    const r = (await ai.streamChatCompletion(chat("openai", "gpt-4.1"))).getReader();
    await r.read();
    await r.cancel();
    expect(events[0]).toMatchObject({ outcome: "error", error_code: "stream_cancelled", usage_source: "estimated", usage: { output_tokens: 4 } });
  });

  it("a stream that could not be opened: one failure, no usage", async () => {
    const events = sink();
    captureFetch(() => new Response("{}", { status: 503 }));
    await expect(ai.streamChatCompletion(chat("openai", "gpt-4.1"))).rejects.toBeTruthy();
    expect(events).toEqual([{ operation: "stream", provider: "openai", model: "gpt-4.1", outcome: "error", error_code: "http_5xx", usage_source: "missing" }]);
  });

  it("fallback: one chain id; a first answer refused by the language gate is still reported, as cancelled", async () => {
    const events = sink();
    captureFetch((i) => i === 0
      ? sse([delta("This answer is plainly in English, which the Arabic request did not want at all."), data({ choices: [], usage: USAGE })])
      : sse([delta("أهلاً وسهلاً، كيف يمكنني مساعدتك اليوم في أي شيء تحتاجه؟"), data({ choices: [], usage: USAGE })]));
    const { result, model } = await ai.streamChatCompletionWithFallback({
      targets: [{ provider: "openai", model: "gpt-4.1" }, { provider: "openai", model: "gpt-4o-mini" }],
      system: "s", messages: [{ role: "user", content: "مرحبا" }], expectScript: "arabic",
    });
    await readAll(result);
    expect(model).toBe("gpt-4o-mini");
    expect(events.map((e) => [e.model, e.outcome, e.attempt])).toEqual([["gpt-4.1", "error", 1], ["gpt-4o-mini", "ok", 2]]);
    expect(events[0].error_code).toBe("stream_cancelled");
    expect(events[1].chain_id).toBe(events[0].chain_id);
    expect(events[1]).toMatchObject({ usage_source: "reported" });
  });

  it("Gemini: its running usageMetadata becomes one usage chunk, read and removed; thinking billed as output", async () => {
    const events = sink();
    const g = (text: string, usage: Record<string, number>) =>
      `data: ${JSON.stringify({ modelVersion: "gemini-3.5-flash-lite", candidates: [{ content: { parts: [{ text }] } }], usageMetadata: usage })}\r\n\r\n`;
    captureFetch(() => sse([g("Hel", { promptTokenCount: 9 }), g("lo", { promptTokenCount: 9, candidatesTokenCount: 3, thoughtsTokenCount: 2 })]));
    const text = await readAll(await ai.streamChatCompletion(chat("gemini", "gemini-flash-lite-latest")));
    expect(text).not.toContain("usage");
    const deltas = text.split("\n").filter((l) => l.startsWith("data: {")).map((l) => JSON.parse(l.slice(6)).choices[0].delta.content).join("");
    expect(deltas).toBe("Hello");
    expect(events[0]).toMatchObject({
      provider: "gemini", resolved_model: "gemini-3.5-flash-lite", outcome: "ok", usage_source: "reported",
      usage: { input_tokens: 9, output_tokens: 5, reasoning_tokens: 2 },
    });
  });
});
