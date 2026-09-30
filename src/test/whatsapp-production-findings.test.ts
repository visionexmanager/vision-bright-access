// What the production logs showed after a real try: a video request that listed
// links (two files tried, both failed, no way to tell why), "3 صور لنمر" that got no
// answer at all, a forest-sound request that found nothing, and a media processor
// whose link to the functions could not be told from healthy. Each is pinned here.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { makeItem } from "../../supabase/functions/_shared/externalContent/http.ts";
import type { AggregateResult, ExternalContentItem } from "../../supabase/functions/_shared/externalContent/types.ts";
import { probeProcessor } from "../../supabase/functions/_shared/whatsappProcessor.ts";
import type { DeliverableAsset, DeliveryResult } from "../../supabase/functions/_shared/whatsappAssetDelivery.ts";
import { attachExternalFile, directCandidate, type AttachDeps } from "../../supabase/functions/_shared/whatsappExternalFiles.ts";
import { parseAssetRequest, parseImageRequest } from "../../supabase/functions/_shared/whatsappImageRequest.ts";

vi.setConfig({ testTimeout: 30_000 });

const MB = 1024 * 1024;
const UTM = "?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original";
const commonsFile = (name: string) => `https://upload.wikimedia.org/wikipedia/commons/a/ab/${name}${UTM}`;
const clip = (kind: "audio" | "video", mimeType: string, name: string, over: Partial<ExternalContentItem> = {}) => makeItem("Wikimedia Commons", {
  provider: "wikimedia_commons", providerItemId: name, title: name.replace(/\..*$/, "").replace(/_/g, " "), contentType: kind, mimeType, sizeBytes: 2 * MB,
  license: { name: "CC0", url: null }, externalUrl: `https://commons.wikimedia.org/wiki/File:${name}`, downloadUrl: commonsFile(name), ...over,
});
const found = (...items: ExternalContentItem[]): AggregateResult => ({ items, providers: [], duplicates: 0 });
const ok = (): DeliveryResult => ({ outcome: "delivered_video", kind: "video", bytes: 1, uploadTries: 1, sendTries: 1, ms: 1 });

function deps(over: { items?: ExternalContentItem[]; convert?: AttachDeps["convert"]; fetch?: AttachDeps["fetch"]; deliver?: AttachDeps["deliver"] } = {}) {
  const deliver = vi.fn<(asset: DeliverableAsset) => Promise<DeliveryResult>>(over.deliver ?? (async () => ok()));
  const d: AttachDeps = {
    fetch: (over.fetch ?? (async () => new Response(new Uint8Array(1000), { status: 200 }))) as never, env: () => undefined, deliver, sendText: async () => undefined,
    convert: over.convert, search: async () => found(...(over.items ?? [])),
  };
  return { d, deliver };
}

describe("a request written the way it was: a number before the noun, or a number word", () => {
  it.each([
    ["3 صور لنمر", 3], ["ثلاث صور نمر", 3], ["صورتين لنمر", 2], ["ابعتلي 3 صور لنمر", 3], ["three photos of a tiger", 3], ["2 photos of petra", 2], ["صور نمر", 3], ["صورة نمر", 1],
  ])("%s", (text, count) => {
    const parsed = parseImageRequest(text);
    expect(parsed, text).not.toBeNull();
    expect(parsed!.count).toBe(count);
    expect(parsed!.query).toMatch(/نمر|tiger|petra/);
  });

  it("a forest sound and a video of the forest at sunset are recognised as they were typed", () => {
    expect(parseAssetRequest("صوت الغابة")).toMatchObject({ kind: "audio", query: "الغابة" });
    expect(parseAssetRequest("بدي صوت الغابة")).toMatchObject({ kind: "audio", query: "الغابة" });
    expect(parseAssetRequest("فيديو عن الغابة وقت الغروب")).toMatchObject({ kind: "video", query: "الغابة وقت الغروب" });
    expect(parseAssetRequest("2 فيديو عن الغابة")).toMatchObject({ kind: "video", count: 2 });
  });

  it("a bare number is not a request, and making is still ruled out", () => {
    expect(parseImageRequest("3")).toBeNull();
    expect(parseImageRequest("3 أشخاص")).toBeNull();
    expect(parseImageRequest("3 صور أنشئ لنمر")).toBeNull();
  });
});

describe("a recording or a film is what the catalogue ranked for the words, like a picture", () => {
  it("one word of the subject is enough; the title does not have to repeat the whole phrase", async () => {
    const { d, deliver } = deps({ items: [clip("audio", "audio/mpeg", "Amazon_rainforest_ambience.mp3")] });
    const out = await attachExternalFile({ kind: "audio", query: "forest sound", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "delivered", kind: "video" });
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it("but a clip that shares no word with the request is still not sent", async () => {
    const { d, deliver } = deps({ items: [clip("audio", "audio/mpeg", "Car_engine_start.mp3")] });
    expect(await attachExternalFile({ kind: "audio", query: "forest sound", language: "en" }, d)).toMatchObject({ outcome: "none", reason: "no_candidate" });
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe("a failed try says why (a code, never a message, an address or a file name)", () => {
  const webm = () => clip("video", "video/webm", "Forest_sunset.webm");

  it("the processor refusing our token", async () => {
    const { d } = deps({ items: [webm()], convert: async () => ({ ok: false, code: "unauthorised" }) });
    expect(await attachExternalFile({ kind: "video", query: "forest sunset", language: "en" }, d)).toMatchObject({ outcome: "none", reason: "delivery_failed", detail: "convert_unauthorised" });
  });

  it("the processor not answering, being busy, or refusing the file", async () => {
    for (const code of ["network", "busy", "timeout", "conversion_failed", "bad_width"]) {
      const { d } = deps({ items: [webm()], convert: async () => ({ ok: false, code }) });
      expect(await attachExternalFile({ kind: "video", query: "forest sunset", language: "en" }, d), code).toMatchObject({ detail: `convert_${code}` });
    }
  });

  it("the download failing, and the delivery being refused after conversion", async () => {
    const down = deps({ items: [webm()], convert: async () => ({ ok: true, bytes: new Uint8Array(4), mime: "video/mp4" }), fetch: (async () => new Response(null, { status: 404 })) as never });
    expect(await attachExternalFile({ kind: "video", query: "forest sunset", language: "en" }, down.d)).toMatchObject({ detail: "download_asset_not_found" });
    const refused = deps({
      items: [webm()], convert: async () => ({ ok: true, bytes: new Uint8Array(4), mime: "video/mp4" }),
      deliver: async () => ({ outcome: "failed", reason: "asset_content_mismatch", ms: 1 }),
    });
    expect(await attachExternalFile({ kind: "video", query: "forest sunset", language: "en" }, refused.d)).toMatchObject({ detail: "deliver_asset_content_mismatch" });
  });

  it("a direct delivery that fails says so too", async () => {
    const { d } = deps({ items: [clip("audio", "audio/mpeg", "Forest_birds.mp3")], deliver: async () => ({ outcome: "failed", reason: "asset_download_failed", ms: 1 }) });
    expect(await attachExternalFile({ kind: "audio", query: "forest birds", language: "en" }, d)).toMatchObject({ detail: "deliver_asset_download_failed" });
  });

  it("the detail is a safe label, and the webhook logs it as the reason", () => {
    const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    expect(webhook.split("{ reason: attached.detail ?? attached.reason }")).toHaveLength(5);
    const source = readFileSync("supabase/functions/_shared/whatsappExternalFiles.ts", "utf8");
    expect(source).toContain('details[0]?.replace(/[^a-z0-9_]/gi, "_").slice(0, 60)');
  });
});

describe("the processor takes widths it lists, not 1600 (a bad width was a 400 and every resize failed)", () => {
  it("asks for 1920 wide", async () => {
    const convert = vi.fn(async (_b: Uint8Array, _q: string) => ({ ok: true, bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), mime: "image/jpeg" }));
    const item = makeItem("Wikimedia Commons", {
      provider: "wikimedia_commons", providerItemId: "1", title: "Fox", contentType: "image", mimeType: "image/webp", sizeBytes: 1 * MB, license: { name: "CC0", url: null },
      externalUrl: "https://commons.wikimedia.org/wiki/File:Fox.webp", downloadUrl: commonsFile("Fox.webp"),
    });
    const { d } = deps({ items: [item], convert });
    await attachExternalFile({ kind: "image", query: "fox", language: "en" }, d);
    expect(convert.mock.calls[0][1]).toBe("to=jpg&width=1920&quality=balanced");
    const widths = ["320", "640", "800", "1024", "1280", "1920", "2560"];
    expect(widths).toContain(/width=(\d+)/.exec(convert.mock.calls[0][1])![1]);
    // Every conversion the pipeline can ask for, checked against the list the service itself publishes.
    const service = readFileSync("services/media-processor/src/convert.mjs", "utf8");
    expect(service).toContain('export const WIDTHS = ["320", "640", "800", "1024", "1280", "1920", "2560"];');
    const externals = readFileSync("supabase/functions/_shared/whatsappExternalFiles.ts", "utf8");
    for (const m of externals.matchAll(/width=(\d+)&quality/g)) expect(widths).toContain(m[1]);
  });

  it("every conversion target the pipeline uses is one the processor names", () => {
    const service = readFileSync("services/media-processor/src/convert.mjs", "utf8");
    for (const target of ["mp4", "mp3", "jpg"]) expect(service).toMatch(new RegExp(`${target}:\\s*\\{`));
    expect(directCandidate(clip("video", "video/webm", "A.webm"), "video")?.convert?.to).toBe("mp4");
    expect(directCandidate(clip("audio", "audio/ogg", "A.ogg"), "audio")?.convert?.to).toBe("mp3");
  });
});

describe("probeProcessor: a state the health check can report, never the token", () => {
  const config = { url: "https://processor.example/internal/media", token: "secret-token-value" };
  const answer = (status: number, body?: unknown) => vi.fn(async (_url: string, _init?: RequestInit) => new Response(body === undefined ? null : JSON.stringify(body), { status }));

  it("not configured is a state, not an error", async () => {
    expect(await probeProcessor({ config: null })).toEqual({ state: "not_configured" });
  });

  it("asks /capabilities with the bearer token and reads the conversions", async () => {
    const f = answer(200, { ok: true, convert: { audio: ["mp3", "m4a"], video: ["mp4", "gif"], image: ["jpg", "png"] } });
    expect(await probeProcessor({ config, fetchImpl: f as never })).toEqual({ state: "ok", convert: { audio: ["mp3", "m4a"], video: ["mp4", "gif"], image: ["jpg", "png"] } });
    expect(f.mock.calls[0][0]).toBe("https://processor.example/internal/media/capabilities");
    expect((f.mock.calls[0][1]!.headers as Record<string, string>).authorization).toBe("Bearer secret-token-value");
  });

  it("a refused token is told apart from an outage", async () => {
    expect(await probeProcessor({ config, fetchImpl: answer(401, { ok: false }) as never })).toEqual({ state: "unauthorised", status: 401 });
    expect(await probeProcessor({ config, fetchImpl: answer(403) as never })).toEqual({ state: "unauthorised", status: 403 });
    expect(await probeProcessor({ config, fetchImpl: answer(502) as never })).toEqual({ state: "bad_response", status: 502 });
    expect(await probeProcessor({ config, fetchImpl: (async () => { throw new Error("connect refused to processor.example"); }) as never })).toEqual({ state: "unreachable" });
  });

  it("an older image that does not list its conversions is still reachable", async () => {
    expect(await probeProcessor({ config, fetchImpl: answer(200, { ok: true, ocr: true }) as never })).toEqual({ state: "ok", convert: null });
  });

  it("nothing it returns carries the token or the address", async () => {
    for (const f of [answer(401), answer(200, { convert: { audio: ["mp3"] } }), (async () => { throw new Error("secret-token-value processor.example"); }) as never]) {
      const out = JSON.stringify(await probeProcessor({ config, fetchImpl: f as never }));
      expect(out).not.toMatch(/secret-token-value|processor\.example/);
    }
  });

  it("the health check reports it, and says which fix each state needs", () => {
    const health = readFileSync("supabase/functions/health-check/index.ts", "utf8");
    expect(health).toContain("results.media_processor");
    expect(health).toContain("const processor = await probeProcessor();");
    for (const phrase of ["refused our token", "is not configured", "did not answer", "deploy-media-processor"]) expect(health).toContain(phrase);
  });
});
