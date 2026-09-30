// "Send me a photo of ..." on WhatsApp: which messages are a request to FIND an
// existing picture (and which are not), which pictures may be sent as the file,
// and what happens when one cannot be.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { makeItem } from "../../supabase/functions/_shared/externalContent/http.ts";
import type { AggregateResult, ExternalContentItem } from "../../supabase/functions/_shared/externalContent/types.ts";
import { deliverAsset, type DeliverableAsset, type DeliveryResult } from "../../supabase/functions/_shared/whatsappAssetDelivery.ts";
import { IMAGE_QUERY_MAX_CHARS, parseImageRequest } from "../../supabase/functions/_shared/whatsappImageRequest.ts";
import {
  DELIVERY_HOSTS, KIND_SEARCH, attachExternalFile, directCandidate, matchesRequest, type AttachDeps,
} from "../../supabase/functions/_shared/whatsappExternalFiles.ts";

const MB = 1024 * 1024;
const CC_BY = { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" };
const CC_BY_ND = { name: "CC BY-ND 2.0", url: "https://creativecommons.org/licenses/by-nd/2.0/" };

const commons = (over: Partial<ExternalContentItem> = {}) => makeItem("Wikimedia Commons", {
  provider: "wikimedia_commons", providerItemId: "123", title: "Red fox in snow", contentType: "image", mimeType: "image/jpeg", sizeBytes: 2 * MB,
  description: "A red fox standing in snow", creator: "Jane Doe", license: CC_BY,
  externalUrl: "https://commons.wikimedia.org/wiki/File:Red_fox_in_snow.jpg",
  downloadUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Red_fox_in_snow.jpg",
  thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Red_fox_in_snow.jpg/480px-Red_fox_in_snow.jpg", ...over,
});
const OPENVERSE_ID = "0a1b2c3d-0000-4000-8000-0123456789ab";
const openverse = (over: Partial<ExternalContentItem> = {}) => makeItem("Openverse", {
  provider: "openverse", providerItemId: `image:${OPENVERSE_ID}`, title: "Eiffel Tower at dusk", contentType: "image", creator: "J. Photographer", license: CC_BY,
  externalUrl: "https://www.flickr.com/photos/x/1", downloadUrl: "https://live.staticflickr.com/1/2_o.jpg", tags: ["paris", "tower"],
  thumbnailUrl: `https://api.openverse.org/v1/images/${OPENVERSE_ID}/thumb/`, ...over,
});

// ─── What counts as a request ─────────────────────────────────────────────

describe("parseImageRequest: an explicit request to find and send an existing picture", () => {
  it.each([
    ["send me an image of a red fox", "red fox"],
    ["Send me a photo of the Eiffel Tower", "Eiffel Tower"],
    ["find a picture of mount everest and send it to me", "mount everest"],
    ["find an image of the Lord of the Rings and send it to me", "Lord of the Rings"],
    ["show me photos of Petra", "Petra"],
    ["please send me a photo of salt and pepper", "salt and pepper"],
  ])("English: %s", (text, query) => expect(parseImageRequest(text)).toEqual({ query }));

  // One real request per supported language; the subject must survive, the verb, image word and filler must not.
  it.each([
    ["ar", "أرسل لي صورة عن البتراء", "البتراء"],
    ["ar", "ابعتلي صورة لجبل أحد".replace("لجبل", "جبل"), "جبل أحد"],
    ["bn", "আমাকে তাজমহলের ছবি পাঠাও".replace("তাজমহলের", "তাজমহল"), "তাজমহল"],
    ["de", "Schick mir ein Foto von Berlin", "Berlin"],
    ["es", "Envíame una foto de Barcelona", "Barcelona"],
    ["es", "busca una imagen de un zorro rojo", "zorro rojo"],
    ["fa", "یک عکس از اصفهان برای من بفرست", "اصفهان"],
    ["fr", "Envoie-moi une photo de la tour Eiffel", "tour Eiffel"],
    ["hi", "मुझे ताजमहल की तस्वीर भेजो", "ताजमहल"],
    ["id", "kirim foto Candi Borobudur", "Candi Borobudur"],
    ["it", "mandami una foto del Colosseo".replace("del ", ""), "Colosseo"],
    ["ja", "エッフェル塔の写真を送って", "エッフェル塔"],
    ["ko", "에펠탑 사진 보내줘", "에펠탑"],
    ["nl", "stuur me een foto van Amsterdam", "Amsterdam"],
    ["pl", "wyślij mi zdjęcie Krakowa".replace("mi ", ""), "Krakowa"],
    ["pt", "envia uma foto de Lisboa", "Lisboa"],
    ["ru", "пришли мне фото Байкала", "Байкала"],
    ["tr", "bana İstanbul fotoğrafı gönder".replace("fotoğrafı", "fotoğraf"), "İstanbul"],
    ["ur", "مجھے لاہور کی تصویر بھیجو", "لاہور"],
    ["vi", "gửi cho tôi ảnh Hà Nội", "Hà Nội"],
    ["zh", "给我发一张埃菲尔铁塔的照片", "埃菲尔铁塔"],
  ])("%s: %s", (_language, text, query) => {
    const parsed = parseImageRequest(text);
    expect(parsed, text).not.toBeNull();
    expect(parsed!.query).toContain(query);
  });

  it("carries a query short enough for a search, and refuses one that is not", () => {
    expect(parseImageRequest(`send me a photo of ${"x".repeat(IMAGE_QUERY_MAX_CHARS + 1)}`)).toBeNull();
  });
});

describe("parseImageRequest: what is not this flow's business", () => {
  it.each([
    "generate an image of a red fox",
    "create a picture of a castle",
    "draw me a photo of a dragon",
    "make an image of the moon and send it to me",
    "send me an image you generate of a cat",
    "design a picture of a logo",
  ])("a request to CREATE a picture is left to the existing flow: %s", (text) => expect(parseImageRequest(text)).toBeNull());

  it.each([
    ["ar", "أنشئ صورة لقطة وأرسلها لي"], ["bn", "একটি ছবি তৈরি করে পাঠাও"], ["de", "Erstelle ein Bild von einer Katze und schick es mir"],
    ["es", "Genera una imagen de un gato y envíamela"], ["fa", "یک عکس بساز و بفرست"], ["fr", "Génère une image d'un chat et envoie-la moi"],
    ["hi", "एक तस्वीर बनाओ और भेजो"], ["id", "buat gambar kucing lalu kirim"], ["it", "Genera un'immagine di un gatto e mandamela"],
    ["ja", "猫の画像を生成して送って"], ["ko", "고양이 이미지 생성해서 보내줘"], ["nl", "Genereer een afbeelding van een kat en stuur me"],
    ["pl", "Wygeneruj obraz kota i wyślij"], ["pt", "Gera uma imagem de um gato e envia"], ["ru", "Сгенерируй картинку кота и пришли"],
    ["tr", "Bir kedi resmi oluştur ve gönder"], ["ur", "بلی کی تصویر بنائیں اور بھیجیں"], ["vi", "tạo ảnh con mèo rồi gửi cho tôi"],
    ["zh", "生成一张猫的图片并发给我"],
  ])("%s: a request to CREATE is left alone (%s)", (_language, text) => expect(parseImageRequest(text), text).toBeNull());

  it("a slash command is never a request here", () => {
    expect(parseImageRequest("/image a red fox")).toBeNull();
    expect(parseImageRequest("/image send me a photo of a fox")).toBeNull();
  });

  it("needs BOTH an image word and a verb that retrieves", () => {
    expect(parseImageRequest("a photo of a red fox")).toBeNull(); // no verb
    expect(parseImageRequest("what is in this image of a fox")).toBeNull(); // no retrieving verb
    expect(parseImageRequest("send me the address of the shop")).toBeNull(); // no image word
    expect(parseImageRequest("")).toBeNull();
    expect(parseImageRequest(null)).toBeNull();
    expect(parseImageRequest(undefined)).toBeNull();
  });

  it("leaves a sentence about a picture someone already has, and an empty subject, alone", () => {
    expect(parseImageRequest("send me the image you sent me")).toBeNull();
    expect(parseImageRequest("send me a photo")).toBeNull();
    expect(parseImageRequest("send me an image of it")).toBeNull();
  });

  it("does not take an ordinary Turkish or Vietnamese sentence for a creation request", () => {
    // "ve" (Turkish "and") and "về" (Vietnamese "about") are words in the filler lists, not in the creation list.
    expect(parseImageRequest("bana Ankara ve İzmir fotoğraf gönder")?.query).toContain("Ankara");
    expect(parseImageRequest("gửi ảnh về Hà Nội")?.query).toContain("Hà Nội");
  });
});

// ─── Which pictures may be sent as the file ───────────────────────────────

describe("the image sources", () => {
  it("asks only Wikimedia Commons and Openverse, for images", () => {
    expect(KIND_SEARCH.image).toEqual({ categories: ["images"], providers: ["wikimedia_commons", "openverse"] });
    for (const provider of ["youtube", "vimeo", "pixabay", "flickr", "pexels", "unsplash"]) expect(DELIVERY_HOSTS[provider]).toBeUndefined();
    expect(DELIVERY_HOSTS.wikimedia_commons).toEqual(["upload.wikimedia.org", "commons.wikimedia.org"]);
    expect(DELIVERY_HOSTS.openverse).toEqual(["api.openverse.org"]);
  });

  it("sends a Commons original that fits Meta's 5 MB image limit, from Commons' own server", () => {
    expect(directCandidate(commons(), "image")).toMatchObject({
      url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Red_fox_in_snow.jpg", mime: "image/jpeg", size: 2 * MB, fileName: "Red-fox-in-snow.jpg",
      hosts: ["upload.wikimedia.org", "commons.wikimedia.org"],
    });
  });

  it("sends Commons' own resized copy of an original that is too big", () => {
    const big = directCandidate(commons({ sizeBytes: 40 * MB }), "image");
    expect(big).toMatchObject({ url: "https://commons.wikimedia.org/wiki/Special:FilePath/Red_fox_in_snow.jpg?width=1600", mime: "image/jpeg", size: null });
  });

  it("never makes a resized copy of a no-derivatives work, and never sends an unlicensed one", () => {
    expect(directCandidate(commons({ sizeBytes: 40 * MB, license: CC_BY_ND }), "image")).toBeNull();
    expect(directCandidate(commons({ license: null }), "image")).toBeNull();
    expect(directCandidate(commons({ downloadUrl: null }), "image")).toBeNull();
    // An original that fits is sent as it is, even under ND: that is a copy, not an adaptation.
    expect(directCandidate(commons({ license: CC_BY_ND }), "image")).not.toBeNull();
  });

  it("refuses a type Meta does not take (WebP, SVG, GIF) and a file address that is not Commons' original", () => {
    for (const mimeType of ["image/webp", "image/svg+xml", "image/gif", "image/tiff"]) expect(directCandidate(commons({ mimeType }), "image")).toBeNull();
    expect(directCandidate(commons({ downloadUrl: "https://evil.example/a.jpg" }), "image")).toBeNull();
    expect(directCandidate(commons({ downloadUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/x.jpg/200px-x.jpg" }), "image")).toBeNull();
  });

  it("sends an Openverse result as Openverse's own thumbnail, never from the site the work came from", () => {
    expect(directCandidate(openverse(), "image")).toMatchObject({
      url: `https://api.openverse.org/v1/images/${OPENVERSE_ID}/thumb/`, mime: "image/jpeg", hosts: ["api.openverse.org"],
    });
    expect(directCandidate(openverse({ thumbnailUrl: "https://live.staticflickr.com/1/2_b.jpg" }), "image")).toBeNull();
    expect(directCandidate(openverse({ license: CC_BY_ND }), "image")).toBeNull();
    expect(directCandidate(openverse({ license: null }), "image")).toBeNull();
    expect(directCandidate(openverse({ downloadUrl: null }), "image")).toBeNull();
  });

  it("never offers a picture from a source whose terms do not allow this (Pixabay, Flickr, YouTube, Vimeo)", () => {
    for (const provider of ["pixabay", "flickr", "youtube", "vimeo"]) {
      const item = makeItem(provider, {
        provider, providerItemId: "1", title: "Red fox", contentType: "image", license: CC_BY, downloadUrl: "https://i.example/a.jpg", mimeType: "image/jpeg",
        thumbnailUrl: "https://i.example/t.jpg", externalUrl: "https://example.com/x",
      });
      expect(directCandidate(item, "image"), provider).toBeNull();
    }
  });

  it("matches a picture on what it shows, not only on its file-name title", () => {
    const fox = commons({ title: "IMG 2041", description: "A red fox standing in snow" });
    expect(matchesRequest(fox, "red fox")).toBe(false);
    expect(matchesRequest(fox, "red fox", true)).toBe(true);
    expect(matchesRequest(openverse(), "paris tower", true)).toBe(true);
    expect(matchesRequest(commons(), "submarine", true)).toBe(false);
  });
});

// ─── The flow ─────────────────────────────────────────────────────────────

const delivered = (kind: "image" | "document" = "image"): DeliveryResult => ({ outcome: `delivered_${kind}`, kind, bytes: 10, uploadTries: 1, sendTries: 1, ms: 5 });
const failed = (): DeliveryResult => ({ outcome: "failed", reason: "asset_download_failed", ms: 5 });
const found = (...items: ExternalContentItem[]): AggregateResult => ({ items, providers: [], duplicates: 0 });

function deps(over: { items?: ExternalContentItem[]; deliver?: (a: DeliverableAsset) => Promise<DeliveryResult>; search?: AttachDeps["search"] } = {}) {
  const deliverFn = vi.fn<(asset: DeliverableAsset) => Promise<DeliveryResult>>(over.deliver ?? (async () => delivered()));
  const sendText = vi.fn(async () => undefined);
  const fetchFn = vi.fn(async (url: string) => { throw new Error(`unexpected fetch ${url}`); });
  const d: AttachDeps = { fetch: fetchFn as never, env: () => undefined, deliver: deliverFn, sendText, search: over.search ?? (async () => found(...(over.items ?? []))) };
  return { d, deliverFn, sendText, fetchFn };
}

describe("attachExternalFile for an image", () => {
  it("delivers a Wikimedia Commons picture as an image, then sends the credit: title, maker, source, licence, page", async () => {
    const { d, deliverFn, sendText } = deps({ items: [commons()] });
    const out = await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "delivered", provider: "wikimedia_commons", kind: "image", tried: 1 });
    expect(deliverFn.mock.calls[0][0]).toMatchObject({
      url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Red_fox_in_snow.jpg", mimeType: "image/jpeg", fileName: "Red-fox-in-snow.jpg",
      allowedHosts: ["upload.wikimedia.org", "commons.wikimedia.org"],
    });
    // A failed delivery must fall through to the caller, not send a second message from inside.
    expect(deliverFn.mock.calls[0][0]).not.toHaveProperty("fallbackUrl");
    const credit = String((sendText.mock.calls[0] as unknown[])[0]);
    expect(credit).toContain("Red fox in snow — Jane Doe");
    expect(credit).toContain("Wikimedia Commons · CC BY 4.0");
    expect(credit).toContain("https://commons.wikimedia.org/wiki/File:Red_fox_in_snow.jpg");
  });

  it("delivers an Openverse picture from Openverse's host, with its credit", async () => {
    const { d, deliverFn, sendText } = deps({ items: [openverse()] });
    const out = await attachExternalFile({ kind: "image", query: "eiffel tower", language: "fr" }, d);
    expect(out).toMatchObject({ outcome: "delivered", provider: "openverse", kind: "image" });
    expect(deliverFn.mock.calls[0][0]).toMatchObject({ url: `https://api.openverse.org/v1/images/${OPENVERSE_ID}/thumb/`, allowedHosts: ["api.openverse.org"], mimeType: "image/jpeg" });
    expect(String((sendText.mock.calls[0] as unknown[])[0])).toContain("Openverse · CC BY 4.0");
  });

  it("searches only the two sources, for images, in the sender's language", async () => {
    const search = vi.fn(async () => found());
    await attachExternalFile({ kind: "image", query: "red fox", language: "ar" }, deps({ search }).d);
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: "red fox", providers: ["wikimedia_commons", "openverse"], categories: ["images"], language: "ar" }));
  });

  it("skips a picture that is not the one asked for, and tries the next that is", async () => {
    const { d, deliverFn } = deps({ items: [commons({ title: "Cathedral", description: "A church", providerItemId: "1" }), openverse({ title: "Red fox", tags: ["fox"] })] });
    const out = await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "delivered", provider: "openverse", tried: 1 });
    expect(deliverFn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the result's own page when the picture cannot be attached — and says nothing itself", async () => {
    const { d, sendText } = deps({ items: [commons({ providerItemId: "1" }), commons({ providerItemId: "2" })], deliver: async () => failed() });
    const out = await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d);
    expect(out).toEqual({ outcome: "none", reason: "delivery_failed", tried: 2, link: { url: "https://commons.wikimedia.org/wiki/File:Red_fox_in_snow.jpg", title: "Red fox in snow" } });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("offers the page of a match that could never be attached (no-derivatives and too big), still as a link", async () => {
    const { d, deliverFn } = deps({ items: [commons({ sizeBytes: 40 * MB, license: CC_BY_ND })] });
    const out = await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "none", reason: "no_candidate", tried: 0, link: { url: "https://commons.wikimedia.org/wiki/File:Red_fox_in_snow.jpg" } });
    expect(deliverFn).not.toHaveBeenCalled();
  });

  it("a search with no match gives no link at all, so the message goes on to whatever handled it before", async () => {
    const out = await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, deps({ items: [] }).d);
    expect(out).toEqual({ outcome: "none", reason: "no_candidate", tried: 0 });
    const broken = await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, deps({ search: async () => { throw new Error("down"); } }).d);
    expect(broken).toEqual({ outcome: "none", reason: "search_failed", tried: 0 });
  });

  it("does not add a link to the other kinds (their callers have their own list)", async () => {
    const out = await attachExternalFile({ kind: "book", query: "frankenstein", language: "en" }, deps({ items: [makeItem("Project Gutenberg", {
      provider: "gutenberg", providerItemId: "84", title: "Frankenstein", contentType: "book", externalUrl: "https://www.gutenberg.org/ebooks/84", license: CC_BY,
    })], deliver: async () => failed() }).d);
    expect(out).not.toHaveProperty("link");
  });
});

// ─── Through the real delivery code, against a stand-in for Meta ──────────

describe("end to end through deliverAsset", () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
  const graph = (routes: Record<string, () => Response> = {}) => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      for (const [prefix, make] of Object.entries(routes)) if (url.startsWith(prefix)) return make();
      if (url.startsWith("https://evil.example/")) throw new Error("must never be fetched");
      if (url.startsWith("https://upload.wikimedia.org/")) return new Response(JPEG, { status: 200, headers: { "content-type": "image/jpeg" } });
      if (url.startsWith("https://api.openverse.org/")) return new Response(JPEG, { status: 200, headers: { "content-type": "image/jpeg" } });
      calls.push({ url, body: init?.body });
      if (/\/media$/.test(url)) return new Response(JSON.stringify({ id: "media-1" }), { status: 200 });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
    });
    return { calls, fetchImpl };
  };
  const realDeliver = (fetchImpl: typeof fetch) => (asset: DeliverableAsset) =>
    deliverAsset({ phoneNumberId: "111", token: "t", to: "9627", asset, fetchImpl, sleep: async () => undefined });

  it("a Commons picture is fetched from Commons, uploaded and sent as a real WhatsApp IMAGE (not a link)", async () => {
    const { calls, fetchImpl } = graph();
    const { d, sendText } = deps({ items: [commons()], deliver: realDeliver(fetchImpl as never) });
    const out = await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "delivered", kind: "image" });
    expect(calls.map((c) => c.url.split("/").slice(-1)[0])).toEqual(["media", "messages"]);
    expect(JSON.parse(String(calls[1].body))).toMatchObject({ type: "image", to: "9627", image: { id: "media-1" } });
    expect(sendText).toHaveBeenCalledTimes(1);
  });

  it("a resized Commons copy is followed through its redirect, within the named hosts", async () => {
    const { calls, fetchImpl } = graph({
      "https://commons.wikimedia.org/wiki/Special:FilePath/": () => new Response(null, { status: 302, headers: { location: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Red_fox_in_snow.jpg/1600px-Red_fox_in_snow.jpg" } }),
    });
    const { d } = deps({ items: [commons({ sizeBytes: 40 * MB })], deliver: realDeliver(fetchImpl as never) });
    expect(await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d)).toMatchObject({ outcome: "delivered", kind: "image" });
    expect(JSON.parse(String(calls[1].body))).toMatchObject({ type: "image" });
  });

  it("a redirect off the named hosts is refused, and nothing is fetched from there", async () => {
    const { calls, fetchImpl } = graph({
      "https://upload.wikimedia.org/": () => new Response(null, { status: 302, headers: { location: "https://evil.example/a.jpg" } }),
    });
    const { d } = deps({ items: [commons()], deliver: realDeliver(fetchImpl as never) });
    const out = await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "none", reason: "delivery_failed", link: expect.any(Object) });
    expect(calls).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalledWith("https://evil.example/a.jpg", expect.anything());
  });

  it("bytes that are not the image they claim to be are never sent (an HTML page, a WebP)", async () => {
    for (const body of [new TextEncoder().encode("<html>not an image</html>"), new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])]) {
      const { calls, fetchImpl } = graph({ "https://upload.wikimedia.org/": () => new Response(body, { status: 200, headers: { "content-type": "image/jpeg" } }) });
      const { d, sendText } = deps({ items: [commons()], deliver: realDeliver(fetchImpl as never) });
      const out = await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d);
      expect(out).toMatchObject({ outcome: "none", link: { url: "https://commons.wikimedia.org/wiki/File:Red_fox_in_snow.jpg", title: "Red fox in snow" } });
      expect(calls).toEqual([]);
      expect(sendText).not.toHaveBeenCalled();
    }
  });

  it("a picture over Meta's limit that the server streams anyway is refused, not sent", async () => {
    const huge = new Uint8Array(6 * MB);
    huge.set(JPEG);
    const { calls, fetchImpl } = graph({ "https://upload.wikimedia.org/": () => new Response(huge, { status: 200, headers: { "content-type": "image/jpeg" } }) });
    const { d } = deps({ items: [commons({ sizeBytes: 1 * MB })], deliver: realDeliver(fetchImpl as never) });
    expect(await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d)).toMatchObject({ outcome: "none", reason: "delivery_failed" });
    expect(calls).toEqual([]);
  });
});

// ─── Where the webhook uses it ────────────────────────────────────────────

describe("the WhatsApp webhook", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  const gate = webhook.indexOf('requireActiveSubscription(db, { channel: "whatsapp"');
  const block = webhook.slice(webhook.indexOf("// ── A picture that already exists"), webhook.indexOf("// ── Videos, podcasts and audiobooks"));

  it("has the image flow, once, in front of the media flow and behind the subscription gate", () => {
    expect(block.length).toBeGreaterThan(200);
    expect(webhook.split("parseImageRequest(questionText)")).toHaveLength(2);
    expect(webhook.indexOf("parseImageRequest(questionText)")).toBeGreaterThan(gate);
    expect(gate).toBeGreaterThan(0);
  });

  it("is off when the media feature is off, or when a person or the assistant owns the conversation", () => {
    expect(block).toMatch(/aiFocused \|\| humanOwnsThis \|\| !featureOn\("services\.media"\)/);
  });

  it("delivers through deliverAsset, and ends the turn only when it delivered or answered with the link", () => {
    expect(block).toContain("deliverAsset({ phoneNumberId, token, to: incoming.from, asset })");
    expect(block).toMatch(/if \(attached\.outcome === "delivered"\) continue;/);
    expect(block).toContain("deliveryFallbackText(answerLanguage)");
    // No link, nothing delivered: fall through to what handled the message before.
    expect(block).toMatch(/if \(attached\.link\) \{[\s\S]*?continue;\s*\}\s*\}\s*$/);
  });

  it("logs the outcome without a query, a title, an address or a number, and reads no secret", () => {
    const logs = block.split("\n").filter((l) => l.includes('log("external_file"'));
    expect(logs).toHaveLength(1);
    expect(logs[0]).not.toMatch(/query|title|url|incoming\.from/);
    expect(block).not.toMatch(/Deno\.env\.get\("[A-Z_]*(KEY|TOKEN|SECRET)/);
  });

  it("does not touch the image-generation path: the owner's /image command and the request parser stay separate", () => {
    const parser = readFileSync("supabase/functions/_shared/whatsappImageRequest.ts", "utf8");
    expect(parser).toContain('message.startsWith("/")');
    expect(parser).toMatch(/if \(CREATE\.test\(message\)\) return null;/);
    expect(block).not.toMatch(/image-generate|handleOwnerCommand/);
  });
});
