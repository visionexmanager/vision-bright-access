import { readdirSync, readFileSync, statSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The OpenAI audit of 2026-09-28 (openai-inventory.yml): every model on the key
// was sent a real request. The current GPT-5.x and GPT-6 models that passed are
// made callable through the existing adapter, on the existing key, and curated
// in the catalog at OpenAI's price — without joining any chain.

const env: Record<string, string | undefined> = { OPENAI_API_KEY: "sk-test" };
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

const ai = await import("../../supabase/functions/_shared/aiProvider.ts");
const catalog = await import("../../supabase/functions/_shared/openaiModelCatalog.ts");

const MIGRATION = readFileSync("supabase/migrations/20261052000000_openai_catalog_curation.sql", "utf8");
const SQL = MIGRATION.replace(/--[^\n]*/g, "");

// Lowest reasoning effort each accepted on Chat Completions in the audit.
const REASONING: Record<string, string> = {
  "gpt-6-astra": "low", "gpt-6-sol": "none", "gpt-6-luna": "none",
  "gpt-5.6-sol": "none", "gpt-5.6-terra": "none", "gpt-5.6-luna": "none",
  "gpt-5.5": "none", "gpt-5.4": "none", "gpt-5.4-mini": "none", "gpt-5.4-nano": "none",
  "gpt-5.2": "none", "gpt-5.1": "none",
};

type Sent = { url: string; auth: string | null; body: Record<string, unknown> };

function captureFetch(respond: (i: number) => Response): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    sent.push({ url, auth: new Headers(init.headers).get("Authorization"), body: JSON.parse(String(init.body)) });
    return respond(sent.length - 1);
  }));
  return sent;
}

const toolReply = () => new Response(JSON.stringify({
  choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ ok: true }) } }] } }],
  usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17, completion_tokens_details: { reasoning_tokens: 0 } },
}));

const structured = (model: string) => ({
  provider: "openai" as const, model, system: "s", userText: "u", schema: { type: "object" }, toolName: "t", maxTokens: 800,
});

beforeEach(() => vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } }));
afterEach(() => { ai.setProviderAttemptRecorder(null); ai.resetProviderCooldowns(); });

describe("the adapter calls each audited model with the existing key", () => {
  for (const [model, effort] of Object.entries(REASONING)) {
    it(`${model}: max_completion_tokens and effort ${effort}, never max_tokens`, async () => {
      const sent = captureFetch(toolReply);
      await ai.structuredCompletion(structured(model));
      expect(sent[0].url).toBe("https://api.openai.com/v1/chat/completions");
      expect(sent[0].auth).toBe("Bearer sk-test");
      expect(sent[0].body).toMatchObject({ model, max_completion_tokens: 800, reasoning_effort: effort });
      expect(sent[0].body).not.toHaveProperty("max_tokens");
    });
  }

  it("leaves the models it did not add exactly as they were", async () => {
    for (const model of ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "gpt-5", "gpt-5-mini", "o3", "gpt-5.5-pro"]) {
      const sent = captureFetch(toolReply);
      await ai.structuredCompletion(structured(model));
      expect(sent[0].body.max_tokens, model).toBe(800);
      expect(sent[0].body, model).not.toHaveProperty("reasoning_effort");
    }
  });

  it("a failed new model is recorded as a failure and the chain moves on", async () => {
    const attempts: Array<{ model: string; success: boolean; error?: string; usage?: unknown }> = [];
    ai.setProviderAttemptRecorder((a) => attempts.push(a));
    captureFetch((i) => i === 0 ? new Response("{}", { status: 500 }) : toolReply());
    const { model } = await ai.structuredCompletionWithFallback({
      targets: [{ provider: "openai", model: "gpt-5.6-sol" }, { provider: "openai", model: "gpt-4.1" }],
      system: "s", userText: "u", schema: { type: "object" }, toolName: "t", maxTokens: 400,
    });
    expect(model).toBe("gpt-4.1");
    expect(attempts.map((a) => [a.model, a.success])).toEqual([["gpt-5.6-sol", false], ["gpt-4.1", true]]);
    expect(attempts[0].usage).toBeUndefined();
    expect(attempts[1].usage).toMatchObject({ input_tokens: 12, output_tokens: 5, total_tokens: 17 });
  });
});

describe("no chain names a model the audit added", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = `${dir}/${n}`;
    return statSync(p).isDirectory() ? walk(p) : /\.ts$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
  const sources = walk("supabase/functions").map((f) => [f, readFileSync(f, "utf8")] as const);

  for (const model of Object.keys(REASONING).filter((m) => m !== "gpt-5.6-luna")) {
    it(`${model} appears only in the adapter's reasoning table`, () => {
      const quoted = new RegExp(`"${model.replace(/\./g, "\\.")}"`);
      expect(sources.filter(([, s]) => quoted.test(s)).map(([f]) => f)).toEqual(["supabase/functions/_shared/aiProvider.ts"]);
    });
  }
});

describe("the curation migration", () => {
  it("curates every model the adapter now serves, each at a published price", () => {
    for (const model of Object.keys(REASONING)) {
      const row = SQL.split("\n    ('").find((r) => r.startsWith(`${model}',`));
      expect(row, model).toBeDefined();
      expect(row, model).toMatch(/"unit":"usd_per_1m_tokens","input":\d/);
      expect(row, model).toContain("https://developers.openai.com/api/docs/pricing");
    }
  });

  it("never enables routing: new rows insert false, and the UPDATE does not set it", () => {
    expect(SQL).toMatch(/INSERT INTO public\.ph_provider_models \(provider, model_id, routing_enabled\)\s*SELECT 'openai', m, false/);
    const update = SQL.slice(SQL.indexOf("UPDATE public.ph_provider_models"));
    expect(update.slice(0, update.indexOf("FROM (VALUES"))).not.toMatch(/routing_enabled/);
    expect(SQL).not.toMatch(/routing_enabled\s*=\s*true/);
  });

  it("touches no discovery column, provider row, plan or VX price", () => {
    const update = SQL.slice(SQL.indexOf("UPDATE public.ph_provider_models"), SQL.indexOf("FROM (VALUES"));
    for (const column of ["available", "last_seen_at", "first_seen_at", "unavailable_since"]) expect(update).not.toMatch(new RegExp(`\\b${column}\\s*=`));
    expect(SQL).not.toMatch(/ph_providers\b|central_pricing_registry|subscription|user_points/);
  });

  it("records the shutdown of every deprecated model the code still calls", () => {
    for (const [model, date] of [["whisper-1", "2027-02-26"], ["gpt-4o-transcribe", "2027-02-26"], ["gpt-image-1-mini", "2026-12-01"]]) {
      const row = SQL.split("\n    ('").find((r) => r.startsWith(`${model}',`));
      expect(row, model).toContain(`DATE '${date}'`);
    }
  });

  it("a price with no input or no unit is refused — the CHECK cannot pass on NULL", () => {
    expect(SQL).toMatch(/CHECK \(pricing IS NULL OR COALESCE\(/);
    expect(SQL).toMatch(/,\s*false\)\);/);
  });
});

describe("classification", () => {
  it("names the GPT-6 family as text, like GPT-5", () => {
    for (const id of ["gpt-6-astra", "gpt-6-sol", "gpt-6-luna"]) expect(catalog.classifyOpenAIModel(id)).toEqual(["chat"]);
  });

  it("still infers nothing for realtime or moderation — only curation grants those", () => {
    expect(catalog.classifyOpenAIModel("gpt-realtime-2.1")).toEqual([]);
    expect(catalog.classifyOpenAIModel("omni-moderation-latest")).toEqual([]);
    expect(catalog.MODEL_CAPABILITIES).toContain("realtime");
    expect(catalog.MODEL_CAPABILITIES).toContain("moderation");
  });
});
