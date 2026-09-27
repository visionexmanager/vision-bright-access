import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// An answer in the wrong language is not a successful answer: asked in Arabic,
// an English reply is a failed attempt and the chain moves on.

const env: Record<string, string | undefined> = { OPENAI_API_KEY: "sk-test", GROQ_API_KEY: "gsk-test" };
const stubDeno = () => vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
stubDeno();

const lang = await import("../../supabase/functions/_shared/answerLanguage.ts");
const ai = await import("../../supabase/functions/_shared/aiProvider.ts");

const GROQ = { provider: "groq", model: "openai/gpt-oss-20b" } as const;
const OPENAI = { provider: "openai", model: "gpt-4.1" } as const;
const ARABIC_ANSWER = "مرحباً، هذه خطة واضحة ومفصلة لمساعدتك في الوصول إلى هدفك خطوة بخطوة.";
const ENGLISH_ANSWER = "Hello, here is a clear and detailed plan to help you reach your goal step by step.";

const sse = (text: string, pieces = 4) => {
  const size = Math.ceil(text.length / pieces);
  const events = Array.from({ length: pieces }, (_, i) => text.slice(i * size, (i + 1) * size))
    .map((part) => `data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`);
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(c) { for (const e of [...events, "data: [DONE]\n\n"]) c.enqueue(encoder.encode(e)); c.close(); },
  }));
};
const tool = (value: unknown) => new Response(JSON.stringify({
  choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(value) } }] } }],
}));

/** Answers by host: groq.com first, then openai.com. */
function fakeFetch(byHost: { groq: () => Response; openai: () => Response }) {
  const hosts: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const host = String(url).includes("groq.com") ? "groq" : "openai";
    hosts.push(host);
    return byHost[host]();
  }));
  return hosts;
}

function capture() {
  const attempts: Array<{ provider: string; success: boolean; error?: string }> = [];
  ai.setProviderAttemptRecorder((a) => attempts.push({ provider: a.provider, success: a.success, error: a.error }));
  return attempts;
}

beforeEach(() => { stubDeno(); ai.resetProviderCooldowns(); ai.setProviderRegistryView(null); });
afterEach(() => { ai.setProviderAttemptRecorder(null); vi.unstubAllGlobals(); });

describe("answerLanguage", () => {
  it("expects the script the user wrote in, unless it is Latin or they asked for another language", () => {
    expect(lang.expectedScriptForMessage("كيف أحسن مهاراتي في البرمجة؟")).toBe("arabic");
    expect(lang.expectedScriptForMessage("Как улучшить навыки?")).toBe("cyrillic");
    expect(lang.expectedScriptForMessage("How do I improve?")).toBeNull();
    expect(lang.expectedScriptForMessage("ترجم هذه الجملة إلى الإنجليزية")).toBeNull();
    expect(lang.expectedScriptForMessage("ok")).toBeNull();
  });

  it("maps language codes, including regional ones, to scripts", () => {
    expect(lang.scriptOfLanguage("ar")).toBe("arabic");
    expect(lang.scriptOfLanguage("ar-LB")).toBe("arabic");
    expect(lang.scriptOfLanguage("fa")).toBe("arabic");
    expect(lang.scriptOfLanguage("en")).toBe("latin");
    expect(lang.scriptOfLanguage("xx")).toBeNull();
  });

  it("refuses what it can see is wrong, and passes what it cannot judge", () => {
    expect(lang.answerIsInScript(ARABIC_ANSWER, "arabic")).toBe(true);
    expect(lang.answerIsInScript(ENGLISH_ANSWER, "arabic")).toBe(false);
    // An Arabic answer naming a product in Latin letters is still Arabic.
    expect(lang.answerIsInScript(`منصة VisionEx ${ARABIC_ANSWER}`, "arabic")).toBe(true);
    expect(lang.answerIsInScript("OK", "arabic")).toBe(true);
    expect(lang.answerIsInScript("42 — 7", "arabic")).toBe(true);
    // Japanese mixes kana and kanji.
    expect(lang.answerIsInScript("これは日本語の文章です。漢字と仮名が混ざっています。", "kana")).toBe(true);
  });
});

describe("structured chains", () => {
  const params = (targets: ReadonlyArray<{ provider: "groq" | "openai"; model: string }>, expectScript?: "arabic") => ({
    targets: [...targets], system: "s", userText: "u", schema: { type: "object" }, toolName: "t", ...(expectScript ? { expectScript } : {}),
  });

  it("an English plan for an Arabic request is a failed attempt; the next model's Arabic plan is the result", async () => {
    fakeFetch({ groq: () => tool({ title: ENGLISH_ANSWER }), openai: () => tool({ title: ARABIC_ANSWER }) });
    const attempts = capture();
    const out = await ai.structuredCompletionWithFallback(params([GROQ, OPENAI], "arabic"));
    expect(out).toMatchObject({ provider: "openai", result: { title: ARABIC_ANSWER } });
    expect(attempts).toEqual([
      { provider: "groq", success: false, error: "wrong_language" },
      { provider: "openai", success: true, error: undefined },
    ]);
  });

  it("with no expectation, nothing changes: the first answer stands", async () => {
    fakeFetch({ groq: () => tool({ title: ENGLISH_ANSWER }), openai: () => tool({ title: ARABIC_ANSWER }) });
    expect(await ai.structuredCompletionWithFallback(params([GROQ, OPENAI]))).toMatchObject({ provider: "groq" });
  });

  it("wrong language holds nothing against the provider: no cooldown", async () => {
    fakeFetch({ groq: () => tool({ title: ENGLISH_ANSWER }), openai: () => tool({ title: ARABIC_ANSWER }) });
    await ai.structuredCompletionWithFallback(params([GROQ, OPENAI], "arabic"));
    expect(ai.orderTargets([GROQ, OPENAI], "chat")).toEqual([GROQ, OPENAI]);
    expect(ai.COOLDOWN_MS).not.toHaveProperty("wrong_language");
  });

  it("when every model answers in the wrong language, the chain fails instead of passing one off", async () => {
    fakeFetch({ groq: () => tool({ title: ENGLISH_ANSWER }), openai: () => tool({ title: ENGLISH_ANSWER }) });
    const error = await ai.structuredCompletionWithFallback(params([GROQ, OPENAI], "arabic")).catch((e) => e);
    expect(error).toBeInstanceOf(ai.ProviderError);
    expect(error.message).toBe("The answer was not in the requested language");
  });
});

describe("a structured attempt that hangs", () => {
  it("times out and the chain moves on, recorded as a timeout", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => String(url).includes("groq.com")
      ? new Promise<Response>(() => { /* never answers */ })
      : Promise.resolve(tool({ title: ARABIC_ANSWER }))));
    const attempts = capture();
    const out = await ai.structuredCompletionWithFallback({
      targets: [GROQ, OPENAI], system: "s", userText: "u", schema: { type: "object" }, toolName: "t", attemptTimeoutMs: 50,
    });
    expect(out.provider).toBe("openai");
    expect(attempts[0]).toEqual({ provider: "groq", success: false, error: "timeout" });
  });

  it("gives every attempt a bound by default, generous enough for the slowest healthy answer measured", () => {
    expect(ai.STRUCTURED_ATTEMPT_TIMEOUT_MS).toBe(45_000);
  });
});

describe("a result missing a required field", () => {
  it("is invalid_response, not a success, and the chain moves on", async () => {
    fakeFetch({ groq: () => tool({ summary: "x" }), openai: () => tool({ title: "t", summary: "s" }) });
    const attempts = capture();
    const out = await ai.structuredCompletionWithFallback({
      targets: [GROQ, OPENAI], system: "s", userText: "u", toolName: "t",
      schema: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" } }, required: ["title", "summary"] },
    });
    expect(out.provider).toBe("openai");
    expect(attempts[0]).toEqual({ provider: "groq", success: false, error: "invalid_response" });
  });

  it("an empty list or string is still an answer: only an absent or null field is refused", async () => {
    fakeFetch({ groq: () => tool({ title: "", tips: [] }), openai: () => tool({ title: "t", tips: ["a"] }) });
    const out = await ai.structuredCompletionWithFallback({
      targets: [GROQ, OPENAI], system: "s", userText: "u", toolName: "t",
      schema: { type: "object", required: ["title", "tips"] },
    });
    expect(out.provider).toBe("groq");
  });
});

describe("a stream that says nothing", () => {
  it("is abandoned at the first-text deadline, recorded as a timeout, and the next model answers", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => String(url).includes("groq.com")
      ? new Response(new ReadableStream<Uint8Array>({ pull() { return new Promise(() => { /* silent */ }); } }))
      : sse(ARABIC_ANSWER)));
    const attempts = capture();
    const out = await ai.streamChatCompletionWithFallback({
      targets: [GROQ, OPENAI], system: "s", messages: [{ role: "user", content: "u" }], attemptTimeoutMs: 50,
    });
    expect(out.provider).toBe("openai");
    expect(attempts[0]).toEqual({ provider: "groq", success: false, error: "timeout" });
    expect(ai.STREAM_FIRST_TEXT_TIMEOUT_MS).toBe(20_000);
  });
});

describe("streaming chains", () => {
  const read = (stream: ReadableStream<Uint8Array>) => new Response(stream).text();
  const textOf = (sseText: string) => sseText.split("\n").filter((l) => l.startsWith("data: {"))
    .map((l) => JSON.parse(l.slice(6)).choices[0].delta.content).join("");
  const params = (expectScript?: "arabic") => ({
    targets: [GROQ, OPENAI], system: "s", messages: [{ role: "user" as const, content: "سؤال" }], ...(expectScript ? { expectScript } : {}),
  });

  it("an English stream for an Arabic question is refused before a byte reaches the user", async () => {
    fakeFetch({ groq: () => sse(ENGLISH_ANSWER), openai: () => sse(ARABIC_ANSWER) });
    const attempts = capture();
    const out = await ai.streamChatCompletionWithFallback(params("arabic"));
    expect(out.provider).toBe("openai");
    expect(textOf(await read(out.result))).toBe(ARABIC_ANSWER);
    expect(attempts[0]).toEqual({ provider: "groq", success: false, error: "wrong_language" });
  });

  it("a stream that passes the gate arrives whole and in order, and is still settled as a success", async () => {
    fakeFetch({ groq: () => sse(ARABIC_ANSWER, 9), openai: () => sse(ENGLISH_ANSWER) });
    const attempts = capture();
    const out = await ai.streamChatCompletionWithFallback(params("arabic"));
    const body = await read(out.result);
    expect(out.provider).toBe("groq");
    expect(textOf(body)).toBe(ARABIC_ANSWER);
    expect(body.trimEnd().endsWith("data: [DONE]")).toBe(true);
    expect(attempts).toEqual([{ provider: "groq", success: true, error: undefined }]);
  });

  it("with no expectation the stream is not held at all", async () => {
    fakeFetch({ groq: () => sse(ENGLISH_ANSWER), openai: () => sse(ARABIC_ANSWER) });
    const out = await ai.streamChatCompletionWithFallback(params());
    expect(out.provider).toBe("groq");
  });
});

describe("wiring", () => {
  it("the site chat enforces the script of the user's own question", () => {
    const chat = readFileSync("supabase/functions/ai-chat/index.ts", "utf8");
    expect(chat).toContain("expectScript: expectedScriptForMessage(lastQuestion),");
  });

  it("generators enforce the language they were asked for", () => {
    const generate = readFileSync("supabase/functions/ai-generate/index.ts", "utf8");
    expect(generate).toContain("expectScript: scriptOfLanguage(lang),");
  });
});
