// The file, and only the file: a request for a picture, a video, a recording or a
// paper answers with the file (or files) and nothing else — no link, no second
// message — unless the sender asked for the link, in which case the answer is the
// link and nothing is attached. Plus the Commons address fix that let a video (and
// every Commons picture) through at all.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { makeItem } from "../../supabase/functions/_shared/externalContent/http.ts";
import type { AggregateResult, ExternalContentItem } from "../../supabase/functions/_shared/externalContent/types.ts";
import { deliverAsset, type DeliverableAsset, type DeliveryResult } from "../../supabase/functions/_shared/whatsappAssetDelivery.ts";
import { attachExternalFile, attributionCaption, directCandidate, findExternalLinks, type AttachDeps } from "../../supabase/functions/_shared/whatsappExternalFiles.ts";
import { parseAssetRequest, parseImageRequest, wantsLink } from "../../supabase/functions/_shared/whatsappImageRequest.ts";

// The first parse compiles a dozen large word patterns (about a second, once per instance); under a loaded test run that can pass the default five.
vi.setConfig({ testTimeout: 30_000 });

const MB = 1024 * 1024;
const UTM = "?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original";
const commonsFile = (name: string) => `https://upload.wikimedia.org/wikipedia/commons/a/ab/${name}`;
const commons = (over: Partial<ExternalContentItem> = {}) => makeItem("Wikimedia Commons", {
  provider: "wikimedia_commons", providerItemId: "1", title: "Red fox", contentType: "image", mimeType: "image/jpeg", sizeBytes: 2 * MB,
  description: "A red fox", creator: "Jane Doe", license: { name: "CC BY 4.0", url: null },
  externalUrl: "https://commons.wikimedia.org/wiki/File:Red_fox.jpg", downloadUrl: commonsFile("Red_fox.jpg") + UTM, ...over,
});
const paper = (over: Partial<ExternalContentItem> = {}) => makeItem("OpenAlex", {
  provider: "openalex", providerItemId: "10.1000/abc", title: "Accessible education", contentType: "document", mimeType: "application/pdf", creator: "A. Author",
  externalUrl: "https://doi.org/10.1000/abc", downloadUrl: "https://zenodo.org/records/1/files/paper.pdf", license: { name: "CC BY", url: null }, ...over,
});

const delivered = (kind: "image" | "document" = "image"): DeliveryResult => ({ outcome: `delivered_${kind}`, kind, bytes: 10, uploadTries: 1, sendTries: 1, ms: 5 });
const found = (...items: ExternalContentItem[]): AggregateResult => ({ items, providers: [], duplicates: 0 });
function deps(over: { items?: ExternalContentItem[]; deliver?: AttachDeps["deliver"]; convert?: AttachDeps["convert"]; fetch?: AttachDeps["fetch"] } = {}) {
  const deliverFn = vi.fn<(asset: DeliverableAsset) => Promise<DeliveryResult>>(over.deliver ?? (async () => delivered()));
  const sendText = vi.fn(async () => undefined);
  const fetchFn = vi.fn(over.fetch ?? (async (url: string) => { throw new Error(`unexpected fetch ${url}`); }));
  const d: AttachDeps = { fetch: fetchFn as never, env: () => undefined, deliver: deliverFn, sendText, convert: over.convert, search: async () => found(...(over.items ?? [])) };
  return { d, deliverFn, sendText, fetchFn };
}

describe("Commons addresses as the API really returns them", () => {
  it("accepts the tracking query and fetches the bare file address", () => {
    expect(directCandidate(commons(), "image")).toMatchObject({ url: commonsFile("Red_fox.jpg"), mime: "image/jpeg" });
    const pdf = directCandidate(commons({ contentType: "document", mimeType: "application/pdf", downloadUrl: commonsFile("R.pdf") + UTM, title: "R" }), "document");
    expect(pdf?.url).toBe(commonsFile("R.pdf"));
    expect(directCandidate(commons({ sizeBytes: 40 * MB, downloadUrl: commonsFile("Big.jpg") + UTM }), "image")?.url).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/Big.jpg?width=1600");
  });

  it("still refuses any other query, a path trick, or another host", () => {
    for (const downloadUrl of [commonsFile("x.jpg") + "?token=abc", commonsFile("x.jpg") + "?utm_source=a/../../b#", "https://upload.wikimedia.org.evil.example/wikipedia/commons/a/ab/x.jpg" + UTM]) {
      expect(directCandidate(commons({ downloadUrl }), "image"), downloadUrl).toBeNull();
    }
  });

  it("reads an Ogg by its extension: .ogv is a video, the rest is sound, and both are converted", () => {
    const ogg = (name: string) => commons({ contentType: "audio", mimeType: "application/ogg", downloadUrl: commonsFile(name) + UTM, sizeBytes: 2 * MB, title: "Clip" });
    expect(directCandidate(ogg("Lion.ogv"), "video")).toMatchObject({ convert: { to: "mp4" }, mustConvert: true, url: commonsFile("Lion.ogv") });
    expect(directCandidate(ogg("Lion.ogv"), "audio")).toBeNull();
    expect(directCandidate(ogg("Thunder.ogg"), "audio")).toMatchObject({ convert: { to: "mp3" } });
    expect(directCandidate(ogg("Thunder.ogg"), "video")).toBeNull();
  });
});

describe("attribution rides in the caption; nothing else follows the file", () => {
  it("public domain and CC0 carry no caption at all", () => {
    for (const name of ["CC0", "Public domain", "Public Domain Mark", "United States Government Work"]) {
      expect(attributionCaption(commons({ license: { name, url: null } })), name).toBeUndefined();
    }
  });

  it("a licence that asks for credit gets title, maker, licence and source in the caption, and never an address", () => {
    const caption = attributionCaption(commons({ license: { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" } }));
    expect(caption).toBe("Red fox — Jane Doe\nCC BY-SA 4.0 · Wikimedia Commons");
    expect(caption).not.toMatch(/https?:|www\.|creativecommons/);
    expect(attributionCaption(commons({ title: "x".repeat(900) }))!.length).toBeLessThanOrEqual(400);
  });

  it("delivery sends one file message and no text, for a picture and for a paper", async () => {
    for (const [kind, item, query] of [["image", commons(), "red fox"], ["document", paper(), "accessible education"]] as const) {
      const { d, deliverFn, sendText } = deps({ items: [item] });
      expect(await attachExternalFile({ kind, query, language: "en" }, d)).toMatchObject({ outcome: "delivered" });
      expect(deliverFn).toHaveBeenCalledTimes(1);
      expect(String(deliverFn.mock.calls[0][0].caption ?? "")).not.toMatch(/https?:/);
      expect(sendText).not.toHaveBeenCalled();
    }
  });
});

describe("several files when several are asked for", () => {
  const fox = (n: number) => commons({ providerItemId: String(n), title: `Fox ${n}`, downloadUrl: `https://upload.wikimedia.org/wikipedia/commons/a/ab/Fox_${n}.jpg${UTM}` });

  it("sends the number asked for, each a different picture, and stops", async () => {
    const { d, deliverFn } = deps({ items: [1, 2, 3, 4, 5, 6].map(fox) });
    expect(await attachExternalFile({ kind: "image", query: "fox", language: "en", count: 3 }, d)).toMatchObject({ outcome: "delivered", count: 3 });
    expect(deliverFn).toHaveBeenCalledTimes(3);
    expect(new Set(deliverFn.mock.calls.map((c) => c[0].url)).size).toBe(3);
  });

  it("one file by default, and never more than five", async () => {
    const one = deps({ items: [1, 2, 3].map(fox) });
    expect(await attachExternalFile({ kind: "image", query: "fox", language: "en" }, one.d)).toMatchObject({ count: 1 });
    expect(one.deliverFn).toHaveBeenCalledTimes(1);
    const many = deps({ items: [1, 2, 3, 4, 5, 6, 7, 8].map(fox) });
    expect(await attachExternalFile({ kind: "image", query: "fox", language: "en", count: 99 }, many.d)).toMatchObject({ count: 5 });
  });

  it("delivers what it can when fewer are available, and never sends the same file twice", async () => {
    const { d, deliverFn } = deps({ items: [fox(1), fox(1), fox(2)] });
    expect(await attachExternalFile({ kind: "image", query: "fox", language: "en", count: 3 }, d)).toMatchObject({ outcome: "delivered", count: 2 });
    expect(deliverFn).toHaveBeenCalledTimes(2);
  });

  it("is read from the message: a number, or a plural", () => {
    expect(parseImageRequest("ابعتلي 4 صور لأسد")).toMatchObject({ count: 4 });
    expect(parseImageRequest("ابعتلي صور أسد")).toMatchObject({ count: 3 });
    expect(parseImageRequest("ابعتلي صورة أسد")).toMatchObject({ count: 1 });
    expect(parseImageRequest("send me 9 photos of a lion")).toMatchObject({ count: 5 });
    expect(parseAssetRequest("find research papers about dyslexia and send them")).toMatchObject({ kind: "document", count: 3 });
    expect(parseAssetRequest("send me a video about volcanoes")).toMatchObject({ kind: "video", count: 1 });
  });
});

describe("a request for the link gets the link, and only the link", () => {
  it.each([
    "send me a photo of a lion with the link", "ابعتلي صورة أسد مع الرابط", "send me the link to a photo of a lion", "envoie-moi une photo de lion avec le lien",
    "envíame una foto de un león con el enlace", "schick mir ein Foto von einem Löwen mit Link", "пришли фото льва и ссылку",
  ])("the message asks for the address: %s", (text) => expect(wantsLink(text)).toBe(true));

  it("a plain request does not, and the parser reports it", () => {
    for (const text of ["send me a photo of a lion", "ابعتلي صورة أسد"]) expect(wantsLink(text), text).toBe(false);
    expect(parseImageRequest("send me a photo of a lion with the link")).toMatchObject({ wantsLink: true, query: "lion" });
    expect(parseImageRequest("ابعتلي صورة أسد مع الرابط")).toMatchObject({ wantsLink: true, query: "أسد" });
    expect(parseAssetRequest("send me a video about volcanoes with the link")).toMatchObject({ kind: "video", wantsLink: true, query: "volcanoes" });
  });

  it("findExternalLinks returns the results' pages (up to three) and touches nothing else", async () => {
    const fetchFn = vi.fn();
    const links = await findExternalLinks(
      { kind: "image", query: "red fox", language: "en" },
      { fetch: fetchFn as never, env: () => undefined, search: async () => found(...[1, 2, 3, 4].map((n) => commons({ providerItemId: String(n), title: `Fox ${n}`, externalUrl: `https://commons.wikimedia.org/wiki/File:Fox_${n}.jpg` }))) },
    );
    expect(links).toHaveLength(3);
    expect(links[0]).toEqual({ title: "Fox 1", url: "https://commons.wikimedia.org/wiki/File:Fox_1.jpg" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("searches in English first for a request in another script, like the file flow does", async () => {
    const searched: string[] = [];
    const links = await findExternalLinks(
      { kind: "image", query: "أسد", language: "ar" },
      { fetch: (async () => { throw new Error("no network"); }) as never, env: () => undefined, translate: async () => "lion", search: async (i) => { searched.push(i.query); return found(commons()); } },
    );
    expect(searched).toEqual(["lion"]);
    expect(links).toHaveLength(1);
  });

  it("the webhook answers it with links and attaches nothing, in every flow that can attach", () => {
    const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    expect(webhook).toMatch(/imageRequest\.wantsLink && \(await answerWithLinks\("image", imageRequest\.query\)\)/);
    expect(webhook).toMatch(/assetRequest\.wantsLink && \(await answerWithLinks\(assetRequest\.kind, assetRequest\.query\)\)/);
    expect(webhook).toContain("imageRequest && !imageRequest.wantsLink && token && phoneNumberId");
    expect(webhook).toContain("assetRequest && !assetRequest.wantsLink && token && phoneNumberId");
    expect(webhook).toContain('request.kind !== "podcast" && !wantsLink(questionText)');
  });
});

describe("a short video is delivered: WebM from Commons, converted to MP4, sent as a real video", () => {
  it("end to end through deliverAsset with a stand-in processor", async () => {
    const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0]);
    const calls: Array<{ url: string; body?: unknown }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://upload.wikimedia.org/")) return new Response(new Uint8Array(2000), { status: 200, headers: { "content-type": "video/webm" } });
      calls.push({ url, body: init?.body });
      if (/\/media$/.test(url)) return new Response(JSON.stringify({ id: "media-1" }), { status: 200 });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
    });
    const convert = vi.fn(async (_bytes: Uint8Array, _query: string) => ({ ok: true, bytes: MP4, mime: "video/mp4" }));
    const item = commons({ contentType: "video", mimeType: "video/webm", title: "Volcano", downloadUrl: commonsFile("Volcano.webm") + UTM, sizeBytes: 3 * MB, license: { name: "CC0", url: null } });
    const { d, sendText } = deps({
      items: [item], convert: convert as never, fetch: fetchImpl as never,
      deliver: (asset) => deliverAsset({ phoneNumberId: "111", token: "t", to: "9627", asset, fetchImpl: fetchImpl as never, sleep: async () => undefined }),
    });
    expect(await attachExternalFile({ kind: "video", query: "volcano", language: "en" }, d)).toMatchObject({ outcome: "delivered", kind: "video" });
    expect(convert.mock.calls[0][1]).toBe("to=mp4");
    expect(calls.map((c) => c.url.split("/").slice(-1)[0])).toEqual(["media", "messages"]);
    expect(JSON.parse(String(calls[1].body))).toMatchObject({ type: "video", video: { id: "media-1" } });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("with no processor a clip that needs converting is not sent, and the answer is its page", async () => {
    const item = commons({ contentType: "video", mimeType: "video/webm", title: "Volcano", downloadUrl: commonsFile("Volcano.webm") + UTM, sizeBytes: 3 * MB, license: { name: "CC0", url: null }, externalUrl: "https://commons.wikimedia.org/wiki/File:Volcano.webm" });
    const { d, deliverFn } = deps({ items: [item] });
    const out = await attachExternalFile({ kind: "video", query: "volcano", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "none", reason: "no_candidate", link: { url: "https://commons.wikimedia.org/wiki/File:Volcano.webm" } });
    expect(deliverFn).not.toHaveBeenCalled();
  });
});
