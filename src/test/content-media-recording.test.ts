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

// Phase 2J-0 added the `openai-video` (Sora) row, so video is recorded too.
describe("generateVideo records exactly one outcome per clip", () => {
  const clipBytes = () => ({
    ok: true, status: 200, json: async () => ({}), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  });

  it("a rejected submission: one failure record with the short code", async () => {
    const { d, recorded } = deps([reply(500, {})], { sleep: async () => {} });
    const result = await generateVideo(d, "a clip", "720x1280", "p/v");
    expect(result).toEqual({ ok: false, error: "provider_unavailable" });
    expect(recorded).toEqual([expect.objectContaining({ kind: "video", success: false, error: "provider_unavailable" })]);
  });

  it("a finished clip: one success record, the result untouched", async () => {
    const { d, recorded } = deps(
      [reply(200, { id: "vid_1" }), reply(200, { status: "completed" }), clipBytes()],
      { sleep: async () => {}, upload: async () => "https://cdn.example/v.mp4" },
    );
    const result = await generateVideo(d, "a clip", "720x1280", "p/v");
    expect(result).toEqual({ ok: true, kind: "video", url: "https://cdn.example/v.mp4", prompt: "a clip" });
    expect(recorded).toEqual([expect.objectContaining({ kind: "video", success: true, error: undefined })]);
  });

  it("a failed render: one failure record", async () => {
    const { d, recorded } = deps([reply(200, { id: "vid_1" }), reply(200, { status: "failed" })], { sleep: async () => {} });
    expect(await generateVideo(d, "a clip", "720x1280", "p/v")).toEqual({ ok: false, error: "video_failed" });
    expect(recorded).toEqual([expect.objectContaining({ success: false, error: "video_failed" })]);
  });

  it("a storage failure is not held against Sora", async () => {
    const { d, recorded } = deps(
      [reply(200, { id: "vid_1" }), reply(200, { status: "completed" }), clipBytes()],
      { sleep: async () => {}, upload: async () => null },
    );
    expect(await generateVideo(d, "a clip", "720x1280", "p/v")).toEqual({ ok: false, error: "upload_failed" });
    expect(recorded).toEqual([expect.objectContaining({ success: true })]);
  });

  it("a recorder that throws changes nothing about the clip", async () => {
    const { d } = deps([reply(500, {})], { sleep: async () => {}, record: async () => { throw new Error("down"); } });
    expect(await generateVideo(d, "a clip", "720x1280", "p/v")).toEqual({ ok: false, error: "provider_unavailable" });
  });

  it("the slug map names the Sora row", () => {
    expect(MEDIA_PROVIDER_SLUG).toEqual({ image: "openai-image", video: "openai-video" });
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

  it("a video outcome is recorded against the Sora row as text_to_video", async () => {
    const { db, calls } = fakeDb({ id: "vid-1", slug: "openai-video" });
    await recordMediaOutcome(db, { kind: "video", success: false, ms: 9, error: "video_timeout" });
    expect(calls[0]).toEqual({ op: "select", table: "ph_providers", args: "openai-video" });
    expect(calls.find((c) => c.table === "ph_logs")?.args).toMatchObject({
      provider_slug: "openai-video", job_type: "text_to_video", status: "failure", error_message: "video_timeout",
    });
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
    // The slug is resolved before either write, so both uuid columns get an id.
    expect(calls.map((c) => `${c.op}:${c.table}`)).toEqual([
      "rpc:ph_record_metric", "select:ph_providers", "insert:ph_logs", "insert:ph_failovers",
    ]);
    expect(calls.find((c) => c.table === "ph_logs")?.args).toMatchObject({ failover_to: "prov-2" });
    expect(calls.at(-1)?.args).toMatchObject({ from_slug: "groq-stt", to_slug: "openai-stt", to_provider_id: "prov-2" });
  });

  it("never writes a slug into the uuid failover_to column", async () => {
    const { db, calls } = fakeDb({ id: "prov-2", slug: "openai-stt" });
    await recordResultIn(db, {
      provider_id: "prov-1", provider_slug: "groq-stt", job_type: "stt", success: false, failover_to: "no-such-provider",
    });
    // An unknown slug resolves to nothing: null in both uuid columns, the slug kept as text.
    expect(calls.find((c) => c.table === "ph_logs")?.args).toMatchObject({ failover_to: null });
    expect(calls.at(-1)?.args).toMatchObject({ to_provider_id: null, to_slug: "no-such-provider" });
  });

  it("without a failover, looks nothing up and writes null", async () => {
    const { db, calls } = fakeDb();
    await recordResultIn(db, { provider_id: "prov-1", provider_slug: "openai-image", job_type: "image", success: true });
    expect(calls.map((c) => `${c.op}:${c.table}`)).toEqual(["rpc:ph_record_metric", "insert:ph_logs"]);
    expect(calls[1].args).toMatchObject({ failover_to: null });
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

  it("generateVideo reports from every exit and sends Sora the same request", () => {
    const media = read("supabase/functions/_shared/contentMedia.ts");
    const video = media.slice(media.indexOf("export async function generateVideo"), media.indexOf("export async function generateProposalMedia"));
    expect(video).not.toMatch(/return \{ ok:/);
    for (const field of ['form.append("model", VIDEO_MODEL);', 'form.append("prompt", prompt);', 'form.append("size", size);', 'form.append("seconds", String(VIDEO_SECONDS));']) {
      expect(video, field).toContain(field);
    }
    expect(media).toContain('export const VIDEO_MODEL = "sora-2";');
  });
});
