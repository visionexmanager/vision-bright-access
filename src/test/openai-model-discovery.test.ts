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
    expect(luna.patch).toEqual({
      owned_by: "system", upstream_created_at: "2025-06-15T15:06:40.000Z", first_seen_at: NOW, available: true, updated_at: NOW,
    });
    for (const curatedColumn of ["capabilities", "capability_source", "pricing", "routing_enabled", "display_name"]) {
      expect(luna.patch).not.toHaveProperty(curatedColumn);
    }
    // The heartbeat travels separately, so it never needs a patch of its own.
    expect(plan.lastSeen).toEqual(["gpt-5.6-luna"]);
  });

  it("a model that comes back is made available again, and its unavailable_since cleared", () => {
    const back = curated("gpt-4o", { available: false, unavailable_since: "2026-09-01T00:00:00+00:00", first_seen_at: NOW, owned_by: "system", upstream_created_at: "2025-06-15T15:06:40+00:00" });
    const plan = catalog.planReconciliation(catalog.normalizeOpenAIModels(listing("gpt-4o")), [back], NOW);
    expect(plan.seen).toEqual([{ model_id: "gpt-4o", patch: { available: true, unavailable_since: null, updated_at: NOW } }]);
    expect(plan.report.refreshed).toEqual(["gpt-4o"]);
  });

  it("reads PostgREST's +00:00 timestamps as the same instant, not a change", () => {
    const row = curated("gpt-4o", { available: true, first_seen_at: NOW, owned_by: "system", upstream_created_at: "2025-06-15T15:06:40+00:00" });
    const plan = catalog.planReconciliation(catalog.normalizeOpenAIModels(listing("gpt-4o")), [row], NOW);
    expect(plan.seen).toEqual([]);
    expect(plan.report.refreshed).toEqual([]);
  });

  it("is idempotent: the second run over the same list inserts, patches and marks nothing", () => {
    const first = catalog.planReconciliation(discovered, [curated("gpt-5.6-luna")], NOW);
    const afterFirst: Row[] = [
      curated("gpt-5.6-luna", { available: true, first_seen_at: NOW, ...first.seen[0].patch }),
      ...first.inserts.map((r) => ({ ...(r as unknown as Row) })),
    ];
    const second = catalog.planReconciliation(discovered, afterFirst, "2026-10-02T04:17:00.000Z");
    expect(second.inserts).toEqual([]);
    expect(second.unavailable).toEqual([]);
    // first_seen_at is set once and never moved again; nothing else differs.
    expect(second.seen).toEqual([]);
    expect(second.lastSeen).toEqual(["gpt-5.6-luna", "gpt-9-preview"]);
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
    expect(writes[2]).toEqual({ op: "update", value: { last_seen_at: NOW }, filters: [["eq", "provider", "openai"], ["in", "model_id", ["gpt-5.6-luna"]]] });
    expect(writes[3]).toMatchObject({ op: "update", value: { available: false, unavailable_since: NOW }, filters: [["eq", "provider", "openai"], ["in", "model_id", ["gpt-4o"]]] });
    expect(writes).toHaveLength(4);
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

// ── Against a catalog that keeps state ──────────────────────────────────────
//
// The fakes above record calls; this one applies them, with the table's
// primary key, so repeated runs can be compared row by row.

type Stored = Record<string, unknown>;
const CURATED_COLUMNS = ["capabilities", "capability_source", "pricing", "pricing_source", "pricing_verified_on", "routing_enabled", "display_name", "notes"];

/** The curated seed of 20261048000000, as far as these tests need it. */
const seed = (): Stored[] => [
  { model_id: "gpt-5.6-luna", display_name: "GPT-5.6 Luna", available: false, capabilities: ["chat", "vision"], capability_source: "curated",
    pricing: { unit: "usd_per_1m_tokens", input: 0.2, cached_input: 0.02, output: 1.2 }, pricing_source: "docs", pricing_verified_on: "2026-09-25", routing_enabled: true, notes: "curated" },
  { model_id: "gpt-4o", display_name: "GPT-4o", available: false, capabilities: ["chat", "vision"], capability_source: "curated",
    pricing: { unit: "usd_per_1m_tokens", input: 2.5, output: 10 }, pricing_source: "docs", pricing_verified_on: "2026-09-25", routing_enabled: false, notes: null },
  { model_id: "gpt-image-1", display_name: "GPT Image 1", available: true, capabilities: ["image"], capability_source: "curated",
    pricing: null, pricing_source: null, pricing_verified_on: null, routing_enabled: false, notes: null },
].map((r) => ({ provider: "openai", first_seen_at: null, last_seen_at: null, owned_by: null, upstream_created_at: null, unavailable_since: null, ...r }));

function catalogStore(initial: Stored[], options: { staleSelect?: Stored[] } = {}) {
  const rows = new Map<string, Stored>(initial.map((r) => [r.model_id as string, structuredClone(r)]));
  const log: Array<{ op: string; columns: string[]; ids: string[] }> = [];
  type Filter = ["eq" | "in", string, unknown];
  const match = (filters: Filter[]) => [...rows.values()].filter((r) =>
    filters.every(([kind, column, value]) => kind === "eq" ? r[column] === value : (value as unknown[]).includes(r[column])));
  const query = (run: (filters: Filter[]) => unknown) => {
    const filters: Filter[] = [];
    const chain = {
      eq: (column: string, value: unknown) => { filters.push(["eq", column, value]); return chain; },
      in: (column: string, value: unknown[]) => { filters.push(["in", column, value]); return chain; },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve().then(() => run(filters)).then(resolve, reject),
    };
    return chain;
  };
  const db = {
    from: (table: string) => {
      expect(table).toBe("ph_provider_models");
      return {
        select: () => query((filters) => ({
          data: options.staleSelect ? structuredClone(options.staleSelect) : match(filters).map((r) => structuredClone(r)),
          error: null,
        })),
        // INSERT … ON CONFLICT (provider, model_id) DO NOTHING — the only upsert discovery may send.
        upsert: async (values: Stored[], opts: unknown) => {
          expect(opts).toEqual({ onConflict: "provider,model_id", ignoreDuplicates: true });
          const ids: string[] = [];
          for (const v of values) {
            if (rows.has(v.model_id as string)) continue;
            rows.set(v.model_id as string, structuredClone(v));
            ids.push(v.model_id as string);
          }
          log.push({ op: "insert", columns: Object.keys(values[0] ?? {}), ids });
          return { error: null };
        },
        update: (patch: Stored) => query((filters) => {
          const hit = match(filters);
          for (const r of hit) Object.assign(r, structuredClone(patch));
          log.push({ op: "update", columns: Object.keys(patch), ids: hit.map((r) => r.model_id as string) });
          return { error: null };
        }),
        insert: () => { throw new Error("discovery inserts only through ON CONFLICT DO NOTHING"); },
        delete: () => { throw new Error("discovery must never delete"); },
      };
    },
  };
  return { db, rows, log };
}

const LISTED = ["gpt-5.6-luna", "gpt-4o", "gpt-5.6-sol", "gpt-9-preview", "dall-e-3", "sora-2", "gpt-4o-realtime-preview"];
const run = (db: unknown, ids: string[], at: string, dryRun = false) => discovery.discoverOpenAIModels({
  db, read: (name: string) => (name === "OPENAI_API_KEY" ? "k" : undefined), now: () => new Date(at),
  fetchImpl: (async () => new Response(JSON.stringify(listing(...ids)), { status: 200 })) as unknown as typeof fetch,
}, { dryRun });
const withoutHeartbeat = (rows: Map<string, Stored>) =>
  [...rows.values()].map(({ last_seen_at: _ignored, ...rest }) => rest).sort((a, b) => String(a.model_id).localeCompare(String(b.model_id)));
const curatedOf = (rows: Map<string, Stored>, ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, Object.fromEntries(CURATED_COLUMNS.map((c) => [c, rows.get(id)?.[c]]))]));

describe("F. idempotency, against a catalog that keeps state", () => {
  it("repeated runs converge: one row per model, and after the first run only the heartbeat is written", async () => {
    const store = catalogStore(seed());
    const first = await run(store.db, LISTED, NOW);
    expect(first.ok).toBe(true);
    const afterFirst = withoutHeartbeat(store.rows);
    expect(store.rows.size).toBe(3 + 5);

    for (const at of ["2026-10-02T04:17:00.000Z", "2026-10-09T04:17:00.000Z"]) {
      store.log.length = 0;
      const again = await run(store.db, LISTED, at);
      expect(again).toMatchObject({ ok: true, dryRun: false, report: { new: [], refreshed: [], now_unavailable: [] } });
      // No insert, no patch, no mark: one heartbeat update naming the listed models.
      expect(store.log.map((l) => ({ ...l, ids: l.ids.slice().sort() }))).toEqual([{ op: "update", columns: ["last_seen_at"], ids: LISTED.slice().sort() }]);
      expect(withoutHeartbeat(store.rows)).toEqual(afterFirst);
      expect(store.rows.get("gpt-4o")?.last_seen_at).toBe(at);
      expect(store.rows.size).toBe(8);
    }
  });

  it("the same report every time, apart from what changed on the first run", async () => {
    const store = catalogStore(seed());
    const first = await run(store.db, LISTED, NOW);
    const second = await run(store.db, LISTED, "2026-10-02T04:17:00.000Z");
    if (!first.ok || !second.ok) throw new Error("discovery failed");
    // What changed happens once; what the catalog holds is reported the same way every time.
    expect(second.report).toMatchObject({ new: [], refreshed: [], now_unavailable: [], already_registered: first.report.returned });
    const steady = ({ returned, missing_pricing, missing_capabilities, routing_eligible }: typeof first.report) =>
      ({ returned, missing_pricing, missing_capabilities, routing_eligible });
    expect(steady(second.report)).toEqual(steady(first.report));
  });

  it("a model listed twice in one response is one row", async () => {
    const store = catalogStore(seed());
    await run(store.db, ["gpt-9-preview", "gpt-9-preview", "gpt-5.6-luna"], NOW);
    expect([...store.rows.keys()].filter((id) => id === "gpt-9-preview")).toHaveLength(1);
    expect(store.log.filter((l) => l.op === "insert").flatMap((l) => l.ids)).toEqual(["gpt-9-preview"]);
  });

  it("a dry run leaves every row exactly as it was", async () => {
    const store = catalogStore(seed());
    const before = structuredClone([...store.rows.values()]);
    const outcome = await run(store.db, LISTED, NOW, true);
    expect(outcome).toMatchObject({ ok: true, dryRun: true });
    expect(store.log).toEqual([]);
    expect([...store.rows.values()]).toEqual(before);
  });

  it("batches the heartbeat so no id list outgrows a URL", async () => {
    const many = Array.from({ length: 120 }, (_, i) => `gpt-x-${String(i).padStart(3, "0")}`);
    const store = catalogStore(many.map((model_id) => ({ ...seed()[2], model_id, capabilities: [], capability_source: "unknown", first_seen_at: NOW, owned_by: "system", upstream_created_at: "2025-06-15T15:06:40+00:00", available: true })));
    await run(store.db, many, NOW);
    expect(store.log.map((l) => l.ids.length)).toEqual([50, 50, 20]);
    expect(store.log.every((l) => l.columns.join() === "last_seen_at")).toBe(true);
  });
});

describe("G. what discovery can never do to the registry", () => {
  it("never changes a curated column — pricing, capabilities, routing_enabled — however many times it runs", async () => {
    const store = catalogStore(seed());
    const ids = ["gpt-5.6-luna", "gpt-4o", "gpt-image-1"];
    const before = curatedOf(store.rows, ids);
    await run(store.db, LISTED, NOW);                          // gpt-image-1 vanishes here
    await run(store.db, [...LISTED, "gpt-image-1"], "2026-10-02T04:17:00.000Z"); // and comes back
    expect(curatedOf(store.rows, ids)).toEqual(before);
    // Every update discovery sent touched discovery columns only.
    const discoveryColumns = new Set(["owned_by", "upstream_created_at", "first_seen_at", "last_seen_at", "available", "unavailable_since", "updated_at"]);
    for (const entry of store.log.filter((l) => l.op === "update")) {
      for (const column of entry.columns) expect(discoveryColumns).toContain(column);
    }
  });

  it("a row an admin curated after discovery read the catalog is not overwritten", async () => {
    const curatedMeanwhile = { ...seed()[1], model_id: "gpt-9-preview", pricing: { unit: "usd_per_1m_tokens", input: 3 }, routing_enabled: true };
    // Discovery read the catalog before the admin's row existed.
    const store = catalogStore([...seed(), curatedMeanwhile], { staleSelect: seed() });
    await run(store.db, LISTED, NOW);
    expect(store.rows.get("gpt-9-preview")).toMatchObject({ pricing: { input: 3 }, routing_enabled: true, capability_source: "curated" });
  });

  it("registers a new model unpriced and never routing-enabled, whatever its name suggests", async () => {
    const store = catalogStore(seed());
    const outcome = await run(store.db, LISTED, NOW);
    if (!outcome.ok) throw new Error("discovery failed");
    const added = outcome.report.new;
    expect(added).toEqual(["dall-e-3", "gpt-4o-realtime-preview", "gpt-5.6-sol", "gpt-9-preview", "sora-2"]);
    for (const id of added) {
      expect(store.rows.get(id)).toMatchObject({ pricing: null, routing_enabled: false, available: true });
      expect(store.rows.get(id)?.capability_source).not.toBe("curated");
      expect(outcome.report.routing_eligible).not.toContain(id);
    }
    // Only a model an admin already enabled and priced can be eligible.
    expect(outcome.report.routing_eligible).toEqual(["gpt-5.6-luna"]);
  });

  it("never deletes: a vanished model stays, marked unavailable", async () => {
    const store = catalogStore(seed());
    await run(store.db, ["gpt-5.6-luna"], NOW);
    expect(store.rows.size).toBe(3);
    expect(store.rows.get("gpt-image-1")).toMatchObject({ available: false, unavailable_since: NOW });
    // Marked once: a second run does not move unavailable_since.
    await run(store.db, ["gpt-5.6-luna"], "2026-10-02T04:17:00.000Z");
    expect(store.rows.get("gpt-image-1")?.unavailable_since).toBe(NOW);
    for (const file of ["openaiModelDiscovery.ts", "openaiModelCatalog.ts"]) {
      expect(readFileSync(`supabase/functions/_shared/${file}`, "utf8")).not.toMatch(/\.delete\(|\.insert\(|routing_enabled: true/);
    }
  });
});

describe("H. one switch, and no route reads the catalog", () => {
  const hub = readFileSync("supabase/functions/provider-hub/index.ts", "utf8").replace(/\r\n/g, "\n");
  const workflow = readFileSync(".github/workflows/openai-model-discovery-cron.yml", "utf8");

  it("the workflow applies only when OPENAI_MODEL_DISCOVERY_APPLY is \"true\" — a manual run has no override", () => {
    const apply = workflow.match(/^\s*APPLY: (.*)$/m)?.[1];
    expect(apply).toBe("${{ vars.OPENAI_MODEL_DISCOVERY_APPLY == 'true' }}");
    expect(workflow).not.toMatch(/inputs\.|inputs:/);
    expect(workflow).toContain('if [ "$APPLY" = "true" ]; then apply=true; else apply=false; fi');
  });

  it("provider-hub's admin action is always a dry run", () => {
    expect(hub).toContain('if (action === "discover_openai_models") {\n    return discoveryResponse(await runDiscovery(true));');
    expect(hub).not.toContain("body.dry_run");
    // The definition, the cron branch and the admin action — nowhere else.
    expect(hub.match(/runDiscovery\(/g)).toHaveLength(3);
  });

  it("no provider route reads the catalog: only discovery and provider-hub name it", () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = `${dir}/${n}`;
      return statSync(p).isDirectory() ? walk(p) : /\.ts$/.test(n) ? [p] : [];
    });
    const readers = walk("supabase/functions")
      .filter((f) => /ph_provider_models|openaiModel(Catalog|Discovery)/.test(readFileSync(f, "utf8")))
      .sort();
    expect(readers).toEqual([
      "supabase/functions/_shared/openaiModelCatalog.ts",
      "supabase/functions/_shared/openaiModelDiscovery.ts",
      "supabase/functions/provider-hub/index.ts",
    ]);
    // And provider-hub reads it for list_models only, never to pick a provider.
    expect(hub.match(/\.from\("ph_provider_models"\)/g)).toHaveLength(1);
  });
});
