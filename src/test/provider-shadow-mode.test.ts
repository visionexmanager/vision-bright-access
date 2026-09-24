// Phase 2J-2: provider registry shadow mode. Telemetry only — it works out what
// the registry *would* choose and writes it down; it never changes what is
// chosen, what is sent, what is returned or what is billed.

import { readFileSync } from "node:fs";
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
      request_meta: { service: "video-studio", routing_mode: "auto", actual_provider: "openai-video", correlation_id: "job-1" },
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
    ["registry_error", () => Promise.resolve({ data: null, error: { message: "permission denied" } })],
    ["malformed", () => Promise.resolve({ data: [{ id: 1, slug: null }], error: null })],
    ["registry_error", () => Promise.reject(new Error("socket"))],
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
    await expect(observeShadow(fakeDb(null, { fromThrows: true }).db, REQUEST)).resolves.toBe("registry_error");
    const good = Promise.resolve({ data: [row("openai-video")], error: null });
    await expect(observeShadow(fakeDb(good, { insertThrows: true }).db, REQUEST)).resolves.toBe("match");
  });
});

describe("3. nothing sensitive is read into it or written out of it", () => {
  it("selects only the ranking columns — no key reference, config or URL", async () => {
    const { db, selects } = fakeDb(Promise.resolve({ data: [row("openai-video")], error: null }));
    await observeShadow(db, REQUEST);
    expect(selects).toEqual(["id, slug, priority, health_score, avg_latency_ms, cost_per_request, capabilities"]);
    expect(selects[0]).not.toMatch(/api_key_ref|config|base_url|\*/);
  });

  it("writes no cost, latency, key, prompt or user field", async () => {
    const { db, inserts } = fakeDb(Promise.resolve({ data: [row("openai-video", { cost_per_request: 0.2, avg_latency_ms: 900 })], error: null }));
    await observeShadow(db, REQUEST);
    const text = JSON.stringify(inserts);
    expect(Object.keys(inserts[0]).sort()).toEqual(
      ["action", "error_code", "error_message", "job_type", "provider_id", "provider_slug", "request_meta", "status"]);
    expect(Object.keys(inserts[0].request_meta as object).sort()).toEqual(["actual_provider", "correlation_id", "routing_mode", "service"]);
    // The slug "openai-video" is the one provider name it may carry; no secret name or figure.
    expect(text).not.toMatch(/cost|0\.2|900|api_key|OPENAI_API_KEY|prompt|user_id/i);
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
    expect(generate).toContain('provider = getProvider((providerName as string) || "auto");');
    const fn = studio.slice(studio.indexOf("function shadowAutoChoice("), studio.indexOf("// ── Handlers"));
    expect(fn).not.toMatch(/return [^;]*observ|getProvider|provider\s*=/);
  });

  it("sends the provider exactly the request it sent before", () => {
    const params = generate.slice(generate.indexOf("provider.generateVideo({"), generate.indexOf("});", generate.indexOf("provider.generateVideo({")));
    expect(params.replace(/\s+/g, " ").trim()).toBe(
      "provider.generateVideo({ prompt: job.prompt, negativePrompt: job.negative_prompt ?? undefined, style: job.style, durationSec: job.duration_sec, aspectRatio: job.aspect_ratio, resolution: job.resolution, fps: job.fps, cameraMotion: job.camera_motion, creativity: job.creativity, seed: job.seed ?? undefined, model: job.provider_model, idempotencyKey: job.id,");
  });

  it("keeps the environment rule and the RunPod gate — the only fallback behaviour there is", () => {
    expect(studio).toContain('if (!requested) requested = openaiKey ? "openai" : lumaKey ? "luma" : "";');
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
