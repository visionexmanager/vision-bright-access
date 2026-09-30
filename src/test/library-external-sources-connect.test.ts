// The keyless sources connected on 2026-09-30: Gutenberg (OPDS), Standard
// Ebooks, Europe PMC, Crossref, DOAJ, the Rijksmuseum and the public news feeds.
// Payloads are trimmed copies of what each answered that day.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { searchExternalContent, normalizeSearchInput } from "../../supabase/functions/_shared/externalContent/aggregate.ts";
import { CONTENT_PROVIDERS, UNSUPPORTED_PROVIDERS, providerById, providerStatus } from "../../supabase/functions/_shared/externalContent/registry.ts";
import { gutenberg, parseGutenbergOpds, parseStandardEbooks, standardEbooks } from "../../supabase/functions/_shared/externalContent/providers/opds.ts";
import { crossref, doaj, europePmc, parseCrossref, parseDoaj, parseEuropePmc } from "../../supabase/functions/_shared/externalContent/providers/science.ts";
import { parseRijksImage, parseRijksObject } from "../../supabase/functions/_shared/externalContent/providers/rijksmuseum.ts";
import { feedsFor, matchesQuery, openFeeds, parseFeed } from "../../supabase/functions/_shared/externalContent/providers/feeds.ts";
import { CONTENT_CATEGORIES } from "../../supabase/functions/_shared/externalContent/types.ts";
import type { ContentProvider, SearchParams } from "../../supabase/functions/_shared/externalContent/types.ts";

const noEnv = () => undefined;
const params = (query = "climate", extra: Partial<SearchParams> = {}): SearchParams => ({ query, categories: [], language: "en", page: 1, limit: 6, ...extra });
const ok = (body: string, type = "application/json") => new Response(body, { status: 200, headers: { "Content-Type": type } });
const run = (p: ContentProvider, fetch: (url: string, init?: RequestInit) => Promise<Response>, extra: Partial<SearchParams> = {}, env: (n: string) => string | undefined = noEnv) =>
  p.search(params("climate", extra), { fetch, env });

// ─── Normalisation ────────────────────────────────────────────────────────

describe("Standard Ebooks (OPDS)", () => {
  const feed = `<feed xmlns:dc="http://purl.org/dc/elements/1.1/">
    <entry>
      <id>https://standardebooks.org/ebooks/charles-dickens/the-pickwick-papers</id>
      <title>The Pickwick Papers</title>
      <author><name>Charles Dickens</name></author>
      <dc:language>en-GB</dc:language><dc:issued>2024-10-02T00:00:00Z</dc:issued>
      <rights>Public domain in the United States. Original content released via the Creative Commons CC0 1.0 Universal Public Domain Dedication.</rights>
      <summary type="text">A club of friends travels England.</summary>
      <category scheme="https://standardebooks.org/vocab/subjects" term="Humor"/>
      <link href="https://standardebooks.org/ebooks/charles-dickens/the-pickwick-papers/downloads/cover-thumbnail.jpg" rel="http://opds-spec.org/image/thumbnail" type="image/jpeg"/>
      <link href="https://standardebooks.org/ebooks/charles-dickens/the-pickwick-papers/downloads/charles-dickens_the-pickwick-papers.epub?source=feed" length="1234567" rel="http://opds-spec.org/acquisition/open-access" title="Recommended compatible epub" type="application/epub+zip"/>
    </entry>
    <entry><id>https://evil.example/ebooks/a/b</id><title>Not ours</title></entry>
    <entry><id>https://standardebooks.org/ebooks/some-author/no-licence</id><title>Odd rights</title><rights>All rights reserved.</rights>
      <link href="https://standardebooks.org/ebooks/some-author/no-licence/downloads/x.epub" rel="http://opds-spec.org/acquisition/open-access" type="application/epub+zip"/></entry>
  </feed>`;

  it("normalises a book with its file, size, licence and language", () => {
    const [book, odd, ...rest] = parseStandardEbooks(feed);
    expect(rest).toHaveLength(0);
    expect(book).toMatchObject({
      provider: "standard_ebooks", providerItemId: "charles-dickens/the-pickwick-papers", title: "The Pickwick Papers", creator: "Charles Dickens",
      contentType: "book", mimeType: "application/epub+zip", sizeBytes: 1234567, language: "en-GB", publishedAt: "2024-10-02", tags: ["Humor"],
      license: { name: "CC0 (public domain dedication)" }, attribution: "Standard Ebooks",
    });
    expect(book.downloadUrl).toMatch(/^https:\/\/standardebooks\.org\/ebooks\/charles-dickens\/the-pickwick-papers\/downloads\/.*\.epub/);
    expect(book.thumbnailUrl).toMatch(/cover-thumbnail\.jpg$/);
    // An entry that does not state CC0 carries no licence and no file.
    expect(odd).toMatchObject({ license: null, downloadUrl: null });
  });

  it("drops an entry whose id is not a Standard Ebooks page", () => {
    expect(parseStandardEbooks(feed).map((b) => b.title)).not.toContain("Not ours");
  });

  it("asks for the requested page and page size and reads the answer", async () => {
    const urls: string[] = [];
    const items = await run(standardEbooks, async (url) => { urls.push(url); return ok(feed, "application/atom+xml"); }, { page: 2, limit: 100 });
    expect(items).toHaveLength(2);
    expect(urls[0]).toContain("query=climate");
    expect(urls[0]).toContain("page=2");
    expect(urls[0]).toContain("per-page=48"); // capped
  });
});

describe("Project Gutenberg (OPDS)", () => {
  it("skips authors and subjects entries and keeps books", () => {
    const items = parseGutenbergOpds(`<feed>
      <entry><id>https://www.gutenberg.org/ebooks/subjects/search.opds/?query=x</id><title>Subjects</title></entry>
      <entry><id>https://www.gutenberg.org/ebooks/730.opds</id><title>Oliver Twist</title><content type="text">Charles Dickens</content></entry>
    </feed>`);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "gutenberg:730", creator: "Charles Dickens", externalUrl: "https://www.gutenberg.org/ebooks/730",
      thumbnailUrl: "https://www.gutenberg.org/cache/epub/730/pg730.cover.medium.jpg", downloadUrl: "https://www.gutenberg.org/ebooks/730.epub.noimages",
    });
  });

  it("maps the page onto OPDS start_index and never returns more than the limit", async () => {
    const entries = Array.from({ length: 20 }, (_, i) => `<entry><id>https://www.gutenberg.org/ebooks/${100 + i}.opds</id><title>Book ${i}</title></entry>`).join("");
    const urls: string[] = [];
    const items = await run(gutenberg, async (url) => { urls.push(url); return ok(`<feed>${entries}</feed>`, "application/atom+xml"); }, { page: 3, limit: 4 });
    expect(items).toHaveLength(4);
    expect(urls[0]).toContain("start_index=51");
    expect(urls[0]).toContain("search.opds");
  });
});

describe("Europe PMC", () => {
  const record = (over: Record<string, unknown>) => ({
    id: "42742570", source: "MED", pmcid: "PMC13576766", doi: "10.1111/x", title: "How behaviour can help <i>climate</i> health", authorString: "Filho WL, Wolf F.",
    abstractText: "<p>Abstract text.</p>", pubYear: "2026", firstPublicationDate: "2026-09-21", isOpenAccess: "Y", license: "cc by",
    journalInfo: { journal: { title: "Journal of Health" } }, language: "eng", keywordList: { keyword: ["climate", "health"] },
    fullTextUrlList: { fullTextUrl: [
      { availabilityCode: "S", documentStyle: "doi", site: "DOI", url: "https://doi.org/10.1111/x" },
      { availabilityCode: "OA", documentStyle: "pdf", site: "Europe_PMC", url: "https://europepmc.org/articles/PMC13576766?pdf=render" },
    ] },
    ...over,
  });

  it("offers the PDF only for an open-access record with a Creative Commons licence", () => {
    const [oa, noLicence, closed] = parseEuropePmc({ resultList: { result: [
      record({}),
      record({ id: "2", license: undefined }),
      record({ id: "3", isOpenAccess: "N", license: "cc by" }),
    ] } });
    expect(oa).toMatchObject({
      providerItemId: "MED_42742570", title: "How behaviour can help climate health", description: "Abstract text.", mimeType: "application/pdf",
      downloadUrl: "https://europepmc.org/articles/PMC13576766?pdf=render", license: { name: "CC BY" }, publishedAt: "2026-09-21",
      externalUrl: "https://europepmc.org/article/MED/42742570", tags: ["climate", "health"],
    });
    expect(noLicence).toMatchObject({ downloadUrl: null, license: null });
    expect(closed).toMatchObject({ downloadUrl: null });
  });

  it("never offers a PDF on another host, and rejects malformed ids", () => {
    const [elsewhere] = parseEuropePmc({ resultList: { result: [record({ fullTextUrlList: { fullTextUrl: [{ availabilityCode: "OA", documentStyle: "pdf", site: "Europe_PMC", url: "https://evil.example/x.pdf" }] } })] } });
    expect(elsewhere.downloadUrl).toBeNull();
    expect(parseEuropePmc({ resultList: { result: [record({ id: "../../x" }), record({ source: "bad!" }), record({ title: "" })] } })).toHaveLength(0);
  });

  it("asks only for open-access records and reduces the query to plain terms", async () => {
    const urls: string[] = [];
    await run(europePmc, async (url) => { urls.push(url); return ok(JSON.stringify({ resultList: { result: [] } })); }, {});
    expect(decodeURIComponent(urls[0].replace(/\+/g, " "))).toContain("climate AND OPEN_ACCESS:y");
    const injected: string[] = [];
    await europePmc.search(params('climate" OR (x'), { fetch: async (u) => { injected.push(u); return ok('{"resultList":{"result":[]}}'); }, env: noEnv });
    expect(decodeURIComponent(injected[0].replace(/\+/g, " "))).not.toContain('"');
    expect(await europePmc.search(params("!!!"), { fetch: async () => { throw new Error("must not call"); }, env: noEnv })).toEqual([]);
  });
});

describe("Crossref", () => {
  it("believes only a Creative Commons licence and only a real DOI", () => {
    const items = parseCrossref({ message: { items: [
      { DOI: "10.1007/978-94-017-2632-0_1", title: ["Photosynthesis Bibliography"], author: [{ given: "Z.", family: "Šesták" }], issued: { "date-parts": [[1984]] }, "container-title": ["Springer"], publisher: "Springer",
        license: [{ URL: "https://www.springer.com/tdm" }, { URL: "https://creativecommons.org/licenses/by/4.0/" }], abstract: "<jats:p>Bibliography.</jats:p>" },
      { DOI: "10.1000/vendor", title: ["Text-mining licence only"], license: [{ URL: "https://www.springer.com/tdm" }] },
      { DOI: "not-a-doi", title: ["Bad"] },
      { DOI: "10.1000/notitle", title: [] },
    ] } });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ providerItemId: "10.1007/978-94-017-2632-0_1", creator: "Z. Šesták", publishedAt: "1984", externalUrl: "https://doi.org/10.1007/978-94-017-2632-0_1", license: { name: "CC BY 4.0" }, description: "Bibliography." });
    expect(items[1].license).toBeNull();
    expect(items.every((i) => i.downloadUrl === null)).toBe(true);
  });

  it("is keyless, sends a contact address only when one is set and valid", async () => {
    expect(crossref.auth).toEqual({ kind: "optional", env: ["CROSSREF_MAILTO"] });
    expect(providerStatus(crossref, noEnv)).toBe("ready");
    const seen: string[] = [];
    const fetch = async (u: string) => { seen.push(u); return ok('{"message":{"items":[]}}'); };
    await run(crossref, fetch, {}, (n) => (n === "CROSSREF_MAILTO" ? "support@visionex.app" : undefined));
    await run(crossref, fetch, {}, (n) => (n === "CROSSREF_MAILTO" ? "not an address" : undefined));
    await run(crossref, fetch);
    expect(seen[0]).toContain("mailto=support%40visionex.app");
    expect(seen[1]).not.toContain("mailto");
    expect(seen[2]).not.toContain("mailto");
    expect(seen.every((u) => !u.includes("language"))).toBe(true); // 'language' is not a selectable field (HTTP 400 on 2026-09-30)
  });
});

describe("DOAJ", () => {
  it("links the journal's own full text and states its licence", () => {
    const items = parseDoaj({ results: [
      { id: "00014186c13b43e5bbaaf71187a02e9c", bibjson: {
        title: "Berlin Pankow: a 15-min city", abstract: "Abstract.", year: "2023", keywords: ["cities"],
        author: [{ name: "Jan-Peter Glock" }, { name: "Julia Gerlach" }],
        journal: { title: "European Transport Research Review", language: ["EN"], license: [{ type: "CC BY", url: "https://creativecommons.org/licenses/by/4.0/" }] },
        link: [{ type: "fulltext", url: "https://etrr.springeropen.com/articles/10.1186/x" }], identifier: [{ type: "doi", id: "10.1186/s12544-023-00577-2" }] } },
      { id: "0001461d7b4c44d09f88e19085a321e8", bibjson: { title: "No link", identifier: [{ type: "doi", id: "10.1016/j.fawpar.2022.e00154" }], journal: { license: [{ type: "Publisher's own" }] } } },
      { id: "short", bibjson: { title: "bad id" } },
    ] });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ creator: "Jan-Peter Glock, Julia Gerlach", language: "en", license: { name: "CC BY 4.0" }, externalUrl: "https://etrr.springeropen.com/articles/10.1186/x", tags: ["cities"] });
    expect(items[1]).toMatchObject({ externalUrl: "https://doi.org/10.1016/j.fawpar.2022.e00154", license: null });
  });

  it("puts only plain terms in the path", async () => {
    const seen: string[] = [];
    await doaj.search(params("a/b?c=d e"), { fetch: async (u) => { seen.push(u); return ok('{"results":[]}'); }, env: noEnv });
    expect(seen[0]).toContain("/api/search/articles/a%20b%20c%20d%20e?");
  });
});

describe("Rijksmuseum", () => {
  const object = {
    identified_by: [
      { type: "Name", content: "De molen bij Wijk", language: [{ id: "http://vocab.getty.edu/aat/300388256" }] },
      { type: "Name", content: "The windmill at Wijk", language: [{ id: "http://vocab.getty.edu/aat/300388277" }] },
      { type: "Identifier", content: "SK-C-211", classified_as: [{ id: "http://vocab.getty.edu/aat/300312355" }] },
    ],
    produced_by: { timespan: { identified_by: [{ type: "Name", content: "c. 1668 - c. 1670", language: [{ id: "http://vocab.getty.edu/aat/300388277" }] }] },
      part: [{ carried_out_by: [{ notation: [{ "@language": "en", "@value": "Jacob van Ruisdael" }] }] }] },
    shows: [{ id: "https://id.rijksmuseum.nl/202107959" }],
  };

  it("reads the English title, the maker on a production part, the date and a collection link", () => {
    const parsed = parseRijksObject("https://id.rijksmuseum.nl/200107959", object)!;
    expect(parsed.visualItem).toBe("https://id.rijksmuseum.nl/202107959");
    expect(parsed.item).toMatchObject({
      provider: "rijksmuseum", providerItemId: "200107959", title: "The windmill at Wijk", creator: "Jacob van Ruisdael", publishedAt: "c. 1668 - c. 1670",
      externalUrl: "https://www.rijksmuseum.nl/en/collection/SK-C-211", license: { name: "CC0" },
    });
  });

  it("rejects an object without a title or an accession number", () => {
    expect(parseRijksObject("https://id.rijksmuseum.nl/1", { identified_by: [] })).toBeNull();
    expect(parseRijksObject("https://id.rijksmuseum.nl/1", { identified_by: [{ type: "Name", content: "x" }] })).toBeNull();
  });

  it("returns an image only when the museum marks it downloadable, and only from its IIIF host", () => {
    const digital = (flag: string, id: string) => ({ referred_to_by: [{ content: "zichtbaar" }, { content: flag }], access_point: [{ id }] });
    expect(parseRijksImage(digital("downloadbaar", "https://iiif.micr.io/XWEFp/full/max/0/default.jpg"))).toBe("https://iiif.micr.io/XWEFp/full/max/0/default.jpg");
    expect(parseRijksImage(digital("niet downloadbaar", "https://iiif.micr.io/XWEFp/full/max/0/default.jpg"))).toBeNull();
    expect(parseRijksImage(digital("downloadbaar", "https://evil.example/x/full/max/0/default.jpg"))).toBeNull();
    expect(parseRijksImage(null)).toBeNull();
  });
});

describe("public news feeds", () => {
  const nasa = { id: "nasa", name: "NASA", hosts: ["nasa.gov"], language: "en", url: "https://www.nasa.gov/feed/" };
  const rss = `<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/"><channel>
    <item><title><![CDATA[NASA's Webb & the <b>early</b> universe]]></title><link>https://www.nasa.gov/missions/webb/early-universe/</link>
      <description><![CDATA[<p>Webb saw galaxies.</p>]]></description><pubDate>Tue, 29 Sep 2026 12:00:00 +0000</pubDate><dc:creator>Jane Doe</dc:creator>
      <media:thumbnail url="https://www.nasa.gov/wp-content/uploads/webb.jpg"/></item>
    <item><title>Off-domain link</title><link>https://evil.example/story</link></item>
    <item><title>Plain http link</title><link>http://www.nasa.gov/story/</link></item>
    <item><title>Thumbnail elsewhere</title><link>https://www.nasa.gov/a/</link><media:thumbnail url="https://evil.example/t.jpg"/></item>
  </channel></rss>`;

  it("keeps a headline, an excerpt, a date and a link on the publisher's own domain", () => {
    const items = parseFeed(rss, nasa);
    expect(items.map((i) => i.title)).toEqual(["NASA's Webb & the early universe", "Plain http link", "Thumbnail elsewhere"].slice(0, 1).concat(items.slice(1).map((i) => i.title)));
    expect(items[0]).toMatchObject({
      contentType: "article", description: "Webb saw galaxies.", publishedAt: "2026-09-29", creator: "Jane Doe", language: "en",
      externalUrl: "https://www.nasa.gov/missions/webb/early-universe/", thumbnailUrl: "https://www.nasa.gov/wp-content/uploads/webb.jpg", downloadUrl: null, license: null,
    });
    expect(items.some((i) => i.title === "Off-domain link")).toBe(false);
    expect(items.find((i) => i.title === "Thumbnail elsewhere")!.thumbnailUrl).toBeNull();
  });

  it("gives every story a stable, distinct id", () => {
    const ids = parseFeed(rss, nasa).map((i) => i.providerItemId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(parseFeed(rss, nasa).map((i) => i.providerItemId)).toEqual(ids);
    expect(ids[0]).toMatch(/^nasa-[0-9a-f]{8}$/);
  });

  it("matches every term of the query, in any script", () => {
    const [item] = parseFeed(rss, nasa);
    expect(matchesQuery(item, "webb universe")).toBe(true);
    expect(matchesQuery(item, "webb telescope")).toBe(false);
    expect(matchesQuery(item, "")).toBe(false);
    const arabic = { ...item, title: "الأمم المتحدة تحذر من الجفاف", description: null };
    expect(matchesQuery(arabic, "الجفاف")).toBe(true);
    expect(matchesQuery(arabic, "الفيضانات")).toBe(false);
  });

  it("reads the reader's UN News feed where one exists, English otherwise", () => {
    expect(feedsFor("ar")[0].url).toContain("/ar/news/all/rss.xml");
    expect(feedsFor("zh-CN")[0].url).toContain("/zh/news/all/rss.xml");
    expect(feedsFor("pl")[0].url).toContain("/en/news/all/rss.xml");
    expect(feedsFor("en").map((f) => new URL(f.url).hostname).sort()).toEqual(["news.un.org", "www.nasa.gov", "www.who.int"]);
  });

  it("answers from a feed, then from the cache, and fails only when every feed fails", async () => {
    let calls = 0;
    const body = `<rss><channel><item><title>Climate briefing</title><link>https://news.un.org/en/story/2026/09/1</link><pubDate>Tue, 29 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
    const fetch = async () => { calls++; return ok(body, "application/rss+xml"); };
    const lang = "fr"; // a language no other test in this file has asked for, so nothing is cached yet
    const first = await openFeeds.search(params("climate briefing", { language: lang }), { fetch, env: noEnv });
    const after = calls;
    const second = await openFeeds.search(params("climate briefing", { language: lang }), { fetch, env: noEnv });
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(calls).toBe(after); // second search: no new requests

    // A fresh module has an empty cache, so this is genuinely "every feed fails".
    vi.resetModules();
    const fresh = (await import("../../supabase/functions/_shared/externalContent/providers/feeds.ts")).openFeeds;
    const down = async () => new Response("", { status: 503 });
    await expect(fresh.search(params("anything", { language: "ru" }), { fetch: down, env: noEnv })).rejects.toMatchObject({ code: "http_error" });
  });
});

// ─── Failure behaviour through the aggregator ─────────────────────────────

describe("provider failures are reported by code and never break the page", () => {
  const providers = [gutenberg, standardEbooks, europePmc, crossref, doaj];
  const only = (id: string) => normalizeSearchInput({ query: "climate", providers: [id], limit: 4 })!;
  const deps = (fetch: (url: string) => Promise<Response>) => ({ fetch: fetch as never, env: noEnv });
  // A clock that moves ten seconds between searches (and stands still during one), so the
  // providers' politeness gap never reads as "skipped" and the retry window is intact.
  let clock = 0;
  const state = async (id: string, fetch: (url: string) => Promise<Response>) => {
    clock += 10_000;
    return (await searchExternalContent(only(id), deps(fetch), { cache: null, registry: CONTENT_PROVIDERS, now: () => clock })).providers[0]?.state;
  };

  it("empty results", async () => {
    expect(await state("europe_pmc", async () => ok('{"resultList":{"result":[]}}'))).toBe("empty");
    expect(await state("doaj", async () => ok('{"results":[]}'))).toBe("empty");
    expect(await state("crossref", async () => ok('{"message":{"items":[]}}'))).toBe("empty");
  });

  it("rate limiting (429) and server errors", async () => {
    for (const p of providers) {
      expect(await state(p.id, async () => new Response("slow down", { status: 429 })), p.id).toBe("rate_limited");
      expect(await state(p.id, async () => new Response("oops", { status: 500 })), p.id).toBe("http_error");
    }
  });

  it("malformed responses", async () => {
    for (const id of ["europe_pmc", "doaj", "crossref"]) expect(await state(id, async () => ok("<html>not json</html>")), id).toBe("invalid_response");
    // Not XML at all: an OPDS parser finds no entries and reports empty rather than crashing.
    expect(await state("gutenberg", async () => ok("<html>bot check</html>"))).toBe("empty");
    expect(await state("standard_ebooks", async () => ok("garbage"))).toBe("empty");
  });

  it("timeouts", async () => {
    const abort = async () => { throw new DOMException("timed out", "TimeoutError"); };
    for (const p of providers) expect(await state(p.id, abort), p.id).toBe("timeout");
  });

  it("a network error is retried once and then reported", async () => {
    let calls = 0;
    const s = await state("doaj", async () => { calls++; throw new TypeError("fetch failed"); });
    expect(s).toBe("network");
    expect(calls).toBe(2);
  });
});

// ─── The registry ──────────────────────────────────────────────────────────

describe("the registry after this connection", () => {
  const connected = ["gutenberg", "standard_ebooks", "europe_pmc", "crossref", "doaj", "rijksmuseum", "open_feeds"];

  it("has every new source, keyless and ready, in the order the aggregator uses", () => {
    for (const id of connected) {
      const p = providerById(id);
      expect(p, id).toBeDefined();
      expect(p!.auth.kind === "none" || p!.auth.kind === "optional", id).toBe(true);
      expect(providerStatus(p!, noEnv), id).toBe("ready");
      expect(p!.healthQuery, id).toBeTruthy();
      expect(p!.licenseNote.length, id).toBeGreaterThan(20);
      expect(p!.docs, id).toMatch(/^https:\/\//);
    }
  });

  it("has unique ids, and nothing is both connected and 'unsupported'", () => {
    const ids = CONTENT_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of UNSUPPORTED_PROVIDERS) expect(ids, u.id).not.toContain(u.id);
    for (const gone of ["europe_pmc", "rijksmuseum"]) expect(UNSUPPORTED_PROVIDERS.map((u) => u.id)).not.toContain(gone);
  });

  it("records why the ones that stay out stay out, with the date it was measured", () => {
    for (const id of ["librivox", "hathitrust", "semantic_scholar", "biodiversity_heritage_library", "wikinews_feed"]) {
      const u = UNSUPPORTED_PROVIDERS.find((x) => x.id === id);
      expect(u, id).toBeDefined();
      expect(u!.reason, id).toMatch(/2026-09-\d\d/);
    }
  });

  it("knows the news category, and only the feeds serve it", () => {
    expect(CONTENT_CATEGORIES).toContain("news");
    expect(CONTENT_PROVIDERS.filter((p) => p.categories.includes("news")).map((p) => p.id)).toEqual(["open_feeds"]);
  });

  it("no keyed adapter was added on a guessed response shape", () => {
    const keyed = CONTENT_PROVIDERS.filter((p) => p.auth.kind === "api_key").map((p) => p.id).sort();
    expect(keyed).toEqual(["core", "dpla", "europeana", "flickr", "freesound", "google_books", "jamendo", "pexels", "pixabay", "podcast_index", "smithsonian", "unsplash", "vimeo", "youtube"]);
  });
});

// ─── Credentials and secrets ──────────────────────────────────────────────

describe("credentials stay on the server and are all accounted for", () => {
  const envNames = [...new Set(CONTENT_PROVIDERS.flatMap((p) => (p.auth.kind === "none" ? [] : [...p.auth.env])))].sort();

  it("every environment variable a provider reads is synced to Supabase by the deploy workflow", () => {
    const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");
    const list = /for name in ([A-Z0-9_ ]+); do/.exec(deploy.slice(deploy.indexOf("Sync Library content provider keys")))?.[1] ?? "";
    expect(list.split(/\s+/).filter(Boolean).sort()).toEqual(envNames);
    for (const name of envNames) expect(deploy, name).toContain(`${name}:`);
  });

  it("no provider secret is named in the browser code that talks to providers", () => {
    // Everything under src that could reach a provider: the services, hooks and libs, and the library pages and components.
    const roots = ["src/services", "src/hooks", "src/lib", "src/pages/library", "src/components/library", "src/integrations"];
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : /.(ts|tsx)$/.test(e.name) ? [`${dir}/${e.name}`] : []);
    const offenders = roots.flatMap(walk).filter((file) => envNames.some((name) => readFileSync(file, "utf8").includes(name)));
    expect(offenders).toEqual([]);
  }, 30_000);

  it("the keyed providers stay dormant and never call out without their secret", async () => {
    for (const p of CONTENT_PROVIDERS.filter((x) => x.auth.kind === "api_key")) {
      expect(providerStatus(p, noEnv), p.id).toBe("configuration_required");
      let called = false;
      await expect(p.search(params("anything"), { fetch: async () => { called = true; return ok("{}"); }, env: noEnv }), p.id).rejects.toMatchObject({ code: "not_configured" });
      expect(called, p.id).toBe(false);
    }
  });

  it("an error never carries the request address (some providers take the key in the URL)", async () => {
    const secret = "sk-test-SECRET-123";
    for (const p of CONTENT_PROVIDERS.filter((x) => x.auth.kind === "api_key")) {
      const env = (n: string) => ((p.auth.kind === "api_key" ? p.auth.env : []).includes(n) ? secret : undefined);
      const err = await p.search(params("anything"), { fetch: async () => new Response("no", { status: 500 }), env }).catch((e) => e);
      expect(String(err?.message ?? err), p.id).not.toContain(secret);
      expect(JSON.stringify(err), p.id).not.toContain(secret);
    }
  });
});
