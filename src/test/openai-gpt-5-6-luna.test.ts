import { readFileSync, readdirSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// OpenAI's gpt-5.6-luna, added to the existing registry and the existing
// OpenAI adapter — no new provider, key, adapter or selection system.
//
// Luna is a reasoning model. On Chat Completions OpenAI rejects `max_tokens`
// for that family ("Use 'max_completion_tokens' instead"), and reasoning tokens
// count toward the completion budget. No model the adapter served before was a
// reasoning model, so it had never needed either rule.

const env: Record<string, string | undefined> = { OPENAI_API_KEY: "sk-test", GROQ_API_KEY: "gsk-test" };
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

const ai = await import("../../supabase/functions/_shared/aiProvider.ts");

const LUNA = "gpt-5.6-luna";
const MIGRATION = "supabase/migrations/20261048000000_provider_model_catalog.sql";

type Sent = { url: string; body: Record<string, unknown> };

function captureFetch(respond: () => Response): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) });
    return respond();
  }));
  return sent;
}

const toolReply = (usage?: Record<string, unknown>) => () => new Response(JSON.stringify({
  choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ ok: true }) } }] } }],
  ...(usage ? { usage } : {}),
}));

const structured = (provider: "openai" | "groq", model: string) => ({
  provider, model, system: "s", userText: "u", schema: { type: "object" }, toolName: "t", maxTokens: 1200,
});

beforeEach(() => vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } }));
afterEach(() => ai.setProviderAttemptRecorder(null));

describe("C. the existing OpenAI adapter runs Luna", () => {
  it("sends the model id exactly, on the OpenAI endpoint, with the existing key", async () => {
    const sent = captureFetch(toolReply());
    await ai.structuredCompletion(structured("openai", LUNA));
    expect(sent[0].url).toBe("https://api.openai.com/v1/chat/completions");
    expect(sent[0].body.model).toBe("gpt-5.6-luna");
  });

  it("uses max_completion_tokens and no reasoning, never max_tokens", async () => {
    const sent = captureFetch(toolReply());
    await ai.structuredCompletion(structured("openai", LUNA));
    expect(sent[0].body.max_completion_tokens).toBe(1200);
    expect(sent[0].body).not.toHaveProperty("max_tokens");
    // "none" keeps the existing budgets meaning visible output, as they did.
    expect(sent[0].body.reasoning_effort).toBe("none");
  });

  it("does the same on the streaming path", async () => {
    const sent = captureFetch(() => new Response("data: [DONE]\n\n"));
    await ai.streamChatCompletion({ provider: "openai", model: LUNA, system: "s", messages: [{ role: "user", content: "hi" }], maxTokens: 900 });
    expect(sent[0].body).toMatchObject({ model: LUNA, max_completion_tokens: 900, reasoning_effort: "none", stream: true });
    expect(sent[0].body).not.toHaveProperty("max_tokens");
  });

  it("leaves every existing model's request exactly as it was", async () => {
    for (const [provider, model] of [["openai", "gpt-4o-mini"], ["openai", "gpt-4.1"], ["groq", "llama-3.1-8b-instant"]] as const) {
      const sent = captureFetch(toolReply());
      await ai.structuredCompletion(structured(provider, model));
      expect(sent[0].body.max_tokens, model).toBe(1200);
      expect(sent[0].body, model).not.toHaveProperty("max_completion_tokens");
      expect(sent[0].body, model).not.toHaveProperty("reasoning_effort");
    }
  });

  it("applies the reasoning rules to OpenAI only — a Groq model named like it is untouched", async () => {
    const sent = captureFetch(toolReply());
    await ai.structuredCompletion(structured("groq", LUNA));
    expect(sent[0].body.max_tokens).toBe(1200);
    expect(sent[0].body).not.toHaveProperty("reasoning_effort");
  });

  it("normalises an OpenAI error through the existing generic path", async () => {
    captureFetch(() => new Response(JSON.stringify({ error: { message: "model_not_found sk-live-secret" } }), { status: 404 }));
    const error = (await ai.structuredCompletion(structured("openai", LUNA)).catch((e) => e)) as InstanceType<typeof ai.ProviderError>;
    expect(error).toBeInstanceOf(ai.ProviderError);
    expect(error.status).toBe(404);
    expect(String(error.message)).toBe("OpenAI request failed");
  });
});

describe("E. usage is recorded internally, from the provider's own response", () => {
  it("records input, cached input, output, reasoning and total tokens with the model", async () => {
    captureFetch(toolReply({
      prompt_tokens: 1200, completion_tokens: 80, total_tokens: 1280,
      prompt_tokens_details: { cached_tokens: 1024 }, completion_tokens_details: { reasoning_tokens: 0 },
    }));
    const attempts: unknown[] = [];
    ai.setProviderAttemptRecorder((a) => attempts.push(a));
    await ai.structuredCompletionWithFallback({ ...structured("openai", LUNA), targets: [{ provider: "openai", model: LUNA }] });
    expect(attempts).toEqual([expect.objectContaining({
      provider: "openai", model: LUNA, success: true,
      usage: { input_tokens: 1200, cached_input_tokens: 1024, output_tokens: 80, reasoning_tokens: 0, total_tokens: 1280 },
    })]);
  });

  it("omits usage rather than inventing zeros when the provider sends none", async () => {
    captureFetch(toolReply());
    const attempts: Array<Record<string, unknown>> = [];
    ai.setProviderAttemptRecorder((a) => attempts.push(a as unknown as Record<string, unknown>));
    await ai.structuredCompletionWithFallback({ ...structured("openai", LUNA), targets: [{ provider: "openai", model: LUNA }] });
    expect(attempts[0]).not.toHaveProperty("usage");
  });

  it("writes the usage into the registry log beside the model — counts only", () => {
    const recording = readFileSync("supabase/functions/_shared/providerRecording.ts", "utf8");
    expect(recording).toContain("...(attempt.usage ? { usage: attempt.usage } : {})");
  });
});

describe("A/B. the catalog knows Luna, once, under OpenAI, at OpenAI's price", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const code = sql.replace(/--[^\n]*/g, "");
  const luna = code.slice(code.indexOf("('openai', 'gpt-5.6-luna'"), code.indexOf("('openai', 'gpt-4.1'"));

  it("is one row keyed by provider and the exact model id, inserted once", () => {
    expect(code).toContain("PRIMARY KEY (provider, model_id)");
    expect(code.match(/'gpt-5\.6-luna'/g)).toHaveLength(1);
    expect(code).toMatch(/ON CONFLICT \(provider, model_id\) DO NOTHING;/);
  });

  it("stores OpenAI's standard price per million tokens, unrounded", () => {
    expect(luna).toContain("'unit', 'usd_per_1m_tokens', 'input', 0.20, 'cached_input', 0.02, 'output', 1.20");
  });

  it("is text and vision only — never audio, image or video generation", () => {
    expect(luna).toContain("ARRAY['chat','vision'], 'curated'");
    for (const media of ["tts", "stt", "image'", "text_to_video", "voice_cloning"]) {
      expect(luna.split("ARRAY[")[1]?.split("]")[0], media).not.toContain(media);
    }
  });

  it("is routing-enabled by policy but not available until discovery sees it on our key", () => {
    expect(luna).toMatch(/DATE '2026-09-25', true,/);
    expect(code).toMatch(/available\s+boolean\s+NOT NULL DEFAULT false/);
  });

  it("changes no provider row, default, status, priority or existing price", () => {
    expect(code).not.toMatch(/ph_providers\b/);
    expect(code).not.toMatch(/central_pricing_registry/);
  });
});

describe("D/F. no route, default or client choice was added", () => {
  const functionsDir = "supabase/functions";
  const sources = readdirSync(`${functionsDir}/_shared`).filter((f) => f.endsWith(".ts"))
    .map((f) => [f, readFileSync(`${functionsDir}/_shared/${f}`, "utf8")] as const);

  it("Luna is in no target list: nothing is routed to it until someone opts in", () => {
    const naming = sources.filter(([, s]) => s.includes('"gpt-5.6-luna"')).map(([f]) => f);
    expect(naming).toEqual(["aiProvider.ts"]);
  });

  it("the reasoning table is keyed by exact model id, not a prefix a client could match", () => {
    const provider = readFileSync(`${functionsDir}/_shared/aiProvider.ts`, "utf8");
    expect(provider).toMatch(/OPENAI_REASONING_MODELS[^=]*=\s*\{\s*"gpt-5\.6-luna":/);
    expect(provider).not.toMatch(/startsWith\("gpt-5/);
  });

  it("the chat functions still take no model from the request body", () => {
    for (const fn of ["ai-chat", "ai-generate", "analyze-image", "academy-chat", "kids-course-generate"]) {
      const source = readFileSync(`${functionsDir}/${fn}/index.ts`, "utf8");
      expect(source, fn).not.toMatch(/body\.model|\bmodel\s*\}\s*=\s*await req\.json/);
    }
  });
});
