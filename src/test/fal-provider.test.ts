// FAL: the transport (_shared/providers/fal.ts), the registry activation gate
// (providerRoutableIn) and the image-generate wiring (provider recovery, 2026-09-26).
//
// The account's balance is exhausted, so no real FAL generation has run; these
// tests drive the real transport against a fake fetch that speaks FAL's
// documented queue contract.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  decodeFalJobId, encodeFalJobId, FAL_IMAGE_MODEL, FAL_MODELS, FAL_VIDEO_MODEL, FalError, falAppId,
  falGenerateImage, falStatus, falSubmit, falVideoInput, falVideoUrl, fetchFalMedia, isFalMediaUrl,
} from "../../supabase/functions/_shared/providers/fal.ts";
import { providerRoutableIn, ROUTABLE_READ_TIMEOUT_MS, rowIsRoutable } from "../../supabase/functions/_shared/providerRecording.ts";

const KEY = "fal-test-key-DO-NOT-LEAK";
const RID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const PNG = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

type Call = { url: string; method: string; auth: string | null; redirect?: RequestRedirect };

/** A FAL that answers by URL; `script` maps a URL fragment to the reply. */
function fakeFal(script: Array<[RegExp, () => Response]>) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    calls.push({ url, method: init.method ?? "GET", auth: headers.get("Authorization"), redirect: init.redirect });
    const hit = script.find(([re]) => re.test(url));
    if (!hit) throw new TypeError("fetch failed");
    return hit[1]();
  });
  return { calls, fetchImpl };
}
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const png = () => new Response(PNG, { status: 200, headers: { "content-type": "image/png", "content-length": String(PNG.length) } });

describe("which models may run", () => {
  it("only models fal.ai marks 'Commercial use' are selectable; the research-only LTX is refused by name", async () => {
    expect(FAL_MODELS[FAL_IMAGE_MODEL].commercial).toBe(true);
    expect(FAL_MODELS[FAL_VIDEO_MODEL].commercial).toBe(true);
    expect(FAL_MODELS["fal-ai/ltx-video"].commercial).toBe(false);
    const { calls, fetchImpl } = fakeFal([]);
    await expect(falSubmit({ key: KEY, fetch: fetchImpl }, "fal-ai/ltx-video", { prompt: "x" })).rejects.toMatchObject({ code: "not_commercial" });
    await expect(falSubmit({ key: KEY, fetch: fetchImpl }, "fal-ai/anything-else", { prompt: "x" })).rejects.toMatchObject({ code: "not_commercial" });
    expect(calls).toEqual([]); // refused before any request
  });

  it("no key, no request", async () => {
    const { calls, fetchImpl } = fakeFal([]);
    await expect(falSubmit({ key: "", fetch: fetchImpl }, FAL_IMAGE_MODEL, {})).rejects.toMatchObject({ code: "not_configured" });
    expect(calls).toEqual([]);
  });
});

describe("the queue contract", () => {
  it("submits to the endpoint and polls the app id, with the Key scheme, never following FAL's own URLs", async () => {
    const { calls, fetchImpl } = fakeFal([
      [/\/requests\/.*\/status$/, () => json({ status: "IN_PROGRESS" })],
      [/queue\.fal\.run\/fal-ai\/wan\/v2\.2-5b\/text-to-video$/, () => json({ request_id: RID, status_url: "https://evil.example/steal", response_url: "https://evil.example/r" })],
    ]);
    const id = await falSubmit({ key: KEY, fetch: fetchImpl }, FAL_VIDEO_MODEL, { prompt: "sea" });
    expect(id).toBe(RID);
    expect(await falStatus({ key: KEY, fetch: fetchImpl }, FAL_VIDEO_MODEL, id)).toBe("running");
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["POST", "https://queue.fal.run/fal-ai/wan/v2.2-5b/text-to-video"],
      ["GET", `https://queue.fal.run/fal-ai/wan/requests/${RID}/status`],
    ]);
    expect(calls.every((c) => c.auth === `Key ${KEY}`)).toBe(true);
    expect(falAppId("fal-ai/flux/schnell")).toBe("fal-ai/flux");
  });

  it("a request id that is not a UUID is refused before it can shape a URL", async () => {
    const { calls, fetchImpl } = fakeFal([[/.*/, () => json({ request_id: "../../admin" })]]);
    await expect(falSubmit({ key: KEY, fetch: fetchImpl }, FAL_IMAGE_MODEL, {})).rejects.toMatchObject({ code: "invalid_response" });
    await expect(falStatus({ key: KEY, fetch: fetchImpl }, FAL_IMAGE_MODEL, "../x")).rejects.toMatchObject({ code: "invalid_response" });
    expect(calls).toHaveLength(1);
  });

  it("an exhausted account is http_403, and FAL's own sentence is never read", async () => {
    let bodyRead = false;
    const body = new ReadableStream({ pull() { bodyRead = true; } }, { highWaterMark: 0 });
    const { fetchImpl } = fakeFal([[/.*/, () => new Response(body, { status: 403 })]]);
    const err = await falSubmit({ key: KEY, fetch: fetchImpl }, FAL_IMAGE_MODEL, {}).catch((e) => e);
    expect(err).toBeInstanceOf(FalError);
    expect(err.code).toBe("http_403");
    expect(err.message).not.toMatch(/locked|balance|Key|fal-test/);
    expect(bodyRead).toBe(false);
  });

  it("status codes and transport failures map to closed codes", async () => {
    for (const [status, code] of [[429, "http_429"], [500, "http_5xx"], [502, "http_5xx"], [401, "http_401"], [418, "http_4xx"]] as const) {
      const { fetchImpl } = fakeFal([[/.*/, () => new Response("", { status })]]);
      await expect(falSubmit({ key: KEY, fetch: fetchImpl }, FAL_IMAGE_MODEL, {})).rejects.toMatchObject({ code });
    }
    const timeout = vi.fn(async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); });
    await expect(falSubmit({ key: KEY, fetch: timeout }, FAL_IMAGE_MODEL, {})).rejects.toMatchObject({ code: "timeout" });
    const net = vi.fn(async () => { throw new TypeError("fetch failed"); });
    await expect(falSubmit({ key: KEY, fetch: net }, FAL_IMAGE_MODEL, {})).rejects.toMatchObject({ code: "network" });
  });
});

describe("results come only from FAL's CDN", () => {
  it("allowlist: https on fal.media or a subdomain, nothing else", () => {
    expect(isFalMediaUrl("https://v3.fal.media/files/x.png")).toBe(true);
    expect(isFalMediaUrl("https://fal.media/files/x.png")).toBe(true);
    for (const bad of ["http://v3.fal.media/x", "https://fal.media.evil.com/x", "https://evilfal.media/x", "https://169.254.169.254/x",
      "https://user:pw@fal.media/x", "https://fal.media:8443/x", "data:image/png;base64,AA", "file:///etc/passwd", "", 42, null]) {
      expect(isFalMediaUrl(bad), String(bad)).toBe(false);
    }
  });

  it("the download carries no key, refuses redirects, checks the type and caps the size", async () => {
    const { calls, fetchImpl } = fakeFal([[/fal\.media/, png]]);
    const out = await fetchFalMedia({ fetch: fetchImpl }, "https://v3.fal.media/files/a.png", "image/", 1000);
    expect(out.mime).toBe("image/png");
    expect(calls[0].auth).toBeNull();
    expect(calls[0].redirect).toBe("error");
    const wrongType = fakeFal([[/fal\.media/, () => new Response("<html>", { headers: { "content-type": "text/html" } })]]);
    await expect(fetchFalMedia({ fetch: wrongType.fetchImpl }, "https://v3.fal.media/a", "image/", 1000)).rejects.toMatchObject({ code: "invalid_response" });
    const big = fakeFal([[/fal\.media/, () => new Response(new Uint8Array(50), { headers: { "content-type": "image/png" } })]]);
    await expect(fetchFalMedia({ fetch: big.fetchImpl }, "https://v3.fal.media/a", "image/", 10)).rejects.toMatchObject({ code: "too_large" });
    await expect(fetchFalMedia({ fetch: fetchImpl }, "https://example.com/a.png", "image/", 1000)).rejects.toMatchObject({ code: "untrusted_result" });
  });
});

describe("falGenerateImage", () => {
  const flow = (result: unknown, statuses = ["IN_QUEUE", "COMPLETED"]) => {
    const seq = [...statuses];
    return fakeFal([
      [/\/status$/, () => json({ status: seq.shift() ?? "COMPLETED" })],
      [/requests\/[0-9a-f-]+$/, () => json(result)],
      [/fal\.media/, png],
      [/queue\.fal\.run\/fal-ai\/flux\/schnell$/, () => json({ request_id: RID })],
    ]);
  };

  it("submits FLUX schnell with the size asked, polls to completion and returns the bytes", async () => {
    const { calls, fetchImpl } = flow({ images: [{ url: "https://v3.fal.media/files/out.png" }], has_nsfw_concepts: [false] });
    const out = await falGenerateImage({ key: KEY, fetch: fetchImpl, pollMs: 0 }, { prompt: "a blue circle", width: 1024, height: 1536 });
    expect(out.model).toBe("fal-ai/flux/schnell");
    expect(Array.from(out.bytes)).toEqual(Array.from(PNG));
    expect(calls.map((c) => c.url.replace(RID, "ID"))).toEqual([
      "https://queue.fal.run/fal-ai/flux/schnell",
      "https://queue.fal.run/fal-ai/flux/requests/ID/status",
      "https://queue.fal.run/fal-ai/flux/requests/ID/status",
      "https://queue.fal.run/fal-ai/flux/requests/ID",
      "https://v3.fal.media/files/out.png",
    ]);
  });

  it("a flagged image is content_filtered; a result on a foreign host is untrusted_result — neither is fetched", async () => {
    const nsfw = flow({ images: [{ url: "https://v3.fal.media/x.png" }], has_nsfw_concepts: [true] });
    await expect(falGenerateImage({ key: KEY, fetch: nsfw.fetchImpl, pollMs: 0 }, { prompt: "p", width: 8, height: 8 })).rejects.toMatchObject({ code: "content_filtered" });
    expect(nsfw.calls.some((c) => c.url.includes("fal.media"))).toBe(false);
    const foreign = flow({ images: [{ url: "https://attacker.example/x.png" }] });
    await expect(falGenerateImage({ key: KEY, fetch: foreign.fetchImpl, pollMs: 0 }, { prompt: "p", width: 8, height: 8 })).rejects.toMatchObject({ code: "untrusted_result" });
    expect(foreign.calls.some((c) => c.url.includes("attacker"))).toBe(false);
  });

  it("a job that outlives the deadline is cancelled and reported as a timeout", async () => {
    const { calls, fetchImpl } = fakeFal([
      [/\/cancel$/, () => json({})],
      [/\/status$/, () => json({ status: "IN_QUEUE" })],
      [/schnell$/, () => json({ request_id: RID })],
    ]);
    await expect(falGenerateImage({ key: KEY, fetch: fetchImpl, pollMs: 0, deadlineMs: 0 }, { prompt: "p", width: 8, height: 8 })).rejects.toMatchObject({ code: "timeout" });
    expect(calls.at(-1)).toMatchObject({ method: "PUT", url: `https://queue.fal.run/fal-ai/flux/requests/${RID}/cancel` });
  });
});

describe("video helpers", () => {
  it("maps Visionex's options into Wan 2.2's accepted ranges", () => {
    expect(falVideoInput({ prompt: "p", aspectRatio: "4:3", resolution: "1080p", durationSec: 60 })).toMatchObject({ aspect_ratio: "16:9", resolution: "720p", num_frames: 161, frames_per_second: 24 });
    expect(falVideoInput({ prompt: "p", aspectRatio: "9:16", resolution: "540p", durationSec: 0.1 })).toMatchObject({ aspect_ratio: "9:16", resolution: "580p", num_frames: 17 });
  });

  it("the stored job id round-trips, and anything else — including the research-only model — decodes to null", () => {
    expect(decodeFalJobId(encodeFalJobId(FAL_VIDEO_MODEL, RID))).toEqual({ endpoint: FAL_VIDEO_MODEL, requestId: RID });
    for (const bad of [`fal-ai/ltx-video|${RID}`, `${FAL_IMAGE_MODEL}|${RID}`, `${FAL_VIDEO_MODEL}|nope`, `${FAL_VIDEO_MODEL}|${RID}|x`, RID, ""]) {
      expect(decodeFalJobId(bad), bad).toBeNull();
    }
  });

  it("only a FAL CDN link counts as a video result", () => {
    expect(falVideoUrl({ video: { url: "https://v3.fal.media/v.mp4" } })).toBe("https://v3.fal.media/v.mp4");
    expect(falVideoUrl({ video: { url: "https://elsewhere.example/v.mp4" } })).toBeNull();
    expect(falVideoUrl({})).toBeNull();
  });
});

describe("the activation gate fails closed", () => {
  it("routable only when active or degraded AND marked production-eligible", () => {
    expect(rowIsRoutable({ status: "active", config: { production_eligible: true } })).toBe(true);
    expect(rowIsRoutable({ status: "degraded", config: { production_eligible: true } })).toBe(true);
    for (const row of [null, undefined, { status: "inactive", config: { production_eligible: true } }, { status: "error", config: { production_eligible: true } },
      { status: "active", config: { production_eligible: false } }, { status: "active", config: {} }, { status: "active" }, { status: "active", config: { production_eligible: "true" } }]) {
      expect(rowIsRoutable(row as never), JSON.stringify(row)).toBe(false);
    }
  });

  const db = (answer: () => Promise<unknown>) => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: answer }) }) }),
  });

  it("reads the row by slug", async () => {
    expect(await providerRoutableIn(db(async () => ({ data: { status: "active", config: { production_eligible: true } } })), "fal-image")).toBe(true);
    expect(await providerRoutableIn(db(async () => ({ data: null })), "fal-image")).toBe(false);
  });

  it("a registry that throws or hangs is 'not routable', within the timeout", async () => {
    expect(await providerRoutableIn(db(async () => { throw new Error("down"); }), "fal-image")).toBe(false);
    vi.useFakeTimers();
    const pending = providerRoutableIn(db(() => new Promise(() => undefined)), "fal-image");
    await vi.advanceTimersByTimeAsync(ROUTABLE_READ_TIMEOUT_MS + 1);
    expect(await pending).toBe(false);
    vi.useRealTimers();
  });
});

describe("image-generate wiring", () => {
  const src = readFileSync("supabase/functions/image-generate/index.ts", "utf8");
  const handler = src.slice(src.indexOf("Deno.serve("));

  it("tries FAL only after OpenAI failed for a provider reason, and only when the fal-image row is routable", () => {
    expect(handler).toMatch(/if \(!result\.ok && result\.retryElsewhere && await providerRoutableIn\(serviceClient, "fal-image"\)\) \{\s*result = await generateWithFal\(/);
    expect(handler.indexOf("chargeDailyLimit(")).toBeLessThan(handler.indexOf("generateImage("));
    expect(handler.split("chargeDailyLimit(").length - 1).toBe(1); // one charge, whichever provider serves
  });

  it("a content refusal (400 / no image) is never retried on another provider", () => {
    expect(src).toContain("retryElsewhere: res.status !== 400");
    expect(src).toMatch(/content policy\.", retryElsewhere: false, code: "content_filtered"/);
  });

  it("the studio gets a fixed sentence, and the job row and registry get a code — never a provider sentence or secret name", () => {
    expect(handler).not.toMatch(/error: result\.error/);
    expect(handler).toContain('publicMediaFailure(result.error, "image", "image-generate")');
    expect(handler).toContain('error_message: result.code ?? "failed"');
    expect(handler).toMatch(/errorMessage: result\.code \?\? "unknown"/);
  });

  it("FAL outcomes are recorded against the fal-image row, and the FAL key is read only on the server", () => {
    expect(src).toMatch(/slug: "fal-image", ms: Date\.now\(\) - startedAt, success: true/);
    expect(src).toMatch(/slug: "fal-image", ms: Date\.now\(\) - startedAt, success: false, errorMessage: code/);
    expect(src).toContain('Deno.env.get("FAL_KEY")');
  });
});
