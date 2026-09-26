// Phase 2J-2: provider registry shadow mode. Telemetry only — it works out what
// the registry *would* choose and writes it down; it never changes what is
// chosen, what is sent, what is returned or what is billed.

import { readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  observeShadow,
  rankProviders,
  SHADOW_ENV,
  shadowEnabled,
  type RankableProvider,
} from "../../supabase/functions/_shared/providerSelection.ts";

const studio = readFileSync("supabase/functions/video-studio/index.ts", "utf8");
const selection = readFileSync("supabase/functions/_shared/providerSelection.ts", "utf8");

afterEach(() => vi.useRealTimers());

const row = (slug: string, over: Partial<RankableProvider> = {}): RankableProvider => ({
  id: `id-${slug}`, slug, priority: 10, health_score: 100, avg_latency_ms: 0, cost_per_request: 0, capabilities: [], ...over,
});

/** resolveProvider's ranking exactly as it was before Phase 2J-2 moved it. */
function legacyRank(providers: RankableProvider[], prefs?: { requireCapabilities?: string[]; preferredSlug?: string; excludeSlugs?: string[] }) {
  const score = (p: RankableProvider) =>
    Math.max(0, 100 - (p.avg_latency_ms / 20)) * 0.25 + Math.max(0, 100 - (p.cost_per_request * 500)) * 0.20 +
    p.health_score * 0.40 + Math.max(0, 100 - p.priority) * 0.15;
  let eligible = providers.filter((p) => p.health_score > 20 && !(prefs?.excludeSlugs?.includes(p.slug)));
  if (prefs?.requireCapabilities?.length) {
    const req = prefs.requireCapabilities;
    eligible = eligible.filter((p) => req.every((c) => p.capabilities.includes(c)));
  }
  if (!eligible.length) return null;
  if (prefs?.preferredSlug) {
    const preferred = eligible.find((p) => p.slug === prefs.preferredSlug);
    if (preferred) return { provider: preferred, alternatives: eligible.filter((p) => p.slug !== prefs.preferredSlug) };
  }
  eligible.sort((a, b) => score(b) - score(a));
  return { provider: eligible[0], alternatives: eligible.slice(1) };
}

describe("1. the registry's own ranking, now testable", () => {
  it("is exactly resolveProvider's previous ranking, on 500 random registries", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 500; i++) {
      const rows = Array.from({ length: 1 + Math.floor(rand() * 5) }, (_, k) => row(`p${k}`, {
        priority: Math.floor(rand() * 100),
        health_score: Math.floor(rand() * 101),
        avg_latency_ms: Math.floor(rand() * 5000),
        cost_per_request: Math.round(rand() * 300) / 1000,
        capabilities: rand() > 0.5 ? ["a"] : [],
      }));
      const prefs = rand() > 0.6 ? { preferredSlug: `p${Math.floor(rand() * 5)}`, requireCapabilities: rand() > 0.5 ? ["a"] : undefined } : undefined;
      expect(rankProviders(rows.map((r) => ({ ...r })), prefs)?.provider.slug ?? null)
        .toBe(legacyRank(rows.map((r) => ({ ...r })), prefs)?.provider.slug ?? null);
    }
  });

  it("drops rows at or below health 20 and honours an eligible preference", () => {
    expect(rankProviders([row("a", { health_score: 20 }), row("b", { health_score: 21 })])?.provider.slug).toBe("b");
    expect(rankProviders([row("a"), row("b", { priority: 90 })], { preferredSlug: "b" })?.provider.slug).toBe("b");
    expect(rankProviders([row("a", { health_score: 0 })])).toBeNull();
  });
});

/** A service client stand-in: the ph_providers answer and what reaches ph_logs. */
function fakeDb(answer: unknown, opts: { insertThrows?: boolean; fromThrows?: boolean } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const selects: string[] = [];
  const db = {
    from(table: string) {
      if (opts.fromThrows) throw new Error("boom");
      if (table === "ph_logs") {
        return { insert: async (r: Record<string, unknown>) => { if (opts.insertThrows) throw new Error("log down"); inserts.push(r); return {}; } };
      }
      const chain = {
        select: (cols: string) => { selects.push(cols); return chain; },
        eq: () => chain, neq: () => chain,
        order: () => answer,
      };
      return chain;
    },
  };
  return { db, inserts, selects };
}

const REQUEST = { service: "video-studio", jobType: "text_to_video", routingMode: "auto", actualSlug: "openai-video", correlationId: "job-1" };

describe("2. observeShadow records what the registry would choose", () => {
  it("a match: the registry agrees with the provider actually used", async () => {
    const { db, inserts } = fakeDb(Promise.resolve({ data: [row("openai-video"), row("luma-video", { priority: 50 })], error: null }));
    expect(await observeShadow(db, REQUEST)).toBe("match");
    expect(inserts).toEqual([{
      provider_id: "id-openai-video", provider_slug: "openai-video", job_type: "text_to_video",
      action: "shadow_selection", status: "skipped", error_code: "match",
      error_message: "shadow observation — not executed",
      request_meta: {
        service: "video-studio", routing_mode: "auto", actual_provider: "openai-video", correlation_id: "job-1",
        // Since the 2J-2 hardening: what was considered, ranked (see section 8).
        candidates: [
          { slug: "openai-video", status: null, eligible: true, rank: 1, health_score: 100, priority: 10, avg_latency_ms: 0 },
          { slug: "luma-video", status: null, eligible: true, rank: 2, health_score: 100, priority: 50, avg_latency_ms: 0 },
        ],
        candidate_count: 2,
      },
    }]);
  });

  it("a mismatch is recorded, not acted on", async () => {
    const { db, inserts } = fakeDb(Promise.resolve({ data: [row("luma-video", { priority: 1 }), row("openai-video", { health_score: 30 })], error: null }));
    expect(await observeShadow(db, REQUEST)).toBe("mismatch");
    expect(inserts[0]).toMatchObject({ provider_slug: "luma-video", error_code: "mismatch" });
  });

  it("no eligible provider: recorded as no_candidate, with no provider named", async () => {
    const { db, inserts } = fakeDb(Promise.resolve({ data: [row("openai-video", { health_score: 5 })], error: null }));
    expect(await observeShadow(db, REQUEST)).toBe("no_candidate");
    expect(inserts[0]).toMatchObject({ provider_id: null, provider_slug: null, error_code: "no_candidate" });
  });

  it.each([
    // `registry_error` was split in the 2J-2 hardening; see section 8.
    ["query_error", () => Promise.resolve({ data: null, error: { message: "permission denied" } })],
    ["malformed", () => Promise.resolve({ data: [{ id: 1, slug: null }], error: null })],
    ["query_error", () => Promise.reject(new Error("socket"))],
  ])("a bad registry answer is recorded as %s and never thrown", async (code, answer) => {
    const { db, inserts } = fakeDb(answer());
    await expect(observeShadow(db, REQUEST)).resolves.toBe(code);
    expect(inserts[0]).toMatchObject({ error_code: code, provider_slug: null });
  });

  it("a hanging registry times out and is recorded as such", async () => {
    vi.useFakeTimers();
    const { db, inserts } = fakeDb(new Promise(() => {}));
    const pending = observeShadow(db, REQUEST, { timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(60);
    expect(await pending).toBe("timeout");
    expect(inserts[0]).toMatchObject({ error_code: "timeout" });
  });

  it("a database that throws, or a log write that fails, never escapes", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(observeShadow(fakeDb(null, { fromThrows: true }).db, REQUEST)).resolves.toBe("unexpected_error");
    const good = Promise.resolve({ data: [row("openai-video")], error: null });
    await expect(observeShadow(fakeDb(good, { insertThrows: true }).db, REQUEST)).resolves.toBe("match");
    quiet.mockRestore();
  });
});

describe("3. nothing sensitive is read into it or written out of it", () => {
  it("selects only the ranking columns — no key reference, config or URL", async () => {
    const { db, selects } = fakeDb(Promise.resolve({ data: [row("openai-video")], error: null }));
    await observeShadow(db, REQUEST);
    // `status` joined in the 2J-2 hardening, read only to be recorded.
    expect(selects).toEqual(["id, slug, status, priority, health_score, avg_latency_ms, cost_per_request, capabilities"]);
    expect(selects[0]).not.toMatch(/api_key_ref|config|base_url|\*/);
  });

  it("writes no cost, key, prompt or user field", async () => {
    const { db, inserts } = fakeDb(Promise.resolve({ data: [row("openai-video", { cost_per_request: 0.2, avg_latency_ms: 900 })], error: null }));
    await observeShadow(db, REQUEST);
    const text = JSON.stringify(inserts);
    expect(Object.keys(inserts[0]).sort()).toEqual(
      ["action", "error_code", "error_message", "job_type", "provider_id", "provider_slug", "request_meta", "status"]);
    expect(Object.keys(inserts[0].request_meta as object).sort()).toEqual(
      ["actual_provider", "candidate_count", "candidates", "correlation_id", "routing_mode", "service"]);
    // Latency is recorded on purpose since the hardening — a ranking input that
    // explains a choice. Cost never is: not as a field, not as a score.
    // The slug "openai-video" is the one provider name it may carry; no secret name.
    expect(text).not.toMatch(/cost|0\.2|"score"|api_key|OPENAI_API_KEY|prompt|user_id/i);
  });

  it("never touches metrics or health", () => {
    // Reads health to rank; writes nothing but its own ph_logs row.
    const code = selection.replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/ph_record_metric|ph_metrics|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
    expect(code.match(/\.insert\(/g)).toHaveLength(1);
    expect(code).toMatch(/db\.from\("ph_logs"\)\.insert\(/);
  });
});

describe("4. off by default", () => {
  it("is on only for the exact value \"true\"", () => {
    expect(SHADOW_ENV).toBe("PROVIDER_REGISTRY_SHADOW");
    expect(shadowEnabled(() => undefined)).toBe(false);
    for (const v of ["", "1", "TRUE", "yes", "false", " true"]) expect(shadowEnabled(() => v), v).toBe(false);
    expect(shadowEnabled(() => "true")).toBe(true);
    expect(shadowEnabled(() => { throw new Error("no env"); })).toBe(false);
  });

  it("with no Deno environment at all, it is off", () => {
    expect(shadowEnabled()).toBe(false);
  });

  it("video-studio checks the switch before doing anything", () => {
    const fn = studio.slice(studio.indexOf("function shadowAutoChoice("), studio.indexOf("// ── Handlers"));
    expect(fn.indexOf("if (!shadowEnabled()) return;")).toBeGreaterThan(0);
    expect(fn.indexOf("if (!shadowEnabled()) return;")).toBeLessThan(fn.indexOf("observeShadow("));
  });
});

describe("5. video-studio's real request is untouched", () => {
  const generate = studio.slice(studio.indexOf("async function handleGenerate("), studio.indexOf("async function handlePoll("));

  it("observes only auto requests, after the job exists and before submission, without waiting", () => {
    const call = 'if (!providerName || providerName === "auto") shadowAutoChoice(dbService, provider.name, job.id);';
    expect(generate).toContain(call);
    expect(generate.indexOf(call)).toBeGreaterThan(generate.indexOf('.from("vx_video_jobs")'));
    expect(generate.indexOf(call)).toBeLessThan(generate.indexOf("provider.generateVideo("));
    expect(generate).not.toMatch(/await shadowAutoChoice|=\s*shadowAutoChoice|await observeShadow/);
    expect(studio).toMatch(/function shadowAutoChoice\([\s\S]*?\): void \{/);
  });

  it("never replaces the provider: getProvider's choice is the only one", () => {
    expect(generate.match(/provider = /g)).toHaveLength(1);
    expect(generate).toContain('const name = (providerName as string) || "auto";');
    expect(generate).toContain("provider = getProvider(name, { falRoutable });");
    const fn = studio.slice(studio.indexOf("function shadowAutoChoice("), studio.indexOf("// ── Handlers"));
    expect(fn).not.toMatch(/return [^;]*observ|getProvider|provider\s*=/);
  });

  it("sends the provider exactly the request it sent before", () => {
    const params = generate.slice(generate.indexOf("provider.generateVideo({"), generate.indexOf("});", generate.indexOf("provider.generateVideo({")));
    expect(params.replace(/\s+/g, " ").trim()).toBe(
      "provider.generateVideo({ prompt: job.prompt, negativePrompt: job.negative_prompt ?? undefined, style: job.style, durationSec: job.duration_sec, aspectRatio: job.aspect_ratio, resolution: job.resolution, fps: job.fps, cameraMotion: job.camera_motion, creativity: job.creativity, seed: job.seed ?? undefined, model: job.provider_model, idempotencyKey: job.id,");
  });

  it("keeps the environment rule and the RunPod gate — the only fallback behaviour there is", () => {
    // auto: Luma, or FAL only when Luma has no key and fal-video is routable (2026-09-26).
    expect(studio).toContain('if (!requested) requested = !lumaKey && opts.falRoutable && falKey ? "fal" : "luma";');
    expect(studio).toContain("const readiness  = runpodReadiness(endpointId);");
    expect(studio).not.toMatch(/resolveProvider|rankProviders/);
  });

  it("returns nothing new to the caller", () => {
    expect(generate).toContain("return json({ ok: true, job_id: job.id });");
    expect(generate).not.toMatch(/json\([^)]*shadow/i);
  });

  it("a shadow that throws synchronously is swallowed", () => {
    const fn = studio.slice(studio.indexOf("function shadowAutoChoice("), studio.indexOf("// ── Handlers"));
    expect(fn).toMatch(/try \{[\s\S]*observeShadow\([\s\S]*\.catch\(\(\) => undefined\)[\s\S]*\} catch \{/);
  });
});

describe("6. the request a caller makes is the request that runs, with shadow on or off", () => {
  // The shape video-studio uses, driven for real: choose, observe (unawaited),
  // submit. The shadow picks a different provider and then throws; the
  // submission must be byte-identical either way.
  async function generate(shadow: "off" | "disagrees" | "throws") {
    const sent: unknown[] = [];
    const provider = { name: "openai", generateVideo: async (p: unknown) => { sent.push(p); return { ok: true }; } };
    if (shadow !== "off") {
      const db = shadow === "throws"
        ? { from() { throw new Error("registry down"); } }
        : fakeDb(Promise.resolve({ data: [row("luma-video", { priority: 1 }), row("openai-video", { health_score: 25 })], error: null })).db;
      void observeShadow(db, REQUEST);
    }
    const result = await provider.generateVideo({ prompt: "p", model: "sora-2", idempotencyKey: "job-1" });
    return { provider: provider.name, sent, result };
  }

  it("is identical with shadow off, disagreeing, or failing", async () => {
    const off = await generate("off");
    expect(await generate("disagrees")).toEqual(off);
    expect(await generate("throws")).toEqual(off);
  });
});

describe("7. a client can neither turn it on nor see it", () => {
  // Follow-up to #336. Its tests proved the switch is off by default and that
  // shadow never changes the request — but nothing stopped a later edit from
  // running an observation because the *request* asked for one. The switch is
  // a server environment variable; these pin that it is the only one.
  const generate = studio.slice(studio.indexOf("async function handleGenerate("), studio.indexOf("async function handlePoll("));
  const gate = studio.slice(studio.indexOf("function shadowAutoChoice("), studio.indexOf("// ── Handlers"));
  const code = (s: string) => s.replace(/\/\/.*$/gm, "");

  it("the only observation in video-studio goes through the server-side switch", () => {
    expect(code(studio).match(/observeShadow\(/g)).toHaveLength(1);
    expect(code(gate)).toContain("observeShadow(");
    expect(code(generate)).not.toContain("observeShadow(");
    expect(code(generate).match(/shadowAutoChoice\(/g)).toHaveLength(1);
  });

  it("the switch reads the environment and nothing the caller sent", () => {
    expect(code(gate)).toContain("if (!shadowEnabled()) return;");
    expect(code(gate)).not.toMatch(/\bbody\b|\breq\b|headers|searchParams|params\./);
    expect(code(selection)).toMatch(/export function shadowEnabled\(read: EnvReader = denoEnv\): boolean/);
    // shadowEnabled's only input is an environment reader: no request type reaches it.
    expect(code(selection).slice(code(selection).indexOf("export function shadowEnabled"), code(selection).indexOf("export function shadowEnabled") + 200))
      .not.toMatch(/Request|body|header/i);
  });

  it("no request field anywhere in video-studio mentions shadow or the registry switch", () => {
    expect(code(studio)).not.toMatch(/body\??\.\s*shadow|\(body as [^)]*\)\.shadow|\["shadow"\]|registry_shadow|PROVIDER_REGISTRY_SHADOW\s*[:=]/i);
    // The call site passes exactly the job's own facts, nothing from the body.
    expect(generate).toContain('if (!providerName || providerName === "auto") shadowAutoChoice(dbService, provider.name, job.id);');
  });

  it("only video-studio observes; no other edge function wires it in", () => {
    const readdir = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? readdir(`${dir}/${e.name}`) : e.name.endsWith(".ts") ? [`${dir}/${e.name}`] : []);
    const users = readdir("supabase/functions")
      .filter((f) => !f.endsWith("_shared/providerSelection.ts"))
      .filter((f) => /observeShadow|shadowEnabled/.test(readFileSync(f, "utf8")));
    expect(users).toEqual(["supabase/functions/video-studio/index.ts"]);
  });

  it("no response in video-studio carries shadow or registry data", () => {
    for (const line of code(studio).split("\n").filter((l) => /\bjson(Error)?\(/.test(l))) {
      expect(line, line.trim()).not.toMatch(/shadow|registry|observ|rankProviders|health_score|cost_per_request/i);
    }
  });
});

describe("8. observations are trustworthy: failed writes, explained mismatches, distinct errors", () => {
  // The Phase 2J-2 readiness audit found three gaps before shadow mode could
  // be relied on: a failed ph_logs write vanished without a trace, a mismatch
  // said nothing about why, and `registry_error` covered three different
  // causes. These pin the fixes.

  /** A service client whose ph_logs insert resolves with `insertResult`. */
  function dbWithInsert(answer: unknown, insertResult: unknown) {
    const inserts: Record<string, unknown>[] = [];
    const db = {
      from(table: string) {
        if (table === "ph_logs") return { insert: async (r: Record<string, unknown>) => { inserts.push(r); return insertResult; } };
        const chain = { select: () => chain, eq: () => chain, neq: () => chain, order: () => answer };
        return chain;
      },
    };
    return { db, inserts };
  }
  const rows = () => Promise.resolve({ data: [
    { ...row("openai-video", { health_score: 30, priority: 10, avg_latency_ms: 900, cost_per_request: 0.2 }), status: "degraded" },
    { ...row("luma-video", { priority: 5 }), status: "active" },
    { ...row("mock-video", { health_score: 10 }), status: "error" },
  ], error: null });

  describe("gap 1: a failed shadow-log write is detected", () => {
    it("a successful write logs nothing", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { db, inserts } = dbWithInsert(Promise.resolve({ data: [row("openai-video")], error: null }), { error: null });
      await observeShadow(db, REQUEST);
      expect(inserts).toHaveLength(1);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("a write that returns an error is reported with a short code, never the database's words", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { db } = dbWithInsert(
        Promise.resolve({ data: [row("openai-video")], error: null }),
        { error: { code: "42501", message: "permission denied for table ph_logs", details: "secret detail" } },
      );
      await expect(observeShadow(db, REQUEST)).resolves.toBe("match");
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]).toEqual(["[provider-shadow] log_write_failed", "42501"]);
      expect(JSON.stringify(spy.mock.calls)).not.toMatch(/permission denied|secret detail/);
      spy.mockRestore();
    });

    it("a write that throws is reported too, and still never escapes", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { db } = fakeDb(Promise.resolve({ data: [row("openai-video")], error: null }), { insertThrows: true });
      await expect(observeShadow(db, REQUEST)).resolves.toBe("match");
      expect(spy.mock.calls).toEqual([["[provider-shadow] log_write_threw"]]);
      spy.mockRestore();
    });
  });

  describe("gap 2: a mismatch says what was considered", () => {
    it("records every candidate, in ranked order, with only the inputs that explain the choice", async () => {
      const { db, inserts } = dbWithInsert(rows(), { error: null });
      expect(await observeShadow(db, REQUEST)).toBe("mismatch");
      const meta = inserts[0].request_meta as Record<string, unknown>;
      expect(meta.actual_provider).toBe("openai-video");
      expect(inserts[0].provider_slug).toBe("luma-video");
      expect(meta.candidates).toEqual([
        { slug: "luma-video", status: "active", eligible: true, rank: 1, health_score: 100, priority: 5, avg_latency_ms: 0 },
        { slug: "openai-video", status: "degraded", eligible: true, rank: 2, health_score: 30, priority: 10, avg_latency_ms: 900 },
        { slug: "mock-video", status: "error", eligible: false, rank: null, health_score: 10, priority: 10, avg_latency_ms: 0 },
      ]);
      expect(meta.candidate_count).toBe(3);
    });

    it("never records cost, a score (which would reveal cost), keys, config or content", async () => {
      const { db, inserts } = dbWithInsert(rows(), { error: null });
      await observeShadow(db, REQUEST);
      for (const c of (inserts[0].request_meta as { candidates: Record<string, unknown>[] }).candidates) {
        expect(Object.keys(c).sort()).toEqual(["avg_latency_ms", "eligible", "health_score", "priority", "rank", "slug", "status"]);
      }
      expect(JSON.stringify(inserts[0])).not.toMatch(/cost|"score"|api_key|config|base_url|prompt|user_id|0\.2\b/i);
    });

    it("explains no_candidate too: the rows were there, none was eligible", async () => {
      const { db, inserts } = dbWithInsert(
        Promise.resolve({ data: [{ ...row("openai-video", { health_score: 5 }), status: "degraded" }], error: null }),
        { error: null },
      );
      expect(await observeShadow(db, REQUEST)).toBe("no_candidate");
      expect((inserts[0].request_meta as { candidates: unknown[] }).candidates).toEqual([
        { slug: "openai-video", status: "degraded", eligible: false, rank: null, health_score: 5, priority: 10, avg_latency_ms: 0 },
      ]);
    });

    it("keeps the list bounded, and says how many there were", async () => {
      const many = Array.from({ length: 25 }, (_, i) => ({ ...row(`p${i}`), status: "active" }));
      const { db, inserts } = dbWithInsert(Promise.resolve({ data: many, error: null }), { error: null });
      await observeShadow(db, REQUEST);
      const meta = inserts[0].request_meta as { candidates: unknown[]; candidate_count: number };
      expect(meta.candidates).toHaveLength(10);
      expect(meta.candidate_count).toBe(25);
    });

    it("an observation with no rows read records an empty list", async () => {
      const { db, inserts } = dbWithInsert(Promise.resolve({ data: null, error: { message: "x" } }), { error: null });
      await observeShadow(db, REQUEST);
      expect(inserts[0].request_meta).toMatchObject({ candidates: [], candidate_count: 0 });
    });

    it("reads status to record it, and still reads no key reference, config or URL", async () => {
      const { db, selects } = fakeDb(Promise.resolve({ data: [row("openai-video")], error: null }));
      await observeShadow(db, REQUEST);
      expect(selects).toEqual(["id, slug, status, priority, health_score, avg_latency_ms, cost_per_request, capabilities"]);
    });

    it("recording candidates does not change the choice", async () => {
      const data = [row("a", { priority: 50 }), row("b", { priority: 1, health_score: 60 }), row("c", { health_score: 15 })];
      const { db, inserts } = dbWithInsert(Promise.resolve({ data: data.map((r) => ({ ...r, status: "active" })), error: null }), { error: null });
      await observeShadow(db, REQUEST);
      expect(inserts[0].provider_slug).toBe(rankProviders(data.map((r) => ({ ...r })))?.provider.slug);
    });
  });

  describe("gap 3: each failure has its own code", () => {
    it.each([
      ["query_error", "the query answered with an error", () => Promise.resolve({ data: null, error: { message: "relation does not exist" } })],
      ["query_error", "the query answered without rows", () => Promise.resolve({ data: "nope", error: null })],
      ["query_error", "the query itself rejected", () => Promise.reject(new Error("fetch failed"))],
      ["malformed", "a row failed the shape check", () => Promise.resolve({ data: [{ id: 1, slug: null }], error: null })],
    ])("%s when %s", async (code, _why, answer) => {
      const { db, inserts } = dbWithInsert(answer(), { error: null });
      await expect(observeShadow(db, REQUEST)).resolves.toBe(code);
      expect(inserts[0]).toMatchObject({ error_code: code, provider_slug: null });
      expect(JSON.stringify(inserts[0])).not.toMatch(/relation does not exist|fetch failed/);
    });

    it("unexpected_error when something else throws", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { db, inserts } = fakeDb(null, { fromThrows: true });
      await expect(observeShadow(db, REQUEST)).resolves.toBe("unexpected_error");
      expect(inserts).toEqual([]);
      spy.mockRestore();
    });

    it("timeout stays its own code", async () => {
      vi.useFakeTimers();
      const { db, inserts } = dbWithInsert(new Promise(() => {}), { error: null });
      const pending = observeShadow(db, REQUEST, { timeoutMs: 50 });
      await vi.advanceTimersByTimeAsync(60);
      expect(await pending).toBe("timeout");
      expect(inserts[0]).toMatchObject({ error_code: "timeout" });
    });

    it("the old catch-all code is gone", () => {
      expect(selection.replace(/\/\/.*$/gm, "")).not.toContain('"registry_error"');
    });
  });
});
