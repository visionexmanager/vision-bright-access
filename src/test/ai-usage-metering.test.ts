import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Shadow usage metering: every provider call reports provider + model + usage,
// the price book turns it into a provider cost, and one row per call lands in
// ai_usage_events. Nothing is charged — these tests pin that the numbers are
// honest (no invented zeros, no guessed prices) and that metering can never
// reach the request.

const env: Record<string, string | undefined> = { OPENAI_API_KEY: "sk-test", GEMINI_API_KEY: "g-test" };
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

const ai = await import("../../supabase/functions/_shared/aiProvider.ts");
const m = await import("../../supabase/functions/_shared/metering.ts");
const rec = await import("../../supabase/functions/_shared/usageRecording.ts");
type UsageEvent = import("../../supabase/functions/_shared/metering.ts").UsageEvent;
type PriceRow = import("../../supabase/functions/_shared/metering.ts").PriceRow;

const MIGRATION = readFileSync("supabase/migrations/20261053000000_ai_usage_metering.sql", "utf8");
const SQL = MIGRATION.replace(/--[^\n]*/g, "");

const row = (over: Partial<PriceRow> = {}): PriceRow => ({
  id: 1, provider: "openai", model_id: "gpt-4.1", unit: "usd_per_1m_tokens",
  rates: { input: 2, cached_input: 0.5, output: 8 }, effective_from: "2026-09-28T00:00:00Z", effective_to: null, ...over,
});

beforeEach(() => vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } }));
afterEach(() => { ai.setUsageSink(null); ai.resetProviderCooldowns(); rec.resetPriceBookCache(); });

describe("costOf: usage × the price book, never a guess", () => {
  it("prices tokens per million, cached input at its own rate", () => {
    const c = m.costOf({ input_tokens: 1000, cached_input_tokens: 400, output_tokens: 500 }, row());
    // (600×2 + 400×0.5 + 500×8) / 1e6
    expect(c).toEqual({ status: "priced", cost_usd: 0.0054, price_id: 1 });
  });

  it("keeps nano-dollars: one token of a cheap model is not zero", () => {
    const c = m.costOf({ input_tokens: 1 }, row({ rates: { input: 0.02 } }));
    expect(c).toEqual({ status: "priced", cost_usd: 0.00000002, price_id: 1 });
  });

  it("never bills reasoning on top of output — it is already inside it", () => {
    const a = m.costOf({ input_tokens: 10, output_tokens: 100, reasoning_tokens: 90 }, row());
    const b = m.costOf({ input_tokens: 10, output_tokens: 100 }, row());
    expect(a).toEqual(b);
  });

  it("is unpriced, not zero, when the book has no row or no rate for what was used", () => {
    expect(m.costOf({ input_tokens: 5 }, null)).toMatchObject({ status: "unpriced" });
    expect(m.costOf({ input_tokens: 5, output_tokens: 5 }, row({ rates: { input: 1 } }))).toMatchObject({ status: "unpriced", reason: "no output rate" });
    expect(m.costOf({ characters: 10 }, row())).toMatchObject({ status: "unpriced", reason: "usage has no token counts" });
    expect(m.costOf({ input_tokens: 5 }, row({ unit: "usd_per_minute", rates: { price: 1 } }))).toMatchObject({ status: "unpriced" });
  });

  it("is no_usage when the call reported nothing — the cost is unknown, not zero", () => {
    expect(m.costOf(undefined, row())).toEqual({ status: "no_usage", price_id: 1 });
    expect(m.costOf({}, row())).toEqual({ status: "no_usage", price_id: 1 });
  });

  it("a free model is free with or without usage", () => {
    expect(m.costOf(undefined, row({ unit: "free", rates: {} }))).toEqual({ status: "free", cost_usd: 0, price_id: 1 });
  });

  it("prices characters, minutes, hours and images", () => {
    expect(m.costOf({ characters: 2000 }, row({ unit: "usd_per_1m_characters", rates: { price: 15 } }))).toMatchObject({ cost_usd: 0.03 });
    expect(m.costOf({ seconds: 90 }, row({ unit: "usd_per_minute", rates: { price: 0.006 } }))).toMatchObject({ cost_usd: 0.009 });
    expect(m.costOf({ seconds: 1800 }, row({ unit: "usd_per_hour", rates: { price: 0.04 } }))).toMatchObject({ cost_usd: 0.02 });
    expect(m.costOf({ images: 2 }, row({ unit: "usd_per_image", rates: { price: 0.04 } }))).toMatchObject({ cost_usd: 0.08 });
  });

  it("a very expensive model is priced at its own rate, not capped or rounded away", () => {
    const astra = row({ model_id: "gpt-6-astra", rates: { input: 10, output: 50 } });
    expect(m.costOf({ input_tokens: 100_000, output_tokens: 20_000 }, astra)).toMatchObject({ cost_usd: 2 });
  });
});

describe("priceFor: which row applies", () => {
  const rows = [
    row({ id: 1, effective_to: "2026-10-01T00:00:00Z" }),
    row({ id: 2, rates: { input: 3, output: 9 }, effective_from: "2026-10-01T00:00:00Z" }),
    row({ id: 3, model_id: "gpt-4o-mini-2024-07-18" }),
    row({ id: 4, provider: "groq", model_id: "gpt-4.1" }),
  ];

  it("uses the price in force when the call happened, so history keeps its price", () => {
    expect(m.priceFor(rows, "openai", "gpt-4.1", undefined, "2026-09-30T12:00:00Z")?.id).toBe(1);
    expect(m.priceFor(rows, "openai", "gpt-4.1", undefined, "2026-10-02T12:00:00Z")?.id).toBe(2);
  });

  it("prefers the concrete model the provider named, then the alias asked for", () => {
    expect(m.priceFor(rows, "openai", "gpt-4o-mini", "gpt-4o-mini-2024-07-18", "2026-09-30T00:00:00Z")?.id).toBe(3);
    expect(m.priceFor(rows, "openai", "gpt-4.1", "gpt-4.1-2025-04-14", "2026-09-30T00:00:00Z")?.id).toBe(1);
  });

  it("never borrows another provider's price for the same model id", () => {
    expect(m.priceFor(rows, "mistral", "gpt-4.1", undefined, "2026-09-30T00:00:00Z")).toBeNull();
  });
});

describe("normalizers", () => {
  it("Gemini: thinking tokens are billed as output, and a missing count stays missing", () => {
    expect(m.geminiUsage({ promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 30, cachedContentTokenCount: 10 }))
      .toEqual({ input_tokens: 100, cached_input_tokens: 10, output_tokens: 50, reasoning_tokens: 30 });
    expect(m.geminiUsage({ promptTokenCount: 7 })).toEqual({ input_tokens: 7 });
    expect(m.geminiUsage({})).toBeUndefined();
    expect(m.geminiUsage(undefined)).toBeUndefined();
  });

  it("embeddings: prompt tokens only", () => {
    expect(m.embeddingUsage({ usage: { prompt_tokens: 8, total_tokens: 8 } })).toEqual({ input_tokens: 8, total_tokens: 8 });
    expect(m.embeddingUsage({})).toBeUndefined();
  });
});

// ── The adapter reports every provider call, once ──────────────────────────

function captureFetch(respond: (i: number, url: string) => Response) {
  let i = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => respond(i++, url)));
}
const toolReply = (usage?: Record<string, unknown>, model = "gpt-4.1-2025-04-14") => new Response(JSON.stringify({
  model,
  choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ reply: "hi" }) } }] } }],
  ...(usage ? { usage } : {}),
}));
const USAGE = { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17, prompt_tokens_details: { cached_tokens: 2 } };
const structured = (model = "gpt-4.1") => ({
  provider: "openai" as const, model, system: "s", userText: "u",
  schema: { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] }, toolName: "t",
});
const sink = () => { const events: UsageEvent[] = []; ai.setUsageSink((e) => events.push(e)); return events; };

describe("the adapter reports each provider call to the usage sink", () => {
  it("a direct structured call: one event, the provider's own counts, the concrete model", async () => {
    const events = sink();
    captureFetch(() => toolReply(USAGE));
    await ai.structuredCompletion(structured());
    expect(events).toEqual([{
      operation: "structured", provider: "openai", model: "gpt-4.1", resolved_model: "gpt-4.1-2025-04-14",
      outcome: "ok", usage: { input_tokens: 12, cached_input_tokens: 2, output_tokens: 5, total_tokens: 17 }, usage_source: "reported",
    }]);
  });

  it("a response with no usage is 'missing' — never zeros", async () => {
    const events = sink();
    captureFetch(() => toolReply());
    await ai.structuredCompletion(structured());
    expect(events[0]).toMatchObject({ outcome: "ok", usage_source: "missing" });
    expect(events[0]).not.toHaveProperty("usage");
  });

  it("a failed call is reported as a failure with no usage", async () => {
    const events = sink();
    captureFetch(() => new Response("{}", { status: 500 }));
    await expect(ai.structuredCompletion(structured())).rejects.toBeTruthy();
    expect(events).toEqual([{ operation: "structured", provider: "openai", model: "gpt-4.1", outcome: "error", error_code: "http_5xx", usage_source: "missing" }]);
  });

  it("fallback: each attempt once, one chain id, attempt numbers in order", async () => {
    const events = sink();
    captureFetch((i) => (i === 0 ? new Response("{}", { status: 500 }) : toolReply(USAGE, "gpt-4o-mini-2024-07-18")));
    await ai.structuredCompletionWithFallback({
      targets: [{ provider: "openai", model: "gpt-4.1" }, { provider: "openai", model: "gpt-4o-mini" }],
      system: "s", userText: "u", schema: structured().schema, toolName: "t",
    });
    expect(events.map((e) => [e.model, e.outcome, e.attempt])).toEqual([["gpt-4.1", "error", 1], ["gpt-4o-mini", "ok", 2]]);
    expect(events[0].chain_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(events[1].chain_id).toBe(events[0].chain_id);
  });

  it("an attempt the chain rejects after the provider answered still reports what it used", async () => {
    const events = sink();
    // The first answer lacks the required field: the provider billed it, the chain moves on.
    captureFetch((i) => i === 0
      ? new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: "{}" } }] } }], usage: USAGE }))
      : toolReply(USAGE));
    await ai.structuredCompletionWithFallback({
      targets: [{ provider: "openai", model: "gpt-4o-mini" }, { provider: "openai", model: "gpt-4.1" }],
      system: "s", userText: "u", schema: structured().schema, toolName: "t",
    });
    expect(events.map((e) => [e.model, e.outcome, e.usage_source])).toEqual([["gpt-4o-mini", "ok", "reported"], ["gpt-4.1", "ok", "reported"]]);
  });

  it("a parked target is refused before any request, so nothing is reported", async () => {
    const events = sink();
    captureFetch(() => toolReply(USAGE));
    await expect(ai.structuredCompletion({ ...structured("gemini-flash-latest"), provider: "gemini" })).rejects.toBeTruthy();
    expect(events).toEqual([]);
  });

  it("Gemini: the raw usageMetadata, thoughts as output, and the model version it answered with", async () => {
    const events = sink();
    captureFetch(() => new Response(JSON.stringify({
      modelVersion: "gemini-3.5-flash-lite",
      candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: "hi" }) }] } }],
      usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 4, thoughtsTokenCount: 6 },
    })));
    await ai.structuredCompletion({ ...structured("gemini-flash-lite-latest"), provider: "gemini" });
    expect(events[0]).toMatchObject({
      provider: "gemini", model: "gemini-flash-lite-latest", resolved_model: "gemini-3.5-flash-lite",
      usage: { input_tokens: 30, output_tokens: 10, reasoning_tokens: 6 }, usage_source: "reported",
    });
  });

  it("embeddings: counted on success, reported as a failure otherwise", async () => {
    const events = sink();
    captureFetch((i) => i === 0
      ? new Response(JSON.stringify({ model: "text-embedding-3-small", data: [{ embedding: [0.1] }], usage: { prompt_tokens: 3, total_tokens: 3 } }))
      : new Response("{}", { status: 429 }));
    await ai.createEmbedding(["a"]);
    await expect(ai.createEmbedding(["b"])).rejects.toBeTruthy();
    expect(events.map((e) => [e.operation, e.outcome, e.usage_source, e.usage?.input_tokens])).toEqual([
      ["embedding", "ok", "reported", 3], ["embedding", "error", "missing", undefined],
    ]);
  });

  it("a sink that throws never reaches the request", async () => {
    ai.setUsageSink(() => { throw new Error("boom"); });
    captureFetch(() => toolReply(USAGE));
    await expect(ai.structuredCompletion(structured())).resolves.toEqual({ reply: "hi" });
  });
});

// ── Recording: price it, write one row, never throw ─────────────────────────

function stubDb(prices: unknown[] | Error, insertFails = false) {
  const inserted: Record<string, unknown>[] = [];
  let selects = 0;
  const db = {
    from: (table: string) => ({
      select: async () => {
        selects++;
        if (prices instanceof Error) return { data: null, error: prices };
        return { data: table === "ai_price_book" ? prices : [], error: null };
      },
      insert: async (r: Record<string, unknown>) => {
        if (insertFails) throw new Error("db down");
        inserted.push(r);
        return { error: null };
      },
    }),
  };
  return { db, inserted, selects: () => selects };
}
const event = (over: Partial<UsageEvent> = {}): UsageEvent => ({
  operation: "structured", provider: "openai", model: "gpt-4.1", outcome: "ok",
  usage: { input_tokens: 1000, output_tokens: 500 }, usage_source: "reported", ...over,
});
const NOW = Date.parse("2026-09-29T00:00:00Z");

describe("recordUsageEventIn", () => {
  it("prices the event from the book and writes counts, ids and dollars only", async () => {
    const { db, inserted } = stubDb([row()]);
    await rec.recordUsageEventIn(db, "ai-chat", event({ chain_id: "c1", attempt: 2 }), NOW);
    expect(inserted).toEqual([{
      occurred_at: "2026-09-29T00:00:00.000Z", function_name: "ai-chat", operation: "structured", provider: "openai",
      model: "gpt-4.1", resolved_model: null, chain_id: "c1", reservation_id: null, attempt: 2, outcome: "ok", error_code: null,
      usage: { input_tokens: 1000, output_tokens: 500 }, usage_source: "reported",
      price_id: 1, provider_cost_usd: 0.006, cost_status: "priced", cost_note: null,
    }]);
  });

  it("a model the book does not price is recorded 'unpriced' with no cost — never a default rate", async () => {
    const { db, inserted } = stubDb([row()]);
    await rec.recordUsageEventIn(db, "ai-chat", event({ provider: "gemini", model: "gemini-flash-lite-latest" }), NOW);
    expect(inserted[0]).toMatchObject({ price_id: null, provider_cost_usd: null, cost_status: "unpriced", cost_note: "no price in the book" });
  });

  it("reads the price book once per ten minutes, not once per call", async () => {
    const { db, selects } = stubDb([row()]);
    for (let i = 0; i < 5; i++) await rec.recordUsageEventIn(db, "ai-chat", event(), NOW + i * 1000);
    expect(selects()).toBe(1);
    await rec.recordUsageEventIn(db, "ai-chat", event(), NOW + rec.PRICE_BOOK_TTL_MS + 1);
    expect(selects()).toBe(2);
  });

  it("an unreadable price book still records the event, unpriced", async () => {
    const { db, inserted } = stubDb(new Error("denied"));
    await rec.recordUsageEventIn(db, "ai-chat", event(), NOW);
    expect(inserted[0]).toMatchObject({ cost_status: "unpriced" });
  });

  it("a malformed price row is ignored rather than trusted", async () => {
    const { db, inserted } = stubDb([{ ...row(), unit: "usd_per_banana" }]);
    await rec.recordUsageEventIn(db, "ai-chat", event(), NOW);
    expect(inserted[0]).toMatchObject({ cost_status: "unpriced" });
  });

  it("never throws: a failed insert and a bad function name both end in silence", async () => {
    await expect(rec.recordUsageEventIn(stubDb([row()], true).db, "ai-chat", event(), NOW)).resolves.toBeUndefined();
    const { db, inserted } = stubDb([row()]);
    await rec.recordUsageEventIn(db, "Not A Function", event(), NOW);
    expect(inserted).toEqual([]);
  });
});

// ── Wiring: every function that can reach a model is metered ───────────────

describe("every Edge Function whose imports reach the usage sink installs metering under its own name", () => {
  const ROOT = "supabase/functions";
  const TARGET = normalize(`${ROOT}/_shared/usageSink.ts`);
  const importsOf = (file: string) => [...readFileSync(file, "utf8")
    .matchAll(/(?:import|export)[^"']*?from\s*["'](\.{1,2}\/[^"']+\.ts)["']|import\(\s*["'](\.{1,2}\/[^"']+\.ts)["']\s*\)/g)]
    .map((x) => normalize(join(dirname(file), x[1] || x[2]))).filter((p) => existsSync(p));
  const reaches = (entry: string) => {
    const seen = new Set<string>();
    const stack = [entry];
    while (stack.length) {
      const f = stack.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      if (f === TARGET) return true;
      stack.push(...importsOf(f));
    }
    return false;
  };
  const functions = readdirSync(ROOT).filter((d) => d !== "_shared" && existsSync(`${ROOT}/${d}/index.ts`));
  const metered = functions.filter((d) => reaches(normalize(`${ROOT}/${d}/index.ts`)));

  it("finds the AI functions (the walk is not vacuous)", () => {
    expect(metered.length).toBeGreaterThanOrEqual(55);
    for (const known of ["ai-chat", "whatsapp-webhook", "library-semantic-search", "kids-story-generate", "ocr-scan", "moderate-content", "academy-chat"]) expect(metered).toContain(known);
  });

  for (const fn of metered) {
    it(`${fn}`, () => {
      const src = readFileSync(`${ROOT}/${fn}/index.ts`, "utf8");
      expect(src).toContain(`installUsageMetering("${fn}");`);
    });
  }
});

describe("the migration", () => {
  it("keeps both tables service-only: RLS on, nothing granted to anon or authenticated, no policy", () => {
    for (const t of ["ai_price_book", "ai_usage_events"]) {
      expect(SQL).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
      expect(SQL).toContain(`REVOKE ALL ON TABLE public.${t} FROM PUBLIC, anon, authenticated;`);
    }
    expect(SQL).toContain("REVOKE ALL ON public.ai_usage_cost_daily FROM PUBLIC, anon, authenticated;");
    expect(SQL).not.toMatch(/CREATE POLICY/i);
    expect(SQL).not.toMatch(/GRANT[^;]*\b(anon|authenticated)\b/);
  });

  it("touches no VX, plan or balance table", () => {
    expect(SQL).not.toMatch(/vx_usage_ledger|central_pricing_registry|user_points|subscription|plan_/);
  });

  it("seeds no price for an alias whose concrete model is unverified", () => {
    for (const alias of ["gemini-flash-lite-latest", "gemini-flash-latest", "ministral-14b-latest", "ministral-8b-latest", "open-mistral-nemo", "pixtral-12b-latest"]) {
      expect(SQL.slice(SQL.indexOf("INSERT INTO public.ai_price_book"))).not.toContain(`'${alias}'`);
    }
  });

  it("stores no content: the usage column is counts, and there is no user or prompt column", () => {
    const table = SQL.slice(SQL.indexOf("CREATE TABLE IF NOT EXISTS public.ai_usage_events"), SQL.indexOf("CREATE INDEX IF NOT EXISTS ai_usage_events_time_idx"));
    expect(table).not.toMatch(/\b(user_id|prompt|content|message|text)\s+(text|uuid|jsonb)/);
  });
});
