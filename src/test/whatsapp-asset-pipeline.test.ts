// One pipeline from an external source to a real WhatsApp attachment: which
// messages ask for a recording, a paper or a document; which assets may be passed
// on (and what happens to the ones that may not); conversion of what Meta will not
// take; and the security rules every fetch keeps.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { makeItem } from "../../supabase/functions/_shared/externalContent/http.ts";
import { openAlex, openAlexLicenseName } from "../../supabase/functions/_shared/externalContent/providers/scholarly.ts";
import type { AggregateResult, ExternalContentItem } from "../../supabase/functions/_shared/externalContent/types.ts";
import { searchOpenAlex } from "../../supabase/functions/_shared/openResearchSources.ts";
import { deliverAsset, isFetchableAssetUrl, type DeliverableAsset, type DeliveryResult } from "../../supabase/functions/_shared/whatsappAssetDelivery.ts";
import { parseAssetRequest, parseImageRequest, wantsSend } from "../../supabase/functions/_shared/whatsappImageRequest.ts";
import { DELIVERY_HOSTS, KIND_SEARCH, attachExternalFile, directCandidate, licenceAllows, type AttachDeps } from "../../supabase/functions/_shared/whatsappExternalFiles.ts";

const MB = 1024 * 1024;
const CC_BY = { name: "CC BY 4.0", url: null };
const CC0 = { name: "CC0", url: null };
const CC_BY_NC = { name: "CC BY-NC 4.0", url: null };
const CC_BY_ND = { name: "CC BY-ND 4.0", url: null };

const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 1, 2, 3]);

const commonsFile = (name: string) => `https://upload.wikimedia.org/wikipedia/commons/a/ab/${name}`;
const commons = (over: Partial<ExternalContentItem> = {}) => makeItem("Wikimedia Commons", {
  provider: "wikimedia_commons", providerItemId: "1", title: "Red fox", contentType: "image", mimeType: "image/jpeg", sizeBytes: 2 * MB, license: CC_BY,
  description: "A red fox", externalUrl: "https://commons.wikimedia.org/wiki/File:Red_fox.jpg", downloadUrl: commonsFile("Red_fox.jpg"), ...over,
});
const paper = (over: Partial<ExternalContentItem> = {}) => makeItem("OpenAlex", {
  provider: "openalex", providerItemId: "10.1000/abc", title: "Accessible education for blind learners", contentType: "document", mimeType: "application/pdf",
  creator: "A. Author", externalUrl: "https://doi.org/10.1000/abc", downloadUrl: "https://zenodo.org/records/1/files/paper.pdf", license: { name: "CC BY", url: null }, ...over,
});

// ─── What counts as a request ─────────────────────────────────────────────

describe("parseAssetRequest: find and send a recording, a paper or a document", () => {
  it.each([
    ["find research papers about accessible education and send them to me", "document", "accessible education"],
    ["send me the paper on machine learning", "document", "machine learning"],
    ["find an open-access study about dyslexia", "document", "dyslexia"],
    ["find me a PDF about artificial intelligence", "document", "artificial intelligence"],
    ["send me a document about photosynthesis", "document", "photosynthesis"],
    ["find an audio recording of a thunderstorm", "audio", "thunderstorm"],
    ["send me a recording of ocean waves", "audio", "ocean waves"],
  ])("English: %s", (text, kind, query) => expect(parseAssetRequest(text)).toEqual({ kind, query }));

  it.each([
    ["ar", "ابعتلي ملف PDF عن الذكاء الاصطناعي", "document", "الذكاء الاصطناعي"],
    ["ar", "ابحث عن أبحاث حول التعليم الشامل وأرسلها لي", "document", "التعليم الشامل"],
    ["ar", "أرسل لي تسجيل صوتي عن المطر", "audio", "المطر"],
    ["es", "busca artículos sobre accesibilidad y envíamelos".replace(" y envíamelos", ""), "document", "accesibilidad"],
    ["fr", "envoie-moi un article sur le climat", "document", "climat"],
    ["de", "schick mir eine Studie über Bienen", "document", "Bienen"],
    ["ru", "найди научную работу про нейросети и пришли", "document", "нейросети"],
    ["tr", "bana iklim hakkında bir makale gönder", "document", "iklim"],
    ["zh", "给我发一篇关于气候的论文", "document", "气候"],
    ["ja", "気候の論文を送って", "document", "気候"],
    ["ko", "기후 논문 보내줘", "document", "기후"],
    ["id", "kirim makalah tentang iklim", "document", "iklim"],
    ["pt", "envia um artigo sobre o clima", "document", "clima"],
    ["it", "mandami un articolo sul clima", "document", "clima"],
    ["nl", "stuur me een artikel over klimaat", "document", "klimaat"],
    ["pl", "wyślij artykuł o klimacie", "document", "klimacie"],
    ["vi", "gửi bài báo về khí hậu", "document", "khí hậu"],
    ["hi", "मुझे जलवायु पर शोध भेजो", "document", "जलवायु"],
    ["fa", "یک مقاله درباره اقلیم بفرست".replace("درباره ", ""), "document", "اقلیم"],
    ["ur", "مجھے موسم کا مقالہ بھیجو".replace("کا ", ""), "document", "موسم"],
    ["bn", "আমাকে জলবায়ু গবেষণা পাঠাও", "document", "জলবায়ু"],
    ["es", "envíame una grabación de la lluvia", "audio", "lluvia"],
    ["de", "schick mir eine Aufnahme von Regen", "audio", "Regen"],
  ])("%s: %s", (_language, text, kind, query) => {
    const parsed = parseAssetRequest(text);
    expect(parsed, text).not.toBeNull();
    expect(parsed!.kind).toBe(kind);
    expect(parsed!.query).toContain(query);
  });

  it("leaves alone a request to summarise, explain, translate or analyse a document", () => {
    for (const text of [
      "summarize this paper for me", "find the paper and summarise it", "explain this research paper", "translate this document to Arabic", "send me a summary of the paper",
      "لخص لي هذا البحث", "ترجم لي هذا الملف", "explica este artículo", "résume cet article", "übersetze dieses Dokument", "переведи этот документ",
    ]) expect(parseAssetRequest(text), text).toBeNull();
  });

  it("leaves alone a request to make something, and anything for an audiobook, a podcast or a picture (their own flows)", () => {
    for (const text of [
      "create a pdf about cats", "generate a document about cats", "write me a paper about cats", "make a recording of my voice and send it",
      "send me the audiobook of Frankenstein", "find a podcast about history", "send me a photo of a fox", "find me a picture of a document",
      "/image send me a recording",
    ]) expect(parseAssetRequest(text), text).toBeNull();
  });

  it("needs a retrieval verb and a subject", () => {
    expect(parseAssetRequest("a paper about cats")).toBeNull();
    expect(parseAssetRequest("send me a pdf")).toBeNull();
    expect(parseAssetRequest("")).toBeNull();
    expect(parseAssetRequest(null)).toBeNull();
  });

  it("and the picture parser is untouched by it", () => {
    expect(parseImageRequest("send me an image of a red fox")).toEqual({ query: "red fox" });
    expect(parseImageRequest("create an image of a red fox")).toBeNull();
    expect(parseAssetRequest("send me an image of a red fox")).toBeNull();
  });
});

describe("wantsSend: 'send me ...' means the file itself", () => {
  it.each([
    "send me the video of the eruption", "Send me the book", "ابعتلي الكتاب", "أرسل لي الفيديو", "envíame el libro", "envoie-moi la vidéo", "schick mir das Buch",
    "пришли книгу", "gönder", "发给我这本书", "送って", "보내줘",
  ])("yes: %s", (text) => expect(wantsSend(text)).toBe(true));
  it.each(["find a video about cooking", "what is the capital of France", "generate and send me an image of a cat", "/image send me a cat", "", null])("no: %s", (text) => expect(wantsSend(text as string)).toBe(false));
});

// ─── Which assets may be passed on ────────────────────────────────────────

describe("licenceAllows", () => {
  it("passes on Creative Commons (without NonCommercial), public domain and CC0; refuses the rest", () => {
    for (const name of ["CC BY 4.0", "CC BY-SA 3.0", "CC0", "Public Domain", "Public domain in the USA", "United States Government Work", "No known copyright restrictions"]) {
      expect(licenceAllows({ name }, false), name).toBe(true);
    }
    for (const name of ["CC BY-NC 4.0", "CC BY-NC-SA 2.0", "CC BY-NC-ND 2.0", "All rights reserved", "Pixabay Content License", "Unsplash License", "", "GPL"]) {
      expect(licenceAllows({ name }, false), name).toBe(false);
    }
    expect(licenceAllows(null, false)).toBe(false);
    expect(licenceAllows(undefined, false)).toBe(false);
  });
  it("refuses a no-derivatives licence for a resized or converted copy, but not for the file as it is", () => {
    expect(licenceAllows(CC_BY_ND, false)).toBe(true);
    expect(licenceAllows(CC_BY_ND, true)).toBe(false);
    expect(licenceAllows({ name: "CC BY-NC-ND 4.0" }, false)).toBe(false);
  });
});

describe("images from the museums and Flickr", () => {
  const met = (over: Partial<ExternalContentItem> = {}) => makeItem("The Metropolitan Museum of Art", {
    provider: "met_museum", providerItemId: "436535", title: "Wheat Field", contentType: "image", license: CC0, sizeBytes: null,
    externalUrl: "https://www.metmuseum.org/art/collection/search/436535", downloadUrl: "https://images.metmuseum.org/CRDImages/ep/original/DT1567.jpg", ...over,
  });
  const artic = (over: Partial<ExternalContentItem> = {}) => makeItem("Art Institute of Chicago", {
    provider: "artic", providerItemId: "27992", title: "A Sunday on La Grande Jatte", contentType: "image", license: CC0, mimeType: "image/jpeg",
    externalUrl: "https://www.artic.edu/artworks/27992", downloadUrl: "https://www.artic.edu/iiif/2/1adf2696-8489-499b-cad2-821d7fde4b33/full/843,/0/default.jpg", ...over,
  });
  const flickr = (over: Partial<ExternalContentItem> = {}) => makeItem("Flickr", {
    provider: "flickr", providerItemId: "1", title: "Red fox", contentType: "image", license: { name: "CC BY 2.0", url: null },
    externalUrl: "https://www.flickr.com/photos/x/1", downloadUrl: "https://live.staticflickr.com/65535/123_abc_m.jpg", ...over,
  });

  it("sends a CC0 museum image from the museum's own server, and resizes it when it is over Meta's limit", () => {
    expect(directCandidate(met(), "image")).toMatchObject({ url: "https://images.metmuseum.org/CRDImages/ep/original/DT1567.jpg", mime: "image/jpeg", hosts: ["images.metmuseum.org"], convert: { to: "jpg" } });
    expect(directCandidate(artic(), "image")).toMatchObject({ hosts: ["www.artic.edu"] });
    const cleveland = makeItem("Cleveland", { provider: "cleveland_museum", providerItemId: "1", title: "Vase", contentType: "image", license: CC0, externalUrl: "https://www.clevelandart.org/art/1", downloadUrl: "https://openaccess-cdn.clevelandart.org/1/1_print.jpg" });
    expect(directCandidate(cleveland, "image")).toMatchObject({ hosts: ["openaccess-cdn.clevelandart.org"] });
    const rijks = makeItem("Rijks", { provider: "rijksmuseum", providerItemId: "https://id.rijksmuseum.nl/1", title: "Night Watch", contentType: "image", license: CC0, externalUrl: "https://www.rijksmuseum.nl/en/collection/1", downloadUrl: "https://iiif.micr.io/AbCdE/full/max/0/default.jpg" });
    expect(directCandidate(rijks, "image")).toMatchObject({ hosts: ["iiif.micr.io"] });
  });

  it("refuses a museum address of another shape, another host, or no licence", () => {
    expect(directCandidate(met({ downloadUrl: "https://evil.example/CRDImages/a.jpg" }), "image")).toBeNull();
    expect(directCandidate(met({ downloadUrl: "https://images.metmuseum.org.evil.example/CRDImages/a.jpg" }), "image")).toBeNull();
    expect(directCandidate(met({ downloadUrl: "http://images.metmuseum.org/CRDImages/a.jpg" }), "image")).toBeNull();
    expect(directCandidate(met({ downloadUrl: "https://images.metmuseum.org/../../etc/passwd" }), "image")).toBeNull();
    expect(directCandidate(met({ license: null }), "image")).toBeNull();
    expect(directCandidate(artic({ downloadUrl: "https://www.artic.edu/iiif/2/not-an-id/full/843,/0/default.jpg" }), "image")).toBeNull();
  });

  it("sends a Flickr photo only where its own licence allows, from Flickr's own server", () => {
    expect(directCandidate(flickr(), "image")).toMatchObject({ hosts: ["staticflickr.com"], mime: "image/jpeg" });
    expect(directCandidate(flickr({ license: { name: "CC BY-NC 2.0", url: null } }), "image")).toBeNull();
    expect(directCandidate(flickr({ license: { name: "CC BY-NC-ND 2.0", url: null } }), "image")).toBeNull();
    expect(directCandidate(flickr({ license: null }), "image")).toBeNull();
    expect(directCandidate(flickr({ downloadUrl: "https://evil.example/a.jpg" }), "image")).toBeNull();
  });
});

describe("recordings and videos from Commons", () => {
  const media = (kind: "audio" | "video", mimeType: string, over: Partial<ExternalContentItem> = {}) => commons({
    contentType: kind, mimeType, title: kind === "audio" ? "Thunder" : "Eruption", downloadUrl: commonsFile(kind === "audio" ? "Thunder.ogg" : "Eruption.webm"), sizeBytes: 3 * MB, ...over,
  });

  it("sends an MP3 or an MP4 as it is", () => {
    expect(directCandidate(media("audio", "audio/mpeg"), "audio")).toMatchObject({ mime: "audio/mpeg", fileName: "Thunder.mp3" });
    expect(directCandidate(media("audio", "audio/mpeg"), "audio")).not.toHaveProperty("convert");
    expect(directCandidate(media("video", "video/mp4"), "video")).toMatchObject({ mime: "video/mp4", fileName: "Eruption.mp4" });
  });

  it("converts what Meta will not take: Ogg, FLAC, WAV to MP3; WebM and Ogg video to MP4", () => {
    for (const mime of ["audio/ogg", "audio/flac", "audio/x-wav", "audio/webm"]) expect(directCandidate(media("audio", mime), "audio"), mime).toMatchObject({ convert: { to: "mp3", mime: "audio/mpeg" } });
    for (const mime of ["video/webm", "video/ogg"]) expect(directCandidate(media("video", mime), "video"), mime).toMatchObject({ convert: { to: "mp4", mime: "video/mp4" } });
  });

  it("never converts a no-derivatives work, takes a NonCommercial one, or a file of the wrong kind", () => {
    expect(directCandidate(media("audio", "audio/ogg", { license: CC_BY_ND }), "audio")).toBeNull();
    expect(directCandidate(media("audio", "audio/mpeg", { license: CC_BY_NC }), "audio")).toBeNull();
    expect(directCandidate(media("audio", "audio/mpeg", { license: CC_BY_ND }), "audio")).not.toBeNull();
    expect(directCandidate(media("video", "video/webm"), "audio")).toBeNull();
    expect(directCandidate(media("audio", "audio/ogg", { downloadUrl: "https://evil.example/a.ogg" }), "audio")).toBeNull();
  });
});

describe("papers and documents", () => {
  it("sends an open-access PDF that states an open licence, from a named repository", () => {
    expect(directCandidate(paper(), "document")).toMatchObject({ url: "https://zenodo.org/records/1/files/paper.pdf", mime: "application/pdf", hosts: ["zenodo.org"], fileName: "Accessible-education-for-blind-learners.pdf" });
    expect(directCandidate(paper({ downloadUrl: "https://files.zenodo.org/a.pdf" }), "document")).toMatchObject({ hosts: ["zenodo.org"] });
    expect(directCandidate(paper({ downloadUrl: "https://arxiv.org/pdf/2101.00001" }), "document")).toMatchObject({ hosts: ["arxiv.org"] });
  });

  it("never sends metadata only, an unlicensed or NonCommercial paper, or a PDF from a host we do not name", () => {
    expect(directCandidate(paper({ downloadUrl: null }), "document")).toBeNull(); // metadata only
    expect(directCandidate(paper({ license: null }), "document")).toBeNull();
    expect(directCandidate(paper({ license: { name: "CC BY-NC", url: null } }), "document")).toBeNull();
    expect(directCandidate(paper({ downloadUrl: "https://random-journal.example/paper.pdf" }), "document")).toBeNull();
    expect(directCandidate(paper({ downloadUrl: "https://zenodo.org.evil.example/paper.pdf" }), "document")).toBeNull();
    expect(directCandidate(paper({ downloadUrl: "http://zenodo.org/paper.pdf" }), "document")).toBeNull();
    // Europe PMC answers a bot challenge and is not on the list.
    expect(directCandidate(paper({ downloadUrl: "https://europepmc.org/articles/PMC1/pdf/x.pdf" }), "document")).toBeNull();
  });

  it("sends a PDF from Commons, and only a PDF", () => {
    const pdf = commons({ contentType: "document", mimeType: "application/pdf", downloadUrl: commonsFile("Report.pdf"), sizeBytes: 4 * MB, title: "Report" });
    expect(directCandidate(pdf, "document")).toMatchObject({ mime: "application/pdf", fileName: "Report.pdf" });
    expect(directCandidate(commons({ contentType: "document", mimeType: "application/zip", downloadUrl: commonsFile("x.zip") }), "document")).toBeNull();
  });

  it("searches only the sources that can deliver, for documents, recordings and videos", () => {
    expect(KIND_SEARCH.document).toEqual({ categories: ["documents"], providers: ["openalex", "wikimedia_commons"] });
    expect(KIND_SEARCH.audio).toEqual({ categories: ["audio"], providers: ["wikimedia_commons", "internet_archive"] });
    expect(KIND_SEARCH.video.providers).toEqual(["internet_archive", "wikimedia_commons"]);
  });
});

describe("the sources that stay links, by design", () => {
  it.each(["youtube", "vimeo", "dailymotion", "pixabay", "pexels", "unsplash", "arxiv", "crossref", "europe_pmc", "core", "doab", "open_library", "podcast_index", "apple_podcasts", "freesound", "jamendo", "wikipedia"])(
    "%s is never a delivered file, whatever it claims",
    (provider) => {
      expect(DELIVERY_HOSTS[provider]).toBeUndefined();
      for (const kind of ["image", "audio", "video", "document", "book", "audiobook"] as const) {
        const item = makeItem(provider, {
          provider, providerItemId: "1", title: "x", contentType: "video", mimeType: "video/mp4", license: CC0, externalUrl: "https://example.org/x",
          downloadUrl: "https://example.org/x.mp4", thumbnailUrl: "https://example.org/x.jpg",
        });
        expect(directCandidate(item, kind), `${provider}/${kind}`).toBeNull();
      }
    },
  );
});

// ─── The research source itself ───────────────────────────────────────────

describe("OpenAlex: metadata, abstract, or an open-access PDF", () => {
  const fetchWorks = (works: unknown[]) => vi.fn(async () => new Response(JSON.stringify({ results: works }), { status: 200 }));
  const work = (over: Record<string, unknown> = {}) => ({
    id: "https://openalex.org/W1", title: "Accessible education", publication_year: 2024, doi: "https://doi.org/10.1000/abc", authorships: [{ author: { display_name: "A. Author" } }],
    open_access: { is_oa: true, oa_url: "https://zenodo.org/records/1" }, primary_location: { landing_page_url: "https://doi.org/10.1000/abc" }, ...over,
  });

  it("asks OpenAlex for the open-access location", async () => {
    const f = fetchWorks([]);
    await searchOpenAlex(f as never, "accessible education");
    expect(String((f.mock.calls as unknown[][])[0][0])).toContain("best_oa_location");
  });

  it("a record with no open-access PDF is metadata only: no file is claimed", async () => {
    const refs = await searchOpenAlex(fetchWorks([work()]) as never, "x");
    expect(refs[0].pdfUrl).toBeUndefined();
    const items = await openAlex.search({ query: "x", limit: 5, page: 1, categories: [], language: "en" } as never, { fetch: fetchWorks([work()]) as never, env: () => undefined } as never);
    expect(items[0].downloadUrl).toBeNull();
    expect(items[0].license).toBeNull();
  });

  it("a PDF without a stated open licence is a link, not a file", async () => {
    const refs = await searchOpenAlex(fetchWorks([work({ best_oa_location: { pdf_url: "https://zenodo.org/a.pdf", license: null } }), work({ best_oa_location: { pdf_url: "https://zenodo.org/a.pdf", license: "publisher-specific-oa" } })]) as never, "x");
    for (const ref of refs) expect(ref.pdfUrl).toBeUndefined();
  });

  it("an open-access PDF with an open licence becomes a downloadable, licensed item", async () => {
    const f = fetchWorks([work({ best_oa_location: { pdf_url: "https://zenodo.org/records/1/files/paper.pdf", license: "cc-by" } })]);
    const items = await openAlex.search({ query: "x", limit: 5, page: 1, categories: [], language: "en" } as never, { fetch: f as never, env: () => undefined } as never);
    expect(items[0]).toMatchObject({ mimeType: "application/pdf", downloadUrl: "https://zenodo.org/records/1/files/paper.pdf", license: { name: "CC BY" } });
    expect(directCandidate(items[0], "document")).toMatchObject({ hosts: ["zenodo.org"] });
  });

  it("refuses a PDF address that is not https, or absurdly long", async () => {
    const refs = await searchOpenAlex(fetchWorks([
      work({ best_oa_location: { pdf_url: "http://zenodo.org/a.pdf", license: "cc-by" } }),
      work({ best_oa_location: { pdf_url: `https://zenodo.org/${"a".repeat(600)}.pdf`, license: "cc-by" } }),
    ]) as never, "x");
    for (const ref of refs) expect(ref.pdfUrl).toBeUndefined();
  });

  it("names licences the way the rest of the catalogue does", () => {
    expect(openAlexLicenseName("cc-by")).toBe("CC BY");
    expect(openAlexLicenseName("cc-by-sa")).toBe("CC BY-SA");
    expect(openAlexLicenseName("cc0")).toBe("CC0");
    expect(openAlexLicenseName("public-domain")).toBe("Public Domain");
    expect(licenceAllows({ name: openAlexLicenseName("cc-by-nc") }, false)).toBe(false);
  });
});

// ─── The flow ─────────────────────────────────────────────────────────────

const delivered = (kind: "image" | "audio" | "video" | "document" = "document"): DeliveryResult => ({ outcome: `delivered_${kind}`, kind, bytes: 10, uploadTries: 1, sendTries: 1, ms: 5 });
const failed = (): DeliveryResult => ({ outcome: "failed", reason: "asset_download_failed", ms: 5 });
const found = (...items: ExternalContentItem[]): AggregateResult => ({ items, providers: [], duplicates: 0 });

function deps(over: { items?: ExternalContentItem[]; deliver?: AttachDeps["deliver"]; convert?: AttachDeps["convert"]; fetch?: AttachDeps["fetch"] } = {}) {
  const deliverFn = vi.fn<(asset: DeliverableAsset) => Promise<DeliveryResult>>(over.deliver ?? (async () => delivered()));
  const sendText = vi.fn(async () => undefined);
  const fetchFn = vi.fn(over.fetch ?? (async (url: string) => { throw new Error(`unexpected fetch ${url}`); }));
  const d: AttachDeps = { fetch: fetchFn as never, env: () => undefined, deliver: deliverFn, sendText, convert: over.convert, search: async () => found(...(over.items ?? [])) };
  return { d, deliverFn, sendText, fetchFn };
}

describe("research: from a question to the PDF", () => {
  it("delivers the open-access PDF as a document, then the citation: title, author, source, licence, DOI", async () => {
    const { d, deliverFn, sendText } = deps({ items: [paper()] });
    const out = await attachExternalFile({ kind: "document", query: "accessible education", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "delivered", provider: "openalex", kind: "document" });
    expect(deliverFn.mock.calls[0][0]).toMatchObject({ url: "https://zenodo.org/records/1/files/paper.pdf", mimeType: "application/pdf", allowedHosts: ["zenodo.org"] });
    const credit = String((sendText.mock.calls[0] as unknown[])[0]);
    expect(credit).toContain("Accessible education for blind learners — A. Author");
    expect(credit).toContain("OpenAlex · CC BY");
    expect(credit).toContain("https://doi.org/10.1000/abc");
  });

  it("a metadata-only paper is never claimed as a file: the answer is its page", async () => {
    const { d, deliverFn } = deps({ items: [paper({ downloadUrl: null, license: null })] });
    const out = await attachExternalFile({ kind: "document", query: "accessible education", language: "en" }, d);
    expect(out).toEqual({ outcome: "none", reason: "no_candidate", tried: 0, link: { url: "https://doi.org/10.1000/abc", title: "Accessible education for blind learners" } });
    expect(deliverFn).not.toHaveBeenCalled();
  });

  it("tries the next paper when the first cannot be delivered (another repository, another try)", async () => {
    let n = 0;
    const { d, deliverFn } = deps({
      items: [paper({ providerItemId: "1", downloadUrl: "https://zenodo.org/a.pdf" }), paper({ providerItemId: "2", downloadUrl: "https://hal.science/b.pdf" })],
      deliver: async () => (++n === 2 ? delivered() : failed()),
    });
    expect(await attachExternalFile({ kind: "document", query: "accessible education", language: "en" }, d)).toMatchObject({ outcome: "delivered", tried: 2 });
    expect(deliverFn.mock.calls.map((c) => c[0].allowedHosts)).toEqual([["zenodo.org"], ["hal.science"]]);
  });

  it("skips a paper that is not about the subject", async () => {
    const { d, deliverFn } = deps({ items: [paper({ title: "Volcanic activity in Iceland" })] });
    const out = await attachExternalFile({ kind: "document", query: "accessible education", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "none", reason: "no_candidate" });
    expect(deliverFn).not.toHaveBeenCalled();
  });
});

describe("conversion of what Meta will not take, or will not take at that size", () => {
  const graph = (routes: Record<string, () => Response> = {}) => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      for (const [prefix, make] of Object.entries(routes)) if (url.startsWith(prefix)) return make();
      if (url.startsWith("https://evil.example/")) throw new Error("must never be fetched");
      calls.push({ url, body: init?.body });
      if (/\/media$/.test(url)) return new Response(JSON.stringify({ id: "media-1" }), { status: 200 });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
    });
    return { calls, fetchImpl };
  };
  const real = (fetchImpl: typeof fetch) => (asset: DeliverableAsset) => deliverAsset({ phoneNumberId: "111", token: "t", to: "9627", asset, fetchImpl, sleep: async () => undefined });
  const met = () => makeItem("Met", {
    provider: "met_museum", providerItemId: "1", title: "Wheat Field", contentType: "image", license: CC0, sizeBytes: null,
    externalUrl: "https://www.metmuseum.org/art/1", downloadUrl: "https://images.metmuseum.org/CRDImages/ep/original/DT1.jpg",
  });

  it("an image over 5 MB is resized on the processor, and the JPEG that comes back is sent as a real image", async () => {
    const convert = vi.fn(async (_bytes: Uint8Array, _query: string) => ({ ok: true, bytes: JPEG, mime: "image/jpeg" }));
    const { calls, fetchImpl } = graph({
      "https://images.metmuseum.org/": () => new Response(new Uint8Array(9 * MB), { status: 200, headers: { "content-type": "image/jpeg" } }),
    });
    const { d } = deps({ items: [met()], deliver: real(fetchImpl as never), convert, fetch: fetchImpl as never });
    // The declared size (HEAD) says 9 MB: too big as it is, so it is converted.
    (d.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": String(9 * MB) } });
      return (fetchImpl as unknown as (u: string, i?: RequestInit) => Promise<Response>)(url, init);
    });
    const out = await attachExternalFile({ kind: "image", query: "wheat field", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "delivered", kind: "image" });
    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert.mock.calls[0][1]).toBe("to=jpg&width=1600&quality=balanced");
    expect(JSON.parse(String(calls[1].body))).toMatchObject({ type: "image", image: { id: "media-1" } });
  });

  it("without a processor, an image that is too big is not sent and the answer is the page", async () => {
    const { d, deliverFn } = deps({ items: [met()], fetch: (async (_u: string, init?: RequestInit) => new Response(null, { status: 200, headers: { "content-length": String(9 * MB) }, ...(init ? {} : {}) })) as never });
    const out = await attachExternalFile({ kind: "image", query: "wheat field", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "none", reason: "no_candidate", tried: 0, link: { url: "https://www.metmuseum.org/art/1" } });
    expect(deliverFn).not.toHaveBeenCalled();
  });

  it("a conversion that fails, or returns nothing, is a failed delivery, never a partial one", async () => {
    for (const convert of [
      async () => ({ ok: false, code: "busy" }),
      async () => ({ ok: true, bytes: new Uint8Array(0), mime: "image/jpeg" }),
      async () => ({ ok: true, bytes: JPEG }),
    ]) {
      const { fetchImpl } = graph({ "https://upload.wikimedia.org/": () => new Response(JPEG, { status: 200 }) });
      const item = commons({ mimeType: "image/webp", downloadUrl: commonsFile("Fox.webp"), sizeBytes: 1 * MB });
      const { d, deliverFn, sendText } = deps({ items: [item], convert: convert as never, fetch: fetchImpl as never });
      const out = await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d);
      expect(out).toMatchObject({ outcome: "none", reason: "delivery_failed", link: expect.any(Object) });
      expect(deliverFn).not.toHaveBeenCalled();
      expect(sendText).not.toHaveBeenCalled();
    }
  });

  it("a WebP from Commons is converted to JPEG and sent as an image", async () => {
    const convert = vi.fn(async () => ({ ok: true, bytes: JPEG, mime: "image/jpeg" }));
    const { calls, fetchImpl } = graph({ "https://upload.wikimedia.org/": () => new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), { status: 200 }) });
    const item = commons({ mimeType: "image/webp", downloadUrl: commonsFile("Fox.webp"), sizeBytes: 1 * MB });
    const { d } = deps({ items: [item], convert: convert as never, deliver: real(fetchImpl as never), fetch: fetchImpl as never });
    expect(await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d)).toMatchObject({ outcome: "delivered", kind: "image" });
    expect(JSON.parse(String(calls[1].body))).toMatchObject({ type: "image" });
  });

  it("an Ogg recording from Commons is converted to MP3 and sent as audio; a WebM video as MP4 video", async () => {
    for (const [kind, mime, file, out, deliveredKind, bytes, sendType] of [
      ["audio", "audio/ogg", "Thunder.ogg", "audio/mpeg", "audio", MP3, "audio"],
      ["video", "video/webm", "Eruption.webm", "video/mp4", "video", new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0]), "video"],
    ] as const) {
      const convert = vi.fn(async (_b: Uint8Array, _q: string) => ({ ok: true, bytes, mime: out }));
      const { calls, fetchImpl } = graph({ "https://upload.wikimedia.org/": () => new Response(new Uint8Array(1000), { status: 200 }) });
      const item = commons({ contentType: kind, mimeType: mime, title: "Clip", downloadUrl: commonsFile(file), sizeBytes: 1 * MB });
      const { d } = deps({ items: [item], convert: convert as never, deliver: real(fetchImpl as never), fetch: fetchImpl as never });
      const result = await attachExternalFile({ kind, query: "clip", language: "en" }, d);
      expect(result, kind).toMatchObject({ outcome: "delivered", kind: deliveredKind });
      expect(convert.mock.calls[0][1]).toBe(kind === "audio" ? "to=mp3" : "to=mp4");
      expect(JSON.parse(String(calls[1].body))).toMatchObject({ type: sendType });
    }
  });

  it("a source over the processor's 16 MB is refused before it is downloaded", async () => {
    const convert = vi.fn();
    const item = commons({ mimeType: "image/webp", downloadUrl: commonsFile("Huge.webp"), sizeBytes: 30 * MB });
    const { d, fetchFn } = deps({ items: [item], convert: convert as never });
    const out = await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d);
    expect(out).toMatchObject({ outcome: "none", reason: "delivery_failed" });
    expect(convert).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("a converted download never leaves the named host: a redirect off it is refused", async () => {
    const convert = vi.fn();
    const { fetchImpl } = graph({ "https://upload.wikimedia.org/": () => new Response(null, { status: 302, headers: { location: "https://evil.example/a.webp" } }) });
    const item = commons({ mimeType: "image/webp", downloadUrl: commonsFile("Fox.webp"), sizeBytes: 1 * MB });
    const { d } = deps({ items: [item], convert: convert as never, fetch: fetchImpl as never });
    expect(await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, d)).toMatchObject({ outcome: "none", reason: "delivery_failed" });
    expect(convert).not.toHaveBeenCalled();
  });
});

describe("end to end through deliverAsset: documents", () => {
  const graph = (routes: Record<string, () => Response> = {}) => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      for (const [prefix, make] of Object.entries(routes)) if (url.startsWith(prefix)) return make();
      if (url.startsWith("https://zenodo.org/")) return new Response(PDF, { status: 200, headers: { "content-type": "application/pdf" } });
      calls.push({ url, body: init?.body });
      if (/\/media$/.test(url)) return new Response(JSON.stringify({ id: "media-1" }), { status: 200 });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
    });
    return { calls, fetchImpl };
  };
  const real = (fetchImpl: typeof fetch) => (asset: DeliverableAsset) => deliverAsset({ phoneNumberId: "111", token: "t", to: "9627", asset, fetchImpl, sleep: async () => undefined });

  it("a paper is fetched from its repository and sent as a real WhatsApp DOCUMENT with its file name", async () => {
    const { calls, fetchImpl } = graph();
    const { d, sendText } = deps({ items: [paper()], deliver: real(fetchImpl as never) });
    expect(await attachExternalFile({ kind: "document", query: "accessible education", language: "en" }, d)).toMatchObject({ outcome: "delivered", kind: "document" });
    expect(JSON.parse(String(calls[1].body))).toMatchObject({ type: "document", to: "9627", document: { id: "media-1", filename: "Accessible-education-for-blind-learners.pdf" } });
    expect(sendText).toHaveBeenCalledTimes(1);
  });

  it("an HTML page, a JSON error or a ZIP served as the PDF is refused, and the answer is the page", async () => {
    for (const body of [new TextEncoder().encode("<html>Please complete the captcha</html>"), new TextEncoder().encode('{"error":"forbidden"}'), new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])]) {
      const { calls, fetchImpl } = graph({ "https://zenodo.org/": () => new Response(body, { status: 200, headers: { "content-type": "application/pdf" } }) });
      const { d, sendText } = deps({ items: [paper()], deliver: real(fetchImpl as never) });
      const out = await attachExternalFile({ kind: "document", query: "accessible education", language: "en" }, d);
      expect(out).toMatchObject({ outcome: "none", reason: "delivery_failed", link: { url: "https://doi.org/10.1000/abc" } });
      expect(calls).toEqual([]);
      expect(sendText).not.toHaveBeenCalled();
    }
  });

  it("a redirect to an internal address, or to a host not named, is refused and never fetched", async () => {
    for (const location of ["http://169.254.169.254/latest/meta-data", "https://127.0.0.1/a.pdf", "https://localhost/a.pdf", "https://10.0.0.5/a.pdf", "https://[::1]/a.pdf", "https://evil.example/a.pdf"]) {
      const { calls, fetchImpl } = graph({ "https://zenodo.org/": () => new Response(null, { status: 302, headers: { location } }) });
      const { d } = deps({ items: [paper()], deliver: real(fetchImpl as never) });
      const out = await attachExternalFile({ kind: "document", query: "accessible education", language: "en" }, d);
      expect(out, location).toMatchObject({ outcome: "none", reason: "delivery_failed" });
      expect(calls).toEqual([]);
      expect(fetchImpl).not.toHaveBeenCalledWith(location, expect.anything());
    }
  });

  it("a file over Meta's 100 MB document limit is refused, even when the server streams it anyway", async () => {
    const huge = new Uint8Array(101 * MB);
    huge.set(PDF);
    const { calls, fetchImpl } = graph({ "https://zenodo.org/": () => new Response(huge, { status: 200, headers: { "content-type": "application/pdf" } }) });
    const { d } = deps({ items: [paper()], deliver: real(fetchImpl as never) });
    expect(await attachExternalFile({ kind: "document", query: "accessible education", language: "en" }, d)).toMatchObject({ outcome: "none", reason: "delivery_failed" });
    expect(calls).toEqual([]);
  });
});

describe("security: the fetch rules every candidate keeps", () => {
  it("isFetchableAssetUrl: https only, named hosts only, no credentials, no IP literal, no internal name", () => {
    const hosts = ["zenodo.org"];
    expect(isFetchableAssetUrl("https://zenodo.org/a.pdf", hosts)).toBe(true);
    expect(isFetchableAssetUrl("https://files.zenodo.org/a.pdf", hosts)).toBe(true);
    for (const bad of [
      "http://zenodo.org/a.pdf", "https://zenodo.org.evil.example/a.pdf", "https://evilzenodo.org/a.pdf", "https://user:pw@zenodo.org/a.pdf", "https://127.0.0.1/a.pdf",
      "https://169.254.169.254/a", "https://[::1]/a", "https://localhost/a", "https://app.localhost/a", "https://db.internal/a", "file:///etc/passwd", "ftp://zenodo.org/a", "not a url", "",
    ]) expect(isFetchableAssetUrl(bad, hosts), bad).toBe(false);
    expect(isFetchableAssetUrl("https://127.0.0.1/a.pdf", ["127.0.0.1"])).toBe(false);
  });

  it("a hostile title becomes a safe file name: no path, no traversal, no separators", () => {
    const item = paper({ title: "../../etc/passwd\u0000<script>alert(1)</script>.pdf" });
    const candidate = directCandidate(item, "document");
    expect(candidate?.fileName).toMatch(/^[\p{L}\p{N}-]+\.pdf$/u);
    expect(candidate?.fileName).not.toMatch(/[/\\<>\0]|\.\./);
  });

  it("an address with a path-traversal or a scheme trick is not a Commons original", () => {
    for (const downloadUrl of [
      "https://upload.wikimedia.org/wikipedia/commons/a/ab/../../../secret.jpg", "https://upload.wikimedia.org.evil.example/wikipedia/commons/a/ab/x.jpg",
      "https://upload.wikimedia.org/wikipedia/en/a/ab/x.jpg", "http://upload.wikimedia.org/wikipedia/commons/a/ab/x.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/x.jpg/200px-x.jpg",
    ]) expect(directCandidate(commons({ downloadUrl }), "image"), downloadUrl).toBeNull();
  });
});

// ─── Where the webhook uses it ────────────────────────────────────────────

describe("the WhatsApp webhook", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  const gate = webhook.indexOf('requireActiveSubscription(db, { channel: "whatsapp"');
  const block = webhook.slice(webhook.indexOf("// ── A recording, a paper or a document that already exists"), webhook.indexOf("const bazaarRequest ="));

  it("every attachment path is behind the subscription gate, so an unsubscribed sender reaches none of them", () => {
    expect(gate).toBeGreaterThan(0);
    for (const marker of ["parseAssetRequest(questionText)", "parseImageRequest(questionText)", "attachExternalFile("]) expect(webhook.indexOf(marker), marker).toBeGreaterThan(gate);
  });

  it("the recording/paper/document flow follows the books flow and ends the turn only when it delivered or answered with a link", () => {
    expect(block.length).toBeGreaterThan(300);
    expect(webhook.indexOf("parseAssetRequest(questionText)")).toBeGreaterThan(webhook.indexOf("parseBookRequest(questionText)"));
    expect(block).toMatch(/const assetRequest = humanOwnsThis \|\| bookNotFound \|\| mediaNotFound \|\| !featureOn\("services\.media"\)/);
    expect(block).not.toMatch(/aiFocused/);
    expect(block).toMatch(/if \(attached\.outcome === "delivered"\) continue;/);
    expect(block).toContain("deliveryFallbackText(answerLanguage)");
    expect(block).toMatch(/if \(attached\.link\) \{[\s\S]*?continue;\s*\}\s*\}\s*$/);
  });

  it("every flow can convert on the media processor, and none reads a secret or logs a query, title or address", () => {
    expect(webhook.split("convert: externalConvert(),")).toHaveLength(5); // image, asset, video/audiobook, book
    expect(webhook.split("translate: translateWithChain,")).toHaveLength(5);
    const logs = webhook.split("\n").filter((l) => l.includes('log("external_file"'));
    expect(logs).toHaveLength(4);
    for (const line of logs) expect(line).not.toMatch(/query|title|url|incoming\.from|token/i);
  });

  it("'send me' counts as asking for the file in the video, audiobook and book flows, and the existing list is still the fallback", () => {
    // A film or an audiobook is always tried as a file first; only a podcast (a publisher's stream) is not.
    expect(webhook).toMatch(/if \(token && phoneNumberId && request\.kind !== "podcast"\) \{/);
    expect(webhook).toMatch(/library\.length === 0 && token && phoneNumberId && \(parseFileWish\(questionText\) \|\| wantsSend\(questionText\)\)/);
  });

  it("leaves the assistant's own generation, summarising and translating to the existing flows", () => {
    const parser = readFileSync("supabase/functions/_shared/whatsappImageRequest.ts", "utf8");
    expect(parser).toMatch(/CREATE\.test\(message\) \|\| ANALYSE\.test\(message\)/);
    expect(block).not.toMatch(/image-generate|handleOwnerCommand|understandImage|extractDocumentText/);
  });
});

// ─── The fix for "I cannot send images" ───────────────────────────────────

import { ASSET_CAPABILITY_DIRECTIVE } from "../../supabase/functions/_shared/whatsappImageRequest.ts";

describe("a request is recognised the way people actually write it", () => {
  it.each([
    ["بدي صورة عن بيروت", "بيروت"], ["ابعتلي صورة أسد", "أسد"], ["صورة برج ايفل", "برج ايفل"], ["أريد صورة لجبل أفرست", "جبل أفرست"],
    ["ممكن صورة للأهرامات", "الأهرامات"], ["جيبلي صورة القدس", "القدس"], ["i want a picture of a lion", "lion"], ["photo of petra", "petra"],
    ["quiero una foto de Barcelona", "Barcelona"], ["je veux une photo de Paris", "Paris"], ["ich möchte ein Foto von Berlin", "Berlin"], ["хочу фото Байкала", "Байкала"],
  ])("a picture: %s", (text, query) => {
    const parsed = parseImageRequest(text);
    expect(parsed, text).not.toBeNull();
    expect(parsed!.query).toContain(query);
  });

  it("wanting is asking, but making is still ruled out, and a bare Latin noun is not a request", () => {
    expect(parseImageRequest("أنشئ صورة أسد")).toBeNull();
    expect(parseImageRequest("i want you to generate a picture of a lion")).toBeNull();
    expect(parseImageRequest("image generation models")).toBeNull();
    expect(parseImageRequest("what is in this image")).toBeNull();
    expect(parseImageRequest("ارسل صورة")).toBeNull(); // nothing to look for
  });

  it.each([
    ["ابعتلي فيديو عن بركان", "video", "بركان"], ["send me a video about volcanoes", "video", "volcanoes"], ["find a film about Petra and send it", "video", "Petra"],
    ["بدي ملف pdf عن الذكاء الاصطناعي", "document", "الذكاء الاصطناعي"], ["أريد أبحاث عن الديسلكسيا", "document", "الديسلكسيا"], ["i need research papers about dyslexia", "document", "dyslexia"],
    ["pdf about cats", "document", "cats"], ["send me an audio recording of rain", "audio", "rain"],
  ])("a video, paper or recording: %s", (text, kind, query) => {
    const parsed = parseAssetRequest(text);
    expect(parsed, text).not.toBeNull();
    expect(parsed!.kind).toBe(kind);
    expect(parsed!.query).toContain(query);
  });
});

describe("a request in Arabic, Persian, Russian or Chinese is searched in English first", () => {
  it("translates, tries the English phrase first, then the original, and delivers from whichever works", async () => {
    const searches: string[] = [];
    const deliver = vi.fn(async () => delivered("image"));
    const d: AttachDeps = {
      fetch: (async () => { throw new Error("no network"); }) as never, env: () => undefined, deliver, sendText: async () => undefined,
      translate: async (q) => (q === "بيروت" ? "Beirut" : null),
      search: async (input) => { searches.push(input.query); return input.query === "Beirut" ? found(commons({ title: "Beirut skyline", providerItemId: "9" })) : found(); },
    };
    const out = await attachExternalFile({ kind: "image", query: "بيروت", language: "ar" }, d);
    expect(out).toMatchObject({ outcome: "delivered", provider: "wikimedia_commons" });
    expect(searches).toEqual(["Beirut"]);
  });

  it("falls back to the original words when the English search finds nothing, and returns a page if there is one", async () => {
    const searches: string[] = [];
    const d: AttachDeps = {
      fetch: (async () => { throw new Error("no network"); }) as never, env: () => undefined, deliver: async () => failed(), sendText: async () => undefined,
      translate: async () => "Beirut",
      search: async (input) => { searches.push(input.query); return input.query === "بيروت" ? found(commons({ providerItemId: "9" })) : found(); },
    };
    const out = await attachExternalFile({ kind: "image", query: "بيروت", language: "ar" }, d);
    expect(searches).toEqual(["Beirut", "بيروت"]);
    expect(out).toMatchObject({ outcome: "none", link: { url: "https://commons.wikimedia.org/wiki/File:Red_fox.jpg" } });
  });

  it("never asks for a translation of a Latin-script request, and survives a translator that fails or answers in the same script", async () => {
    const translate = vi.fn(async () => "x");
    const base = { fetch: (async () => { throw new Error("no network"); }) as never, env: () => undefined, deliver: async () => delivered("image"), sendText: async () => undefined, search: async () => found(commons()) };
    await attachExternalFile({ kind: "image", query: "red fox", language: "en" }, { ...base, translate });
    expect(translate).not.toHaveBeenCalled();
    for (const t of [async () => { throw new Error("down"); }, async () => null, async () => "بيروت", async () => ""]) {
      expect(await attachExternalFile({ kind: "image", query: "بيروت", language: "ar" }, { ...base, translate: t as never })).toMatchObject({ outcome: "delivered" });
    }
  });
});

describe("the assistant is never left believing it cannot send files", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  it("says that pictures, recordings, videos, papers and books can be sent, and forbids the refusal", () => {
    expect(ASSET_CAPABILITY_DIRECTIVE).toMatch(/CAN send real pictures, audio recordings, videos, research papers, PDFs and books/);
    expect(ASSET_CAPABILITY_DIRECTIVE).toMatch(/Never say that you cannot send/);
    expect(webhook).toContain("ASSET_CAPABILITY_DIRECTIVE,");
  });

  it("serves an explicit request for a picture, a video, a recording or a paper while the assistant holds the floor", () => {
    const image = webhook.slice(webhook.indexOf("// ── A picture that already exists"), webhook.indexOf("// ── Videos, podcasts and audiobooks"));
    const asset = webhook.slice(webhook.indexOf("// ── A recording, a paper or a document"), webhook.indexOf("const bazaarRequest ="));
    expect(image).not.toContain("aiFocused");
    expect(asset).not.toContain("aiFocused");
  });
});
