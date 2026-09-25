import { readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// OpenAI model discovery: GET /v1/models on the existing key, reconciled into
// ph_provider_models. Discovery registers and refreshes; it never enables
// routing, never writes a price, and never deletes. Nothing here touches the
// network or a database — both are fakes.

const catalog = await import("../../supabase/functions/_shared/openaiModelCatalog.ts");
const discovery = await import("../../supabase/functions/_shared/openaiModelDiscovery.ts");

const NOW = "2026-09-25T04:17:00.000Z";
const listing = (...ids: unknown[]) => ({ object: "list", data: ids.map((id) => ({ id, object: "model", owned_by: "system", created: 1_750_000_000 })) });

type Row = import("../../supabase/functions/_shared/openaiModelCatalog.ts").CatalogRow;
const curated = (model_id: string, extra: Partial<Row> = {}): Row => ({
  model_id, available: false, capabilities: ["chat", "vision"], capability_source: "curated",
  pricing: { unit: "usd_per_1m_tokens", input: 0.2, output: 1.2 }, routing_enabled: true, first_seen_at: null, ...extra,
});

describe("A. normalising what /v1/models returns", () => {
  it("keeps the exact model id, de-duplicates, and sorts", () => {
    const models = catalog.normalizeOpenAIModels(listing("gpt-5.6-luna", "gpt-4o-mini", "gpt-5.6-luna"));
    expect(models.map((m) => m.model_id)).toEqual(["gpt-4o-mini", "gpt-5.6-luna"]);
    expect(models[1]).toEqual({ model_id: "gpt-5.6-luna", owned_by: "system", upstream_created_at: "2025-06-15T15:06:40.000Z" });
  });

  it("drops what is not a model id rather than repairing it", () => {
    const models = catalog.normalizeOpenAIModels(listing("GPT 5.6 Luna", "", "a/b", 42, "x".repeat(200), "ok-model"));
    expect(models.map((m) => m.model_id)).toEqual(["ok-model"]);
  });

  it("answers an unexpected shape with nothing", () => {
    expect(catalog.normalizeOpenAIModels(null)).toEqual([]);
    expect(catalog.normalizeOpenAIModels({ data: "no" })).toEqual([]);
  });
});

describe("D. capabilities are narrow, and unknown fails closed", () => {
  const cases: Array<[string, string[]]> = [
    ["gpt-5.6-luna", ["chat"]], ["gpt-5.6-sol", ["chat"]], ["gpt-4o-mini", ["chat"]], ["gpt-4.1-2025-04-14", ["chat"]],
    ["gpt-image-1", ["image"]], ["dall-e-3", ["image"]],
    ["tts-1", ["tts"]], ["gpt-4o-mini-tts", ["tts"]],
    ["whisper-1", ["stt"]], ["gpt-4o-transcribe", ["stt"]],
    ["text-embedding-3-small", ["embedding"]],
    // Everything a name alone cannot settle gets nothing.
    ["gpt-4o-realtime-preview", []], ["gpt-4o-audio-preview", []], ["gpt-4o-search-preview", []],
    ["omni-moderation-latest", []], ["o4-mini", []], ["gpt-5.6-codex", []], ["babbage-002", []],
    ["sora-2", []], ["some-new-thing", []],
  ];
  for (const [id, expected] of cases) {
    it(`${id} → ${expected.join(",") || "nothing"}`, () => expect(catalog.classifyOpenAIModel(id)).toEqual(expected));
  }

  it("never infers vision, speech or generation onto a text model from its name", () => {
    for (const id of ["gpt-5.6-luna", "gpt-4o", "gpt-4.1-mini"]) {
      expect(catalog.classifyOpenAIModel(id)).not.toEqual(expect.arrayContaining(["vision"]));
      for (const media of ["tts", "stt", "image", "text_to_video"]) expect(catalog.classifyOpenAIModel(id)).not.toContain(media);
    }
  });
});

describe("B. reconciliation", () => {
  const discovered = catalog.normalizeOpenAIModels(listing("gpt-5.6-luna", "gpt-9-preview"));

  it("inserts a new model once, unpriced and not routing-enabled", () => {
    const plan = catalog.planReconciliation(discovered, [curated("gpt-5.6-luna")], NOW);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({
      provider: "openai", model_id: "gpt-9-preview", available: true, pricing: null, routing_enabled: false,
      capabilities: [], capability_source: "unknown",
    });
  });

  it("refreshes an existing model's discovery columns and nothing curated", () => {
    const plan = catalog.planReconciliation(discovered, [curated("gpt-5.6-luna")], NOW);
    const luna = plan.seen.find((s) => s.model_id === "gpt-5.6-luna")!;
    expect(luna.patch).toMatchObject({ available: true, last_seen_at: NOW, first_seen_at: NOW, unavailable_since: null });
    for (const curatedColumn of ["capabilities", "capability_source", "pricing", "routing_enabled", "display_name"]) {
      expect(luna.patch).not.toHaveProperty(curatedColumn);
    }
  });

  it("is idempotent: the second run over the same list inserts nothing", () => {
    const first = catalog.planReconciliation(discovered, [curated("gpt-5.6-luna")], NOW);
    const afterFirst: Row[] = [
      curated("gpt-5.6-luna", { available: true, first_seen_at: NOW }),
      ...first.inserts.map((r) => ({ ...(r as unknown as Row) })),
    ];
    const second = catalog.planReconciliation(discovered, afterFirst, NOW);
    expect(second.inserts).toEqual([]);
    expect(second.unavailable).toEqual([]);
    expect(second.seen.map((s) => s.model_id)).toEqual(["gpt-5.6-luna", "gpt-9-preview"]);
    // first_seen_at is set once and never moved again.
    expect(second.seen[0].patch).not.toHaveProperty("first_seen_at");
  });

  it("marks a vanished model unavailable — once — and never deletes it", () => {
    const existing = [curated("gpt-5.6-luna", { available: true }), curated("gpt-4o", { available: true }), curated("old", { available: false })];
    const plan = catalog.planReconciliation(catalog.normalizeOpenAIModels(listing("gpt-5.6-luna")), existing, NOW);
    expect(plan.unavailable).toEqual(["gpt-4o"]);
    expect(plan.report.now_unavailable).toEqual(["gpt-4o"]);
    expect(Object.keys(plan)).not.toContain("deletes");
  });

  it("reports routing eligibility only when available, priced, capable and enabled", () => {
    const plan = catalog.planReconciliation(
      catalog.normalizeOpenAIModels(listing("gpt-5.6-luna", "priced-off", "unpriced", "gpt-9-preview")),
      [
        curated("gpt-5.6-luna"),
        curated("priced-off", { routing_enabled: false }),
        curated("unpriced", { pricing: null }),
        curated("not-seen", { available: true }),
      ],
      NOW,
    );
    expect(plan.report.routing_eligible).toEqual(["gpt-5.6-luna"]);
    expect(plan.report.missing_pricing).toEqual(["gpt-9-preview", "unpriced"]);
    expect(plan.report.missing_capabilities).toEqual(["gpt-9-preview"]);
    expect(plan.report.new).toEqual(["gpt-9-preview"]);
  });

  it("E. never treats unknown pricing as a price", () => {
    expect(catalog.isRoutingEligible({ available: true, routing_enabled: true, capabilities: ["chat"], pricing: null })).toBe(false);
    expect(catalog.isRoutingEligible({ available: true, routing_enabled: true, capabilities: [], pricing: { input: 1 } })).toBe(false);
    expect(catalog.isRoutingEligible({ available: false, routing_enabled: true, capabilities: ["chat"], pricing: { input: 1 } })).toBe(false);
  });
});

/** A fake service client that records every write. */
function fakeDb(rows: Row[]) {
  const writes: Array<{ op: string; value: unknown; filters: unknown[] }> = [];
  const builder = (op: string, value?: unknown) => {
    const filters: unknown[] = [];
    const chain: Record<string, unknown> = {
      eq: (...a: unknown[]) => { filters.push(["eq", ...a]); return chain; },
      in: (...a: unknown[]) => { filters.push(["in", ...a]); return chain; },
      then: (resolve: (v: unknown) => void) => {
        if (op !== "select") writes.push({ op, value, filters });
        resolve(op === "select" ? { data: rows, error: null } : { error: null });
      },
    };
    return chain;
  };
  const db = {
    from: (table: string) => {
      expect(table).toBe("ph_provider_models");
      return {
        select: () => builder("select"),
        upsert: (value: unknown, options: unknown) => { writes.push({ op: "upsert", value, filters: [options] }); return Promise.resolve({ error: null }); },
        update: (value: unknown) => builder("update", value),
        delete: () => { throw new Error("discovery must never delete"); },
      };
    },
  };
  return { db, writes };
}

describe("discovery against a fake OpenAI and a fake catalog", () => {
  const env = (values: Record<string, string>) => (name: string) => values[name];
  const openai = (body: unknown, status = 200) => vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status }));

  it("A. authenticates with the existing key, on GET /v1/models", async () => {
    const fetchImpl = openai(listing("gpt-5.6-luna"));
    const { db } = fakeDb([curated("gpt-5.6-luna")]);
    await discovery.discoverOpenAIModels({ db, read: env({ OPENAI_API_KEY: "sk-test" }), fetchImpl: fetchImpl as unknown as typeof fetch }, { dryRun: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/models");
    expect(init?.method).toBe("GET");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
  });

  it("a dry run reports and writes nothing", async () => {
    const { db, writes } = fakeDb([curated("gpt-5.6-luna")]);
    const outcome = await discovery.discoverOpenAIModels(
      { db, read: env({ OPENAI_API_KEY: "k" }), fetchImpl: openai(listing("gpt-5.6-luna", "gpt-9")) as unknown as typeof fetch },
      { dryRun: true },
    );
    expect(outcome).toMatchObject({ ok: true, dryRun: true, report: { new: ["gpt-9"], routing_eligible: ["gpt-5.6-luna"] } });
    expect(writes).toEqual([]);
  });

  it("an applied run inserts with ignoreDuplicates, updates by exact id, and marks — never deletes", async () => {
    const { db, writes } = fakeDb([curated("gpt-5.6-luna"), curated("gpt-4o", { available: true })]);
    const outcome = await discovery.discoverOpenAIModels(
      { db, read: env({ OPENAI_API_KEY: "k" }), fetchImpl: openai(listing("gpt-5.6-luna", "gpt-9")) as unknown as typeof fetch, now: () => new Date(NOW) },
      { dryRun: false },
    );
    expect(outcome.ok).toBe(true);
    expect(writes[0]).toMatchObject({ op: "upsert", filters: [{ onConflict: "provider,model_id", ignoreDuplicates: true }] });
    expect(writes[1]).toMatchObject({ op: "update", filters: [["eq", "provider", "openai"], ["eq", "model_id", "gpt-5.6-luna"]] });
    expect(writes[2]).toMatchObject({ op: "update", value: { available: false, unavailable_since: NOW }, filters: [["eq", "provider", "openai"], ["in", "model_id", ["gpt-4o"]]] });
  });

  it("refuses an empty listing instead of marking every model unavailable", async () => {
    const { db, writes } = fakeDb([curated("gpt-5.6-luna", { available: true })]);
    const outcome = await discovery.discoverOpenAIModels(
      { db, read: env({ OPENAI_API_KEY: "k" }), fetchImpl: openai({ data: [] }) as unknown as typeof fetch }, { dryRun: false });
    expect(outcome).toEqual({ ok: false, error: "empty" });
    expect(writes).toEqual([]);
  });

  it("C. fails with a code, never the key or OpenAI's body", async () => {
    const { db } = fakeDb([]);
    const rejected = await discovery.discoverOpenAIModels(
      { db, read: env({ OPENAI_API_KEY: "sk-live-secret" }), fetchImpl: openai({ error: { message: "Incorrect API key provided: sk-live-secret" } }, 401) as unknown as typeof fetch },
      { dryRun: true });
    expect(rejected).toEqual({ ok: false, error: "rejected", status: 401 });
    expect(JSON.stringify(rejected)).not.toContain("sk-live");
    expect(await discovery.discoverOpenAIModels({ db, read: env({}) }, { dryRun: true })).toEqual({ ok: false, error: "no_key" });
  });
});

describe("C. discovery is server-side and admin- or cron-only", () => {
  const hub = readFileSync("supabase/functions/provider-hub/index.ts", "utf8");

  it("the cron secret is compared in constant time, fails closed, and can run one action only", () => {
    const start = hub.indexOf("── The scheduled discovery");
    const cron = hub.slice(start, hub.indexOf("const supabaseUrl = Deno.env.get(\"SUPABASE_URL\")", start));
    expect(start).toBeGreaterThan(0);
    expect(cron).toContain("if (cronSecret && secretsMatch(authHeader, `Bearer ${cronSecret}`))");
    expect(cron).toContain('if (query.get("action") !== "discover_openai_models") return err("Forbidden", 403);');
    // A dry run unless apply=true is said explicitly — and no body is read here.
    expect(cron).toContain('runDiscovery(query.get("apply") !== "true")');
    expect(cron).not.toContain("req.json()");
  });

  it("the admin actions sit after the has_role gate", () => {
    const gate = hub.indexOf('_role: "admin"');
    expect(gate).toBeGreaterThan(0);
    expect(hub.indexOf('action === "discover_openai_models"')).toBeGreaterThan(gate);
    expect(hub.indexOf('action === "list_models"')).toBeGreaterThan(gate);
  });

  it("both verify_jwt lists name provider-hub, so the gateway lets the cron through", () => {
    expect(readFileSync("supabase/config.toml", "utf8")).toMatch(/\[functions\.provider-hub\]\s*\nverify_jwt = false/);
    expect(readFileSync("scripts/deploy-changed-supabase-functions.sh", "utf8")).toContain("[provider-hub]=1");
  });

  it("no browser code references the catalog or discovery", () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = `${dir}/${n}`;
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
    });
    const offenders = walk("src").filter((f) => !f.includes("/test/") && !f.endsWith("integrations/supabase/types.ts"))
      .filter((f) => /ph_provider_models|discover_openai_models|v1\/models/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the workflow logs counts, never ids", () => {
    const workflow = readFileSync(".github/workflows/openai-model-discovery-cron.yml", "utf8");
    expect(workflow).toContain("Counts only — never the ids, never the body.");
    expect(workflow).not.toMatch(/cat response\.json|echo "\$\(cat/);
    expect(workflow).toContain("vars.OPENAI_MODEL_DISCOVERY_APPLY == 'true'");
  });
});

describe("the catalog migration", () => {
  const sql = readFileSync("supabase/migrations/20261048000000_provider_model_catalog.sql", "utf8").replace(/--[^\n]*/g, "");

  it("is service-only, like every other registry table", () => {
    expect(sql).toContain("ALTER TABLE public.ph_provider_models ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("REVOKE ALL ON TABLE public.ph_provider_models FROM PUBLIC, anon, authenticated;");
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it("refuses a zero or missing price at the database, not only in code", () => {
    expect(sql).toContain("AND (pricing ->> 'input')::numeric > 0");
    expect(sql).toContain("(NOT (pricing ? 'output') OR (pricing ->> 'output')::numeric > 0)");
  });

  it("defines routing eligibility once, in a view", () => {
    expect(sql).toMatch(/WHERE available\s+AND routing_enabled\s+AND pricing IS NOT NULL\s+AND cardinality\(capabilities\) > 0;/);
  });
});
