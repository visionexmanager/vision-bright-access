// Phase 2H: content-media image generations are recorded in the provider
// registry against `openai-image` — the kids cover art, the kids drawing art
// and the WhatsApp owner `/image` command — without changing what any of them
// returns, and without recording anything the registry has no row for.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  generateImage,
  generateVideo,
  type MediaDeps,
  type MediaFetch,
  type MediaOutcome,
} from "../../supabase/functions/_shared/contentMedia.ts";
import {
  MEDIA_PROVIDER_SLUG,
  providerBySlugIn,
  recordMediaOutcome,
  recordResultIn,
} from "../../supabase/functions/_shared/providerRecording.ts";

const PNG_B64 = "iVBORw0KGgo=";

function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

function deps(responses: Array<ReturnType<typeof reply> | Error>, extra: Partial<MediaDeps> = {}) {
  const queue = [...responses];
  const fetchImpl = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as MediaFetch;
  const recorded: MediaOutcome[] = [];
  let t = 1_000;
  const d: MediaDeps = {
    apiKey: "sk-test",
    fetchImpl,
    upload: async () => "https://cdn.example/x.png",
    now: () => (t += 250),
    record: async (o) => { recorded.push(o); },
    ...extra,
  };
  return { d, recorded, fetchImpl };
}

const ok = () => reply(200, { data: [{ b64_json: PNG_B64 }] });

describe("generateImage records exactly one outcome per generation", () => {
  it("a success: one record, the result untouched", async () => {
    const { d, recorded } = deps([ok()]);
    const result = await generateImage(d, "a cat", "1024x1024", "p/x");
    expect(result).toEqual({ ok: true, kind: "image", url: "https://cdn.example/x.png", prompt: "a cat" });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ kind: "image", success: true, error: undefined });
    expect(recorded[0].ms).toBeGreaterThan(0);
  });

  it("the model fallback is one generation, not two records", async () => {
    const missing = reply(404, { error: { code: "model_not_found" } });
    const { d, recorded, fetchImpl } = deps([missing, ok()]);
    const result = await generateImage(d, "a cat", "1024x1024", "p/x");
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(recorded).toEqual([expect.objectContaining({ success: true })]);
  });

  it("every model missing: one failure record", async () => {
    const missing = () => reply(404, { error: { code: "model_not_found" } });
    const { d, recorded } = deps([missing(), missing()]);
    const result = await generateImage(d, "a cat", "1024x1024", "p/x");
    expect(result).toEqual({ ok: false, error: "model_unavailable" });
    expect(recorded).toEqual([expect.objectContaining({ success: false, error: "model_unavailable" })]);
  });

  it.each([
    [reply(401, { error: { message: "Incorrect API key provided: sk-live-abc" } }), "key_rejected"],
    [reply(400, { error: { code: "content_policy_violation", message: "rejected" } }), "content_policy"],
    [reply(429, {}), "rate_limited"],
    [reply(503, {}), "provider_unavailable"],
    [new Error("socket hang up"), "provider_unreachable"],
    [reply(200, { data: [{ url: "https://x" }] }), "unexpected_url_response"],
    [reply(200, { data: [] }), "no_image_returned"],
  ])("a failure records only the short code (%#)", async (response, code) => {
    const { d, recorded } = deps([response]);
    const result = await generateImage(d, "a cat", "1024x1024", "p/x");
    expect(result).toEqual({ ok: false, error: code });
    expect(recorded).toEqual([expect.objectContaining({ kind: "image", success: false, error: code })]);
    expect(JSON.stringify(recorded)).not.toMatch(/sk-live|Incorrect|socket|https:\/\/x/);
  });

  it("a storage failure is not held against the provider", async () => {
    const { d, recorded } = deps([ok()], { upload: async () => null });
    const result = await generateImage(d, "a cat", "1024x1024", "p/x");
    expect(result).toEqual({ ok: false, error: "upload_failed" });
    expect(recorded).toEqual([expect.objectContaining({ success: true })]);
  });

  it("the record carries no prompt, no bytes and no URL", async () => {
    const { d, recorded } = deps([ok()]);
    await generateImage(d, "a secret prompt", "1024x1024", "p/x");
    expect(Object.keys(recorded[0]).sort()).toEqual(["error", "kind", "ms", "success"]);
    expect(JSON.stringify(recorded[0])).not.toContain("secret");
  });

  it("a recorder that throws or hangs up changes nothing about the result", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const { d } = deps([ok()], { record: async () => { throw new Error("registry down"); } });
    expect(await generateImage(d, "a cat", "1024x1024", "p/x"))
      .toEqual({ ok: true, kind: "image", url: "https://cdn.example/x.png", prompt: "a cat" });
    quiet.mockRestore();
  });

  it("no recorder: the same result as before this phase", async () => {
    const { d } = deps([ok()], { record: undefined });
    expect(await generateImage(d, "a cat", "1024x1024", "p/x"))
      .toEqual({ ok: true, kind: "image", url: "https://cdn.example/x.png", prompt: "a cat" });
  });
});

describe("video is not recorded — Sora has no registry row", () => {
  it("generateVideo never calls the recorder", async () => {
    const record = vi.fn();
    const { d } = deps([reply(500, {})], { record, sleep: async () => {} });
    const result = await generateVideo(d, "a clip", "720x1280", "p/v");
    expect(result.ok).toBe(false);
    expect(record).not.toHaveBeenCalled();
  });

  it("the slug map says so explicitly", () => {
    expect(MEDIA_PROVIDER_SLUG).toEqual({ image: "openai-image", video: null });
  });
});

/** A recording stand-in for the service client. */
function fakeDb(row: { id: string; slug: string } | null = { id: "prov-1", slug: "openai-image" }) {
  const calls: Array<{ op: string; table?: string; args?: unknown }> = [];
  const db = {
    from(table: string) {
      return {
        select: () => ({
          eq: (_c: string, value: string) => ({
            maybeSingle: async () => {
              calls.push({ op: "select", table, args: value });
              return { data: table === "ph_providers" ? (value === row?.slug ? row : null) : null };
            },
          }),
        }),
        insert: async (values: unknown) => { calls.push({ op: "insert", table, args: values }); return { error: null }; },
      };
    },
    rpc: async (fn: string, args: unknown) => { calls.push({ op: "rpc", table: fn, args }); return { error: null }; },
  };
  return { db, calls };
}

describe("recordMediaOutcome writes what image-generate writes", () => {
  it("an image success: metric and log against openai-image", async () => {
    const { db, calls } = fakeDb();
    await recordMediaOutcome(db, { kind: "image", success: true, ms: 1234 });
    expect(calls).toEqual([
      { op: "select", table: "ph_providers", args: "openai-image" },
      { op: "rpc", table: "ph_record_metric", args: { p_provider_id: "prov-1", p_success: true, p_latency_ms: 1234, p_cost_usd: 0 } },
      { op: "insert", table: "ph_logs", args: {
        provider_id: "prov-1", provider_slug: "openai-image", job_type: "image", action: "generation",
        status: "success", latency_ms: 1234, cost_usd: null, error_message: null, failover_to: null,
      } },
    ]);
  });

  it("an image failure: the short code as the error", async () => {
    const { db, calls } = fakeDb();
    await recordMediaOutcome(db, { kind: "image", success: false, ms: 50, error: "content_policy" });
    expect(calls.find((c) => c.table === "ph_logs")?.args).toMatchObject({ status: "failure", error_message: "content_policy" });
  });

  it("a video outcome touches nothing", async () => {
    const { db, calls } = fakeDb();
    await recordMediaOutcome(db, { kind: "video", success: true, ms: 1 });
    expect(calls).toEqual([]);
  });

  it("a missing row records nothing and does not throw", async () => {
    const { db, calls } = fakeDb(null);
    await recordMediaOutcome(db, { kind: "image", success: true, ms: 1 });
    expect(calls.map((c) => c.op)).toEqual(["select"]);
  });

  it("a database that throws never reaches the caller", async () => {
    const db = { from() { throw new Error("down"); }, rpc() { throw new Error("down"); } };
    await expect(recordMediaOutcome(db, { kind: "image", success: false, ms: 1, error: "x" })).resolves.toBeUndefined();
  });
});

describe("recordResultIn keeps recordResult's behaviour", () => {
  it("records a failover row when a failure names one", async () => {
    const { db, calls } = fakeDb({ id: "prov-2", slug: "openai-stt" });
    await recordResultIn(db, {
      provider_id: "prov-1", provider_slug: "groq-stt", job_type: "stt",
      success: false, latency_ms: 10, error_message: "timeout", failover_to: "openai-stt",
    });
    expect(calls.map((c) => `${c.op}:${c.table}`)).toEqual([
      "rpc:ph_record_metric", "insert:ph_logs", "select:ph_providers", "insert:ph_failovers",
    ]);
    expect(calls.at(-1)?.args).toMatchObject({ from_slug: "groq-stt", to_slug: "openai-stt", to_provider_id: "prov-2" });
  });

  it("providerBySlugIn returns the row or null", async () => {
    const { db } = fakeDb();
    expect(await providerBySlugIn(db, "openai-image")).toEqual({ id: "prov-1", slug: "openai-image" });
    expect(await providerBySlugIn(db, "nope")).toBeNull();
  });
});

describe("the wiring", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("providerRouter delegates to the one implementation", () => {
    const router = read("supabase/functions/_shared/providerRouter.ts");
    expect(router).toContain('from "./providerRecording.ts"');
    expect(router).toContain("await recordResultIn(createClient(supabaseUrl, serviceKey), params);");
    expect(router).toContain("return (await providerBySlugIn(db, slug)) as RouterProvider | null;");
    expect(router).not.toContain('.from("ph_logs")');
  });

  it("the WhatsApp owner command records through the service client it already holds", () => {
    const actions = read("supabase/functions/_shared/ownerContentActions.ts");
    expect(actions).toContain('import { recordMediaOutcome } from "./providerRecording.ts";');
    expect(actions).toContain("record: (outcome) => recordMediaOutcome(db, outcome),");
    // Still importable by the suite: no npm specifier reaches this module.
    expect(read("supabase/functions/_shared/providerRecording.ts")).not.toMatch(/from "npm:|from "https:/);
  });

  for (const [fn, name] of [["kids-story-generate", "generateCoverImage"], ["kids-drawing-to-art", "generateStylizedImage"]]) {
    it(`${fn} records through its service client`, () => {
      const s = read(`supabase/functions/${fn}/index.ts`);
      expect(s).toContain("record: (outcome) => recordMediaOutcome(db, outcome),");
      expect(s).toMatch(new RegExp(`await ${name}\\([^;]*, serviceClient\\);`));
    });
  }

  it("generateVideo and generateProposalMedia are otherwise unchanged", () => {
    const media = read("supabase/functions/_shared/contentMedia.ts");
    const video = media.slice(media.indexOf("export async function generateVideo"), media.indexOf("export async function generateProposalMedia"));
    expect(video).not.toContain("report(");
    expect(video).not.toContain("done(");
  });
});
