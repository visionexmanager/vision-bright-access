// Books, audiobooks and films from open sources, delivered to WhatsApp as the
// file — and only when that is allowed (a stated licence, a connected source) and
// possible (a type and size Meta takes, from a host we name).
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { makeItem } from "../../supabase/functions/_shared/externalContent/http.ts";
import type { AggregateResult, ExternalContentItem } from "../../supabase/functions/_shared/externalContent/types.ts";
import { deliverAsset, type DeliverableAsset, type DeliveryResult } from "../../supabase/functions/_shared/whatsappAssetDelivery.ts";
import {
  DELIVERY_HOSTS, KIND_SEARCH, attachExternalFile, creditText, declaredSize, directCandidate, fileNameFor, matchesRequest, parseFileWish, pickArchiveFile,
  readArchiveFiles, stripFileWish, type AttachDeps,
} from "../../supabase/functions/_shared/whatsappExternalFiles.ts";

const PD = { name: "Public domain in the USA", url: null };
const CC0 = { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" };

const gutenbergItem = (id = "84", over: Partial<ExternalContentItem> = {}) => makeItem("Project Gutenberg", {
  provider: "gutenberg", providerItemId: id, title: "Frankenstein; Or, The Modern Prometheus", creator: "Mary Shelley", contentType: "book",
  externalUrl: `https://www.gutenberg.org/ebooks/${id}`, license: PD, mimeType: "application/epub+zip", ...over,
});
const archiveItem = (id = "frankenstein_4_2010_librivox", over: Partial<ExternalContentItem> = {}) => makeItem("Internet Archive", {
  provider: "internet_archive", providerItemId: id, title: "Frankenstein", creator: "Mary Shelley", contentType: "audio",
  externalUrl: `https://archive.org/details/${id}`, license: { name: "Public Domain Mark", url: null }, ...over,
});
const openstaxItem = (over: Partial<ExternalContentItem> = {}) => makeItem("OpenStax", {
  provider: "openstax", providerItemId: "biology-2e", title: "Biology 2e", contentType: "book", externalUrl: "https://openstax.org/details/books/biology-2e",
  downloadUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/Biology2e-WEB.pdf", mimeType: "application/pdf", license: { name: "CC BY 4.0", url: null }, ...over,
});

const MB = 1024 * 1024;
const files = [
  { name: "book_00_intro_64kb.mp3", format: "64Kbps MP3", size: 3 * MB },
  { name: "book_01_ch1_64kb.mp3", format: "64Kbps MP3", size: 9 * MB },
  { name: "book_01_ch1.mp3", format: "VBR MP3", size: 18 * MB },
  { name: "book_02_ch2_64kb.mp3", format: "64Kbps MP3", size: 12 * MB },
  { name: "book.m4b", format: "Audiobook", size: 280 * MB },
  { name: "film_512kb.mp4", format: "MPEG4", size: 14 * MB },
  { name: "film.mp4", format: "h.264", size: 120 * MB },
  { name: "scan.pdf", format: "Text PDF", size: 20 * MB },
  { name: "huge.pdf", format: "Text PDF", size: 150 * MB },
];

// ─── Did the sender ask for the file? ─────────────────────────────────────

describe("parseFileWish", () => {
  it("recognises the file words and formats in the twenty languages", () => {
    for (const text of [
      "frankenstein pdf", "send me the file of pride and prejudice", "the book as an attachment please", "download the audiobook",
      "كتاب فرانكنشتاين ملف", "أريد الكتاب مرفق", "फ्रेंकस्टीन की फ़ाइल", "frankenstein datei", "quiero el archivo del libro", "le livre en fichier",
      "arquivo do livro", "файл книги", "书的文件", "本のファイル", "책 파일", "dosya olarak kitap", "berkas buku", "boek als bestand", "książka jako plik", "tệp sách",
      "mp3 of the audiobook", "the film as mp4",
    ]) expect(parseFileWish(text), text).toBe(true);
  });

  it("does not fire on ordinary requests or on words that merely contain a file word", () => {
    for (const text of ["a book about dogs", "find me a podcast about space", "my profile", "profiles of famous writers", "the filesystem", "أريد كتابا عن الفضاء", "", null, undefined]) {
      expect(parseFileWish(text as string), String(text)).toBe(false);
    }
  });

  it("strips the file words from the query so the search is for the work", () => {
    expect(stripFileWish("frankenstein pdf")).toBe("frankenstein");
    expect(stripFileWish("send me the file of pride and prejudice")).toBe("send me the of pride and prejudice");
    expect(stripFileWish("فرانكنشتاين ملف")).toBe("فرانكنشتاين");
    expect(stripFileWish("pdf mp3")).toBe("");
  });
});

// ─── Choosing the file ────────────────────────────────────────────────────

describe("choosing a file from an Internet Archive item", () => {
  const all = readArchiveFiles({ files });

  it("audiobook: the first chapter as a small MP3 that fits Meta's 16 MB, not the preface, the big encoding or the whole-book file", () => {
    expect(pickArchiveFile(all, "audiobook")).toEqual({ name: "book_01_ch1_64kb.mp3", mime: "audio/mpeg", size: 9 * MB });
  });

  it("audiobook: falls back to any MP3 that fits, and to nothing when none does", () => {
    expect(pickArchiveFile(readArchiveFiles({ files: [{ name: "a_00_64kb.mp3", format: "64Kbps MP3", size: 5 * MB }] }), "audiobook")?.name).toBe("a_00_64kb.mp3");
    expect(pickArchiveFile(readArchiveFiles({ files: [{ name: "a.mp3", format: "VBR MP3", size: 30 * MB }] }), "audiobook")).toBeNull();
    expect(pickArchiveFile(readArchiveFiles({ files: [{ name: "a.m4b", format: "Audiobook", size: MB }] }), "audiobook")).toBeNull();
  });

  it("video: an MP4 within 16 MB only", () => {
    expect(pickArchiveFile(all, "video")).toEqual({ name: "film_512kb.mp4", mime: "video/mp4", size: 14 * MB });
    expect(pickArchiveFile(readArchiveFiles({ files: [{ name: "film.mp4", format: "h.264", size: 120 * MB }] }), "video")).toBeNull();
    expect(pickArchiveFile(readArchiveFiles({ files: [{ name: "film.mkv", format: "Matroska", size: MB }] }), "video")).toBeNull();
  });

  it("book: the text PDF within Meta's 100 MB for documents", () => {
    expect(pickArchiveFile(all, "book")).toEqual({ name: "scan.pdf", mime: "application/pdf", size: 20 * MB });
    expect(pickArchiveFile(readArchiveFiles({ files: [{ name: "huge.pdf", format: "Text PDF", size: 150 * MB }] }), "book")).toBeNull();
  });

  it("reads the metadata field by field: no path, no traversal, no missing size", () => {
    const read = readArchiveFiles({ files: [
      { name: "../../etc/passwd", format: "Text PDF", size: 1000 },
      { name: "sub/dir.pdf", format: "Text PDF", size: 1000 },
      { name: "..\\x.pdf", format: "Text PDF", size: 1000 },
      { name: ".hidden.pdf", format: "Text PDF", size: 1000 },
      { name: "nosize.pdf", format: "Text PDF" },
      { name: "zero.pdf", format: "Text PDF", size: 0 },
      { name: 5, format: "Text PDF", size: 10 },
      { name: "ok.pdf", format: "Text PDF", size: "1000" },
    ] });
    expect(read).toEqual([{ name: "ok.pdf", format: "Text PDF", size: 1000 }]);
    expect(readArchiveFiles(null)).toEqual([]);
    expect(readArchiveFiles({ files: "nope" })).toEqual([]);
    expect(readArchiveFiles({})).toEqual([]);
  });
});

describe("directCandidate: only a licensed item on a named host, and only a type Meta takes", () => {
  it("Gutenberg is delivered as its plain-text edition, never the EPUB", () => {
    expect(directCandidate(gutenbergItem("84"), "book")).toMatchObject({
      url: "https://www.gutenberg.org/cache/epub/84/pg84.txt", mime: "text/plain", hosts: ["gutenberg.org"],
    });
    expect(directCandidate(gutenbergItem("84"), "audiobook")).toBeNull();
    expect(directCandidate(gutenbergItem("../x"), "book")).toBeNull(); // an id is digits
    expect(directCandidate(gutenbergItem("84", { license: null }), "book")).toBeNull();
  });

  it("OpenStax is its PDF; a non-PDF or an unlicensed item is not", () => {
    expect(directCandidate(openstaxItem(), "book")).toMatchObject({ mime: "application/pdf", hosts: ["openstax.org"] });
    expect(directCandidate(openstaxItem({ downloadUrl: "https://assets.openstax.org/x.zip" }), "book")).toBeNull();
    expect(directCandidate(openstaxItem({ license: null }), "book")).toBeNull();
  });

  it("nothing else qualifies: EPUB catalogues, Europe PMC, podcasts, museums, Commons", () => {
    for (const provider of ["standard_ebooks", "europe_pmc", "apple_podcasts", "met_museum", "wikimedia_commons", "open_library", "doab", "crossref", "open_feeds"]) {
      const item = makeItem(provider, { provider, providerItemId: "1", title: "x", contentType: "book", externalUrl: "https://example.org/x", downloadUrl: "https://example.org/x.pdf", license: CC0 });
      expect(directCandidate(item, "book"), provider).toBeNull();
    }
    // The two image hosts were added on purpose (whatsapp-image-request.test.ts); a book from either still never qualifies.
    expect(Object.keys(DELIVERY_HOSTS).sort()).toEqual(["artic", "cleveland_museum", "flickr", "gutenberg", "internet_archive", "met_museum", "openalex", "openstax", "openverse", "rijksmuseum", "wikimedia_commons"]);
    expect(KIND_SEARCH.audiobook.providers).toEqual(["internet_archive"]);
  });
});

describe("what travels with a file", () => {
  it("is names and codes: title, maker, source, licence, address — no sentence to translate", () => {
    expect(creditText(gutenbergItem("84"))).toBe("Frankenstein; Or, The Modern Prometheus — Mary Shelley\nProject Gutenberg · Public domain in the USA\nhttps://www.gutenberg.org/ebooks/84");
    expect(creditText(archiveItem("x", { creator: null, license: null }))).toBe("Frankenstein\nInternet Archive\nhttps://archive.org/details/x");
  });

  it("names the file from the title, safely, with the right extension", () => {
    expect(fileNameFor("Frankenstein; Or, The Modern Prometheus", "text/plain")).toBe("Frankenstein-Or-The-Modern-Prometheus.txt");
    expect(fileNameFor("../../etc/passwd", "application/pdf")).toBe("etc-passwd.pdf");
    expect(fileNameFor("كتاب", "audio/mpeg")).toBe("كتاب.mp3");
    expect(fileNameFor("!!!", "video/mp4")).toBe("visionex.mp4");
    expect(fileNameFor("x".repeat(200), "application/pdf").length).toBeLessThanOrEqual(64);
  });
});

describe("matchesRequest: the work asked for, not the top of a ranking", () => {
  const titled = (title: string, creator: string | null = null) => gutenbergItem("1", { title, creator });
  it("needs every word of a short query and the first two of a longer one", () => {
    expect(matchesRequest(titled("Pride and Prejudice", "Jane Austen"), "pride prejudice")).toBe(true);
    expect(matchesRequest(titled("Pride and Prejudice", "Jane Austen"), "pride and prejudice by jane austen")).toBe(true);
    expect(matchesRequest(titled("Moby Dick"), "moon landing")).toBe(false);
    expect(matchesRequest(titled("Frankenstein"), "frankenstein")).toBe(true);
    expect(matchesRequest(titled("Biology 2e"), "harry potter and the philosophers stone")).toBe(false);
  });
  it("reads the maker's name too, and works in any script", () => {
    expect(matchesRequest(titled("Emma", "Jane Austen"), "austen emma")).toBe(true);
    expect(matchesRequest(titled("فرانكنشتاين", "ماري شيلي"), "فرانكنشتاين")).toBe(true);
    expect(matchesRequest(titled("فرانكنشتاين"), "الجفاف")).toBe(false);
    expect(matchesRequest(titled("科学"), "科学")).toBe(true);
  });
  it("an empty or one-letter query matches nothing", () => {
    expect(matchesRequest(titled("Anything"), "")).toBe(false);
    expect(matchesRequest(titled("A b c"), "a")).toBe(false);
  });
});

describe("declaredSize", () => {
  const head = (headers: Record<string, string>, status = 200) => vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status, headers }));
  it("reads the size a server states, asking only an allowed host", async () => {
    const fetchImpl = head({ "content-length": "1234" });
    expect(await declaredSize("https://assets.openstax.org/a.pdf", ["openstax.org"], fetchImpl as never)).toBe(1234);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "HEAD", redirect: "manual" });
    expect(await declaredSize("https://evil.example/a.pdf", ["openstax.org"], fetchImpl as never)).toBeNull();
    expect(await declaredSize("http://assets.openstax.org/a.pdf", ["openstax.org"], fetchImpl as never)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("says nothing when the server says nothing, redirects, fails or throws", async () => {
    expect(await declaredSize("https://assets.openstax.org/a.pdf", ["openstax.org"], head({}) as never)).toBeNull();
    expect(await declaredSize("https://assets.openstax.org/a.pdf", ["openstax.org"], head({ location: "https://x.example/" }, 302) as never)).toBeNull();
    expect(await declaredSize("https://assets.openstax.org/a.pdf", ["openstax.org"], head({ "content-length": "5" }, 500) as never)).toBeNull();
    expect(await declaredSize("https://assets.openstax.org/a.pdf", ["openstax.org"], (async () => { throw new Error("down"); }) as never)).toBeNull();
  });
});

// ─── The flow ─────────────────────────────────────────────────────────────

const delivered = (kind: "document" | "audio" | "video" = "document"): DeliveryResult => ({ outcome: `delivered_${kind}`, kind, bytes: 10, uploadTries: 1, sendTries: 1, ms: 5 });
const failed = (): DeliveryResult => ({ outcome: "failed", reason: "asset_download_failed", ms: 5 });
const found = (...items: ExternalContentItem[]): AggregateResult => ({ items, providers: [], duplicates: 0 });

function deps(over: Partial<AttachDeps> & { items?: ExternalContentItem[]; meta?: unknown; deliver?: (a: DeliverableAsset) => Promise<DeliveryResult> } = {}) {
  const deliverFn = vi.fn<(asset: DeliverableAsset) => Promise<DeliveryResult>>(over.deliver ?? (async () => delivered()));
  const sendText = vi.fn(async () => undefined);
  const fetchFn = vi.fn(async (url: string, _init?: RequestInit) => {
    if (String(url).startsWith("https://archive.org/metadata/")) return new Response(JSON.stringify(over.meta ?? { files }), { status: 200 });
    throw new Error(`unexpected fetch ${url}`);
  });
  const d: AttachDeps = {
    fetch: fetchFn as never, env: () => undefined, deliver: deliverFn, sendText,
    search: over.search ?? (async () => found(...(over.items ?? []))),
  };
  return { d, deliverFn, sendText, fetchFn };
}

describe("attachExternalFile", () => {
  it("delivers a Gutenberg book as text/plain from Gutenberg's host, and sends nothing after it (a public-domain book needs no credit)", async () => {
    const { d, deliverFn, sendText } = deps({ items: [gutenbergItem("84")] });
    const out = await attachExternalFile({ kind: "book", query: "frankenstein pdf", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "delivered", provider: "gutenberg", tried: 1 });
    expect(deliverFn).toHaveBeenCalledTimes(1);
    expect(deliverFn.mock.calls[0][0]).toMatchObject({
      url: "https://www.gutenberg.org/cache/epub/84/pg84.txt", mimeType: "text/plain", allowedHosts: ["gutenberg.org"], fileName: "Frankenstein-Or-The-Modern-Prometheus.txt",
    });
    // No fallback link inside the delivery: a failure must fall through to the list, not send a second message.
    expect(deliverFn.mock.calls[0][0]).not.toHaveProperty("fallbackUrl");
    expect(sendText).not.toHaveBeenCalled();
  });

  it("delivers the first chapter of a licensed audiobook from the Archive, resolved through its metadata API", async () => {
    const { d, deliverFn, fetchFn } = deps({ items: [archiveItem()], deliver: async () => delivered("audio") });
    const out = await attachExternalFile({ kind: "audiobook", query: "frankenstein", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "delivered", provider: "internet_archive", kind: "audio" });
    expect(fetchFn).toHaveBeenCalledWith("https://archive.org/metadata/frankenstein_4_2010_librivox", expect.anything());
    expect(deliverFn.mock.calls[0][0]).toMatchObject({
      url: "https://archive.org/download/frankenstein_4_2010_librivox/book_01_ch1_64kb.mp3", mimeType: "audio/mpeg", allowedHosts: ["archive.org"],
    });
  });

  it("asks only the sources that can deliver, for the right categories", async () => {
    const search = vi.fn(async () => found());
    await attachExternalFile({ kind: "audiobook", query: "frankenstein", language: "ar" }, deps({ search }).d);
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: "frankenstein", providers: ["internet_archive"], categories: ["audio"], language: "ar" }));
    await attachExternalFile({ kind: "book", query: "biology", language: "en" }, deps({ search }).d);
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ providers: ["gutenberg", "openstax", "internet_archive"] }));
  });

  it("tries the next candidate when the first cannot be delivered, and stops at the first that can", async () => {
    let n = 0;
    const { d, deliverFn, sendText } = deps({ items: [gutenbergItem("1"), gutenbergItem("2"), gutenbergItem("3")], deliver: async () => (++n === 2 ? delivered() : failed()) });
    const out = await attachExternalFile({ kind: "book", query: "frankenstein", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "delivered", tried: 2 });
    expect(deliverFn).toHaveBeenCalledTimes(2);
    expect(sendText).not.toHaveBeenCalled();
  });

  it("gives up after three attempts, sends nothing, and says why — so the caller's list of links follows", async () => {
    const { d, deliverFn, sendText } = deps({ items: [1, 2, 3, 4, 5].map((i) => gutenbergItem(String(i))), deliver: async () => failed() });
    const out = await attachExternalFile({ kind: "book", query: "frankenstein", language: "en" }, d);
    expect(out).toEqual({ outcome: "none", reason: "delivery_failed", tried: 3, detail: "deliver_asset_download_failed" });
    expect(deliverFn).toHaveBeenCalledTimes(3);
    expect(sendText).not.toHaveBeenCalled();
  });

  it("never delivers an unlicensed item, an EPUB-only catalogue, Europe PMC or a podcast", async () => {
    const { d, deliverFn } = deps({ items: [
      gutenbergItem("84", { license: null }),
      makeItem("Standard Ebooks", { provider: "standard_ebooks", providerItemId: "a/b", title: "x", contentType: "book", externalUrl: "https://standardebooks.org/ebooks/a/b", downloadUrl: "https://standardebooks.org/x.epub", license: CC0 }),
      makeItem("Europe PMC", { provider: "europe_pmc", providerItemId: "MED_1", title: "x", contentType: "document", externalUrl: "https://europepmc.org/article/MED/1", downloadUrl: "https://europepmc.org/articles/PMC1?pdf=render", license: { name: "CC BY", url: null } }),
      archiveItem("some_item", { license: null }),
    ] });
    const out = await attachExternalFile({ kind: "book", query: "climate", language: "en" }, d);
    expect(out).toEqual({ outcome: "none", reason: "no_candidate", tried: 0 });
    expect(deliverFn).not.toHaveBeenCalled();
  });

  it("does not send a book that is not the one asked for", async () => {
    const { d, deliverFn } = deps({ items: [gutenbergItem("84"), openstaxItem()] });
    expect(await attachExternalFile({ kind: "book", query: "harry potter philosophers stone", language: "en" }, d)).toEqual({ outcome: "none", reason: "no_candidate", tried: 0 });
    expect(deliverFn).not.toHaveBeenCalled();
  });

  it("asks the server for the size of a file nobody stated, and skips one over Meta's limit without downloading it", async () => {
    const { d, deliverFn, fetchFn } = deps({ items: [openstaxItem()] });
    fetchFn.mockImplementation((async (url: string, init?: RequestInit) =>
      init?.method === "HEAD" ? new Response(null, { status: 200, headers: { "content-length": String(300 * MB) } }) : new Response("{}", { status: 200 })) as never);
    expect(await attachExternalFile({ kind: "book", query: "biology", language: "en" }, d)).toMatchObject({ outcome: "none", reason: "no_candidate" });
    expect(deliverFn).not.toHaveBeenCalled();
    expect(fetchFn.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "HEAD")).toBe(true);
  });

  it("skips a file known to be over Meta's limit without downloading it", async () => {
    const { d, deliverFn } = deps({ items: [openstaxItem({ sizeBytes: 150 * MB })] });
    expect(await attachExternalFile({ kind: "book", query: "biology", language: "en" }, d)).toMatchObject({ outcome: "none", reason: "no_candidate" });
    expect(deliverFn).not.toHaveBeenCalled();
  });

  it("does not put a hostile Archive identifier or file name into a URL", async () => {
    const { d, deliverFn, fetchFn } = deps({ items: [archiveItem("../../evil")] });
    expect(await attachExternalFile({ kind: "audiobook", query: "frankenstein", language: "en" }, d)).toMatchObject({ outcome: "none", reason: "no_candidate" });
    expect(fetchFn).not.toHaveBeenCalled();
    const traversal = deps({ items: [archiveItem()], meta: { files: [{ name: "../../x.mp3", format: "64Kbps MP3", size: MB }] } });
    expect(await attachExternalFile({ kind: "audiobook", query: "frankenstein", language: "en" }, traversal.d)).toMatchObject({ outcome: "none" });
    expect(traversal.deliverFn).not.toHaveBeenCalled();
    void deliverFn;
  });

  it("an Archive item whose metadata cannot be read is skipped, not fatal", async () => {
    const { d } = deps({ items: [archiveItem()] });
    (d.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => new Response("{}", { status: 503 }));
    expect(await attachExternalFile({ kind: "audiobook", query: "frankenstein", language: "en" }, d)).toMatchObject({ outcome: "none", reason: "no_candidate" });
  });

  it("reports a failed search, an empty query, and nothing to deliver", async () => {
    expect(await attachExternalFile({ kind: "book", query: "frankenstein", language: "en" }, deps({ search: async () => { throw new Error("down"); } }).d)).toEqual({ outcome: "none", reason: "search_failed", tried: 0 });
    expect(await attachExternalFile({ kind: "book", query: "pdf", language: "en" }, deps().d)).toEqual({ outcome: "none", reason: "no_query", tried: 0 });
    expect(await attachExternalFile({ kind: "book", query: "frankenstein", language: "en" }, deps({ items: [] }).d)).toMatchObject({ outcome: "none", reason: "no_candidate" });
  });

  it("a failed credit message does not undo a delivery", async () => {
    const { d, sendText } = deps({ items: [gutenbergItem("84")] });
    sendText.mockRejectedValue(new Error("send failed"));
    expect(await attachExternalFile({ kind: "book", query: "frankenstein", language: "en" }, d)).toMatchObject({ outcome: "delivered" });
  });
});

// ─── Through the real delivery code, against a stand-in for Meta ──────────

describe("end to end through deliverAsset", () => {
  const graph = () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://www.gutenberg.org/cache/epub/84/pg84.txt")) {
        return new Response(new TextEncoder().encode("Letter 1\nTo Mrs. Saville, England\n"), { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      if (url.startsWith("https://archive.org/download/")) {
        return new Response(null, { status: 302, headers: { location: "https://dn721803.ca.archive.org/0/items/x/y.mp3" } });
      }
      if (url.startsWith("https://dn721803.ca.archive.org/")) {
        return new Response(new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 1, 2, 3]), { status: 200, headers: { "content-type": "audio/mpeg" } });
      }
      if (url.startsWith("https://evil.example/")) throw new Error("must never be fetched");
      calls.push({ url, body: init?.body });
      if (/\/media$/.test(url)) return new Response(JSON.stringify({ id: "media-1" }), { status: 200 });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
    });
    return { calls, fetchImpl };
  };
  const realDeliver = (fetchImpl: typeof fetch) => (asset: DeliverableAsset) =>
    deliverAsset({ phoneNumberId: "111", token: "t", to: "9627", asset, fetchImpl, sleep: async () => undefined });

  it("a Gutenberg text is fetched from Gutenberg, uploaded as text/plain and sent as a document", async () => {
    const { calls, fetchImpl } = graph();
    const { d, sendText } = deps({ items: [gutenbergItem("84")], deliver: realDeliver(fetchImpl as never) });
    const out = await attachExternalFile({ kind: "book", query: "frankenstein pdf", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "delivered", kind: "document" });
    expect(calls.map((c) => c.url.split("/").slice(-1)[0])).toEqual(["media", "messages"]);
    const message = JSON.parse(String(calls[1].body));
    expect(message).toMatchObject({ type: "document", to: "9627", document: { id: "media-1" } });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("an Archive MP3 is followed through its redirect to an archive.org subdomain and sent as audio", async () => {
    const { calls, fetchImpl } = graph();
    const { d } = deps({ items: [archiveItem()], deliver: realDeliver(fetchImpl as never) });
    const out = await attachExternalFile({ kind: "audiobook", query: "frankenstein", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "delivered", kind: "audio" });
    expect(JSON.parse(String(calls.at(-1)!.body))).toMatchObject({ type: "audio" });
  });

  it("a redirect off the allowed host is refused and nothing is uploaded", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://www.gutenberg.org/")) return new Response(null, { status: 302, headers: { location: "https://evil.example/steal" } });
      calls.push(url);
      return new Response("{}", { status: 200 });
    });
    const { d, sendText } = deps({ items: [gutenbergItem("84")], deliver: realDeliver(fetchImpl as never) });
    expect(await attachExternalFile({ kind: "book", query: "frankenstein", language: "en" }, d)).toMatchObject({ outcome: "none", reason: "delivery_failed" });
    expect(calls).toEqual([]);
    expect(fetchImpl.mock.calls.map((c) => String(c[0])).some((u) => u.startsWith("https://evil.example"))).toBe(false);
    expect(sendText).not.toHaveBeenCalled();
  });

  it("an HTML error page served as the file is refused, not sent as a document", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://www.gutenberg.org/")) return new Response("<html>bot check</html>", { status: 200, headers: { "content-type": "text/html" } });
      calls.push(url);
      return new Response("{}", { status: 200 });
    });
    const { d } = deps({ items: [gutenbergItem("84")], deliver: realDeliver(fetchImpl as never) });
    expect(await attachExternalFile({ kind: "book", query: "frankenstein", language: "en" }, d)).toMatchObject({ outcome: "none" });
    expect(calls).toEqual([]);
  });
});

// ─── Where the webhook uses it ────────────────────────────────────────────

describe("the WhatsApp webhook", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  const gate = webhook.indexOf('requireActiveSubscription(db, { channel: "whatsapp"');

  it("attaches only after the subscription gate, so a free-week sender never reaches it", () => {
    const first = webhook.indexOf("attachExternalFile(");
    expect(first).toBeGreaterThan(gate);
    expect(gate).toBeGreaterThan(0);
  });

  it("tries the file before the list of links, and carries on to the list unless it delivered", () => {
    const media = webhook.slice(webhook.indexOf("const request = { kind: mediaRequest.kind"), webhook.indexOf("const found = await searchMedia(request);"));
    expect(media).toContain('request.kind !== "podcast"');
    // Always attempted for a film or an audiobook; the list of links is the fallback.
    expect(media).toContain("attachExternalFile(");
    expect(media).toMatch(/if \(attached\.outcome === "delivered"\) continue;/);
    const book = webhook.slice(webhook.indexOf('{ kind: "book", query, language: answerLanguage }'), webhook.indexOf("const [outside, archive]"));
    expect(book).toMatch(/if \(attached\.outcome === "delivered"\) continue;/);
  });

  it("does not send an external copy of a book the Visionex library holds", () => {
    expect(webhook).toMatch(/library\.length === 0 && token && phoneNumberId && !wantsLink\(questionText\) && \(parseFileWish\(questionText\) \|\| wantsSend\(questionText\)\)/);
  });

  it("logs the outcome without a title, a query, an address or a number", () => {
    const logs = webhook.split("\n").filter((l) => l.includes('log("external_file"'));
    expect(logs).toHaveLength(5); // book, media, image, recording/paper/document, and the link-only answer
    for (const line of logs) expect(line).not.toMatch(/query|title|url|incoming\.from/);
  });
});
