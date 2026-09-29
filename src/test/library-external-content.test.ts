import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  checkProviderHealth, normalizeSearchInput, resolveExternalItem, ResultCache, searchExternalContent,
} from "../../supabase/functions/_shared/externalContent/aggregate.ts";
import { dedupeKeys, mergeResults, selectProviders } from "../../supabase/functions/_shared/externalContent/aggregate.ts";
import { embeds, isAllowedEmbed } from "../../supabase/functions/_shared/externalContent/embed.ts";
import { allowsRedistribution, clean, httpsUrl, licenseFromUrl, makeItem, ProviderError } from "../../supabase/functions/_shared/externalContent/http.ts";
import { CONTENT_PROVIDERS, UNSUPPORTED_PROVIDERS, providerStatus, summarizeProviders } from "../../supabase/functions/_shared/externalContent/registry.ts";
import { archiveQuery, parseArchive, parseNasaAsset, parseNasaSearch, nasa } from "../../supabase/functions/_shared/externalContent/providers/archives.ts";
import { parseDoab, parseGutendex, parseOpenLibrary, matchOpenStax } from "../../supabase/functions/_shared/externalContent/providers/books.ts";
import { parseCkan } from "../../supabase/functions/_shared/externalContent/providers/data.ts";
import { parsePexelsPhotos, parseUnsplash, parseYouTube, podcastIndex, unsplash, youtube } from "../../supabase/functions/_shared/externalContent/providers/keyed.ts";
import { parseDailymotion, parsePodcastLookup, parseRadioBrowser } from "../../supabase/functions/_shared/externalContent/providers/media.ts";
import { parseArtic, parseCleveland, parseMetObject } from "../../supabase/functions/_shared/externalContent/providers/museums.ts";
import { parseOpenverse } from "../../supabase/functions/_shared/externalContent/providers/openverse.ts";
import { parseArxiv } from "../../supabase/functions/_shared/externalContent/providers/scholarly.ts";
import { parseCommons, parseMediaWikiSearch } from "../../supabase/functions/_shared/externalContent/providers/wikimedia.ts";
import type { ContentProvider, ExternalContentItem } from "../../supabase/functions/_shared/externalContent/types.ts";

// Payloads are trimmed copies of what each API returned on 2026-09-29.

const noEnv = () => undefined;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function fakeProvider(id: string, impl: ContentProvider["search"], extra: Partial<ContentProvider> = {}): ContentProvider {
  return {
    id, name: id, homepage: "https://example.org", docs: "https://example.org/docs", categories: ["images"],
    auth: { kind: "none" }, capabilities: { search: true, preview: true, embed: false, download: false },
    licenseNote: "", rateLimit: "", search: impl, ...extra,
  };
}

const item = (provider: string, id: string, over: Partial<ExternalContentItem> = {}) =>
  makeItem(provider, { provider, providerItemId: id, title: `Item ${id}`, contentType: "image", externalUrl: `https://${provider}.example/${id}`, ...over });

describe("registry", () => {
  it("has unique ids, https docs, and every keyed provider names its secrets", () => {
    const ids = [...CONTENT_PROVIDERS.map((p) => p.id), ...UNSUPPORTED_PROVIDERS.map((p) => p.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of CONTENT_PROVIDERS) {
      expect(p.docs, p.id).toMatch(/^https:\/\//);
      expect(p.homepage, p.id).toMatch(/^https:\/\//);
      expect(p.categories.length, p.id).toBeGreaterThan(0);
      if (p.auth.kind !== "none") expect(p.auth.env.every((e) => /^[A-Z][A-Z0-9_]+$/.test(e)), p.id).toBe(true);
    }
    for (const u of UNSUPPORTED_PROVIDERS) expect(u.reason.length, u.id).toBeGreaterThan(30);
  });

  it("reports keyless providers ready and keyed ones configuration_required until their secret is set", () => {
    const summary = summarizeProviders(noEnv);
    const ready = summary.filter((p) => p.status === "ready").map((p) => p.id);
    expect(ready).toEqual(expect.arrayContaining(["wikimedia_commons", "openverse", "nasa", "internet_archive", "gutenberg", "openstax", "radio_browser", "hdx"]));
    const yt = summary.find((p) => p.id === "youtube")!;
    expect(yt.status).toBe("configuration_required");
    expect(yt.missingEnv).toEqual(["YOUTUBE_API_KEY"]);
    expect(providerStatus(youtube, (n) => (n === "YOUTUBE_API_KEY" ? "abc" : undefined))).toBe("ready");
    // Both halves of a two-part credential are required.
    expect(providerStatus(podcastIndex, (n) => (n === "PODCASTINDEX_API_KEY" ? "k" : undefined))).toBe("configuration_required");
  });

  it("never puts a secret value in the summary it sends to the browser", () => {
    const summary = JSON.stringify(summarizeProviders((n) => `secret-value-of-${n}`));
    expect(summary).not.toContain("secret-value-of");
    expect(summary).not.toContain("\"search\":{}");
  });

  it("has at least 20 keyless providers and does not list a fake OPENLIBRARY key", () => {
    expect(CONTENT_PROVIDERS.filter((p) => p.auth.kind !== "api_key").length).toBeGreaterThanOrEqual(20);
    const envs = CONTENT_PROVIDERS.flatMap((p) => (p.auth.kind === "none" ? [] : p.auth.env));
    expect(envs).not.toContain("OPENLIBRARY_API_KEY");
  });
});

describe("sanitisers", () => {
  it("only lets https URLs through, upgrading known hosts", () => {
    expect(httpsUrl("javascript:alert(1)")).toBeNull();
    expect(httpsUrl("data:text/html,x")).toBeNull();
    expect(httpsUrl("http://evil.example/x.jpg")).toBeNull();
    expect(httpsUrl("https://user:pw@example.org/")).toBeNull();
    expect(httpsUrl("http://images-assets.nasa.gov/a.mp4")).toBe("https://images-assets.nasa.gov/a.mp4");
    expect(httpsUrl("//upload.wikimedia.org/a.jpg")).toBe("https://upload.wikimedia.org/a.jpg");
  });

  it("strips markup and decodes entities", () => {
    expect(clean("<b>Tom</b> &amp; <a href='x'>Jerry</a>")).toBe("Tom & Jerry");
    expect(clean(42)).toBe("");
  });

  it("names Creative Commons licences from their URL and never invents one", () => {
    expect(licenseFromUrl("https://creativecommons.org/licenses/by-sa/4.0/")).toEqual({ name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" });
    expect(licenseFromUrl("http://creativecommons.org/publicdomain/zero/1.0/")?.name).toBe("CC0 1.0");
    expect(licenseFromUrl("http://creativecommons.org/publicdomain/mark/1.0/")?.name).toBe("Public Domain Mark");
    expect(licenseFromUrl(undefined)).toBeNull();
    expect(allowsRedistribution({ name: "CC BY-NC-ND 3.0", url: null })).toBe(true);
    expect(allowsRedistribution({ name: "Unsplash License", url: null })).toBe(false);
    expect(allowsRedistribution(null)).toBe(false);
  });

  it("allows iframes only from official players built from ids", () => {
    expect(isAllowedEmbed(embeds.youtube("dQw4w9WgXcQ"))).toBe(true);
    expect(isAllowedEmbed(embeds.archive("some_item-1.2"))).toBe(true);
    expect(isAllowedEmbed(embeds.dailymotion("x7y712w"))).toBe(true);
    expect(isAllowedEmbed(embeds.vimeo("123456"))).toBe(true);
    expect(isAllowedEmbed(embeds.googleBooks("abc_DEF-12"))).toBe(true);
    expect(embeds.youtube("bad id")).toBeNull();
    expect(embeds.archive("../../etc")).toBeNull();
    expect(isAllowedEmbed("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(false);
    expect(isAllowedEmbed("https://archive.org.evil.example/embed/x")).toBe(false);
    expect(isAllowedEmbed("http://archive.org/embed/x")).toBe(false);
    expect(isAllowedEmbed("javascript:alert(1)")).toBe(false);
  });
});

describe("normalisation", () => {
  it("Wikimedia Commons: licence, author and file from extmetadata; audio icons are not thumbnails", () => {
    const [audio] = parseCommons({ query: { pages: { 341506: {
      pageid: 341506, index: 1, title: "File:Wikijunior Solar System-Pluto.ogg",
      imageinfo: [{ size: 3040308, duration: 343.58, mime: "application/ogg",
        url: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Wikijunior_Solar_System-Pluto.ogg",
        thumburl: "https://commons.wikimedia.org/w/resources/assets/file-type-icons/fileicon-ogg.png",
        descriptionurl: "https://commons.wikimedia.org/wiki/File:Wikijunior_Solar_System-Pluto.ogg",
        extmetadata: { LicenseShortName: { value: "CC BY-SA 3.0" }, LicenseUrl: { value: "http://creativecommons.org/licenses/by-sa/3.0/" },
          Artist: { value: "<p><b>Speaker:</b> <a href=\"//commons.wikimedia.org/wiki/User:P\">Polyparadigm</a></p>" } } }],
    } } } });
    expect(audio).toMatchObject({
      id: "wikimedia_commons:341506", title: "Wikijunior Solar System-Pluto", contentType: "audio", thumbnailUrl: null,
      license: { name: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/" }, creator: "Speaker: Polyparadigm", durationSeconds: 343.58,
    });
    expect(audio.previewUrl).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
    expect(audio.downloadUrl).toBe(audio.previewUrl);
    expect(audio.attribution).toBe("Speaker: Polyparadigm, CC BY-SA 3.0, via Wikimedia Commons");
  });

  it("Wikipedia and friends: site licence for article text, none claimed for Wikisource", () => {
    const hit = { query: { search: [{ title: "Solar System", pageid: 1, snippet: "The <span>Solar</span> System", timestamp: "2026-01-02T00:00:00Z" }] } };
    const [wiki] = parseMediaWikiSearch(hit, { id: "wikipedia", name: "Wikipedia", project: "wikipedia", contentType: "article" }, "ar");
    expect(wiki.externalUrl).toBe("https://ar.wikipedia.org/wiki/Solar_System");
    expect(wiki.license?.name).toBe("CC BY-SA 4.0");
    const [source] = parseMediaWikiSearch(hit, { id: "wikisource", name: "Wikisource", project: "wikisource", contentType: "book" }, "en");
    expect(source.license).toBeNull();
  });

  it("Openverse: licence code and version, attribution line, milliseconds to seconds", () => {
    const [track] = parseOpenverse({ results: [{
      id: "26e0febd-60e0-4ed4-a4c9-e6014ca53ad9", title: "Solar System", foreign_landing_url: "https://www.jamendo.com/track/132510",
      url: "https://prod-1.storage.jamendo.com/?trackid=132510&format=mp32", creator: "Jamison Young", license: "by", license_version: "2.5",
      license_url: "https://creativecommons.org/licenses/by/2.5/au/", source: "jamendo", filetype: "mp32", duration: 281000,
      attribution: "\"Solar System\" by Jamison Young is licensed under CC BY 2.5.", thumbnail: "https://api.openverse.org/v1/audio/x/thumb/",
    }] }, "audio");
    expect(track).toMatchObject({ provider: "openverse", contentType: "audio", mimeType: "audio/mpeg", durationSeconds: 281, license: { name: "CC BY 2.5" }, publisher: "jamendo" });
    expect(track.attribution).toContain("Jamison Young");
  });

  it("Internet Archive: embeds from the identifier, licence only when the item states one", () => {
    const items = parseArchive({ response: { docs: [
      { identifier: "lifeletters_2507_librivox", title: "Life and Letters", mediatype: "audio", licenseurl: "http://creativecommons.org/publicdomain/mark/1.0/", creator: ["LibriVox"] },
      { identifier: "bad id with spaces", title: "x", mediatype: "movies" },
      { identifier: "picture1", title: "Picture", mediatype: "image" },
    ] } });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ embedUrl: "https://archive.org/embed/lifeletters_2507_librivox", license: { name: "Public Domain Mark" }, creator: "LibriVox" });
    expect(items[0].downloadUrl).toBe("https://archive.org/download/lifeletters_2507_librivox");
    expect(items[1]).toMatchObject({ embedUrl: null, license: null, downloadUrl: null });
  });

  it("Internet Archive: the query keeps licensed items only and cannot be widened by the reader", () => {
    expect(archiveQuery("moon", ["audio"])).toBe("(moon) AND mediatype:(audio OR etree) AND licenseurl:*");
    expect(archiveQuery("x) OR (mediatype:texts", ["video"])).toBe("(x mediatype texts) AND mediatype:(movies) AND licenseurl:*");
    expect(archiveQuery("moon", ["data"])).toBeNull();
  });

  it("NASA: images play at once; video resolves to its files and captions", () => {
    const entry = {
      data: [{ nasa_id: "GSFC_Solar", media_type: "video", title: "Where is the Edge of the Solar System?", center: "GSFC", date_created: "2017-09-17T00:00:00Z", keywords: ["Sun"] }],
      links: [{ href: "https://images-assets.nasa.gov/video/GSFC_Solar/GSFC_Solar~thumb.jpg", render: "image", width: 400 }],
    };
    const [video] = parseNasaSearch({ collection: { items: [entry] } });
    expect(video).toMatchObject({ needsResolve: true, previewUrl: null, attribution: "NASA/GSFC", license: null });
    const files = parseNasaAsset({ collection: { items: [
      { href: "http://images-assets.nasa.gov/video/GSFC_Solar/GSFC_Solar~orig.mp4" },
      { href: "http://images-assets.nasa.gov/video/GSFC_Solar/GSFC_Solar~mobile.mp4" },
      { href: "http://images-assets.nasa.gov/video/GSFC_Solar/GSFC_Solar.vtt" },
    ] } });
    expect(files).toHaveLength(3);
  });

  it("museums: public-domain objects only, CC0, alt text kept", () => {
    expect(parseMetObject({ objectID: 1, isPublicDomain: false, primaryImageSmall: "https://images.metmuseum.org/a.jpg", objectURL: "https://www.metmuseum.org/art/collection/search/1", title: "Now!" })).toBeNull();
    const met = parseMetObject({ objectID: 2, isPublicDomain: true, primaryImageSmall: "https://images.metmuseum.org/s.jpg", primaryImage: "https://images.metmuseum.org/l.jpg", objectURL: "https://www.metmuseum.org/art/collection/search/2", title: "Regulator", artistDisplayName: "Anon" });
    expect(met).toMatchObject({ license: { name: "CC0" }, downloadUrl: "https://images.metmuseum.org/l.jpg" });

    const [art] = parseArtic({ config: { iiif_url: "https://www.artic.edu/iiif/2" }, data: [
      { id: 633, title: "Amulet of a Reclining Cow", is_public_domain: true, image_id: "0711c714-656e-d52a-eaa4-024205527a60", artist_display: "Egyptian\nPtolemaic", thumbnail: { alt_text: "A small blue faience cow." } },
      { id: 9, title: "In copyright", is_public_domain: false, image_id: "0711c714-656e-d52a-eaa4-024205527a61" },
    ] });
    expect(art.altText).toBe("A small blue faience cow.");
    expect(art.previewUrl).toBe("https://www.artic.edu/iiif/2/0711c714-656e-d52a-eaa4-024205527a60/full/843,/0/default.jpg");
    expect(parseArtic({ data: [{ id: 9, title: "x", is_public_domain: false, image_id: "0711c714-656e-d52a-eaa4-024205527a61" }] })).toHaveLength(0);

    const cma = parseCleveland({ data: [{ id: 137057, title: "Sun Bodhisattva", url: "https://clevelandart.org/art/1961.48", share_license_status: "CC0",
      images: { web: { url: "https://openaccess-cdn.clevelandart.org/1961.48/1961.48_web.jpg" }, print: { url: "https://openaccess-cdn.clevelandart.org/1961.48/1961.48_print.jpg", filesize: "4384110" } }, creators: [] }] });
    expect(cma[0]).toMatchObject({ license: { name: "CC0" }, sizeBytes: 4384110 });
  });

  it("books: public-domain scans embed, lending-only books only link", () => {
    const [pub, lend] = parseOpenLibrary({ docs: [
      { key: "/works/OL1W", title: "Frankenstein", ebook_access: "public", ia: ["frankenstein00shel"], cover_i: 12, author_name: ["Mary Shelley"], first_publish_year: 1818 },
      { key: "/works/OL2W", title: "Modern book", ebook_access: "borrowable", ia: ["modern00"] },
    ] });
    expect(pub).toMatchObject({ embedUrl: "https://archive.org/embed/frankenstein00shel", thumbnailUrl: "https://covers.openlibrary.org/b/id/12-M.jpg", publishedAt: "1818" });
    expect(lend.embedUrl).toBeNull();

    const [pg, copyrighted] = parseGutendex({ results: [
      { id: 84, title: "Frankenstein", copyright: false, authors: [{ name: "Shelley, Mary" }], languages: ["en"], formats: { "application/epub+zip": "https://www.gutenberg.org/ebooks/84.epub3.images", "image/jpeg": "https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg" } },
      { id: 99, title: "Later work", copyright: true, formats: { "application/epub+zip": "https://www.gutenberg.org/ebooks/99.epub3.images" } },
    ] });
    expect(pg).toMatchObject({ downloadUrl: "https://www.gutenberg.org/ebooks/84.epub3.images", license: { name: "Public domain in the USA" } });
    expect(copyrighted).toMatchObject({ downloadUrl: null, license: null });

    const [doab] = parseDoab([{ handle: "20.500.12854/95791", name: "Solar", metadata: [
      { key: "dc.title", value: "Challenge and Research Trends of Solar Concentrators" }, { key: "dc.contributor.editor", value: "Liang, Dawei" },
      { key: "publisher.name", value: "MDPI" }, { key: "dc.date.issued", value: "2022" },
    ], bitstreams: [{ uuid: "00ab29a7-49ec-485e-9731-f309a01c1b06", bundleName: "THUMBNAIL", metadata: [{ key: "dc.rights.uri", value: "https://creativecommons.org/licenses/by/4.0/" }] }] }]);
    expect(doab).toMatchObject({ license: { name: "CC BY 4.0" }, publisher: "MDPI", externalUrl: "https://directory.doabooks.org/handle/20.500.12854/95791" });

    const books = matchOpenStax([
      { title: "Biology 2e", book_state: "live", meta: { slug: "biology-2e" }, license_name: "Creative Commons Attribution License", license_url: "https://creativecommons.org/licenses/by/4.0/", high_resolution_pdf_url: "https://assets.openstax.org/b.pdf" },
      { title: "Retired Biology", book_state: "retired", meta: { slug: "old-bio" } },
      { title: "Calculus", book_state: "live", meta: { slug: "calculus" }, description: "limits" },
    ], "biology");
    expect(books.map((b) => b.providerItemId)).toEqual(["biology-2e"]);
    expect(books[0].downloadUrl).toBe("https://assets.openstax.org/b.pdf");
  });

  it("media: Dailymotion honours allow_embed; radio keeps https non-HLS streams only; podcasts resolve to an https episode", () => {
    const [ok, blocked] = parseDailymotion({ list: [
      { id: "x7y712w", title: "Solar system", allow_embed: true, duration: 281, created_time: 1608437895 },
      { id: "x1", title: "No embed", allow_embed: false },
    ] });
    expect(ok.embedUrl).toBe("https://www.dailymotion.com/embed/video/x7y712w");
    expect(blocked.embedUrl).toBeNull();

    const radio = parseRadioBrowser([
      { stationuuid: "f7fd408e-02a5-49a1-8c03-078727e97e8f", name: "Quran Radio", url_resolved: "https://stream.example/live", hls: 0, lastcheckok: 1 },
      { stationuuid: "f7fd408e-02a5-49a1-8c03-078727e97e80", name: "HTTP only", url_resolved: "http://stream.example/live", hls: 0, lastcheckok: 1 },
      { stationuuid: "f7fd408e-02a5-49a1-8c03-078727e97e81", name: "HLS", url_resolved: "https://stream.example/live.m3u8", hls: 1, lastcheckok: 1 },
      { stationuuid: "f7fd408e-02a5-49a1-8c03-078727e97e82", name: "Broken", url_resolved: "https://x.example", hls: 0, lastcheckok: 0 },
    ]);
    expect(radio.map((r) => [r.title, !!r.previewUrl])).toEqual([["Quran Radio", true], ["HTTP only", false], ["HLS", false]]);

    const show = { kind: "podcast", collectionId: 192740136, collectionName: "Astronomy 161", collectionViewUrl: "https://podcasts.apple.com/us/podcast/astronomy-161/id192740136?uo=4" };
    const resolved = parsePodcastLookup({ results: [
      show,
      { wrapperType: "podcastEpisode", trackName: "Teaser", episodeUrl: "http://www.example.edu/teaser.mp3" },
      { wrapperType: "podcastEpisode", trackName: "Lecture 46", episodeUrl: "https://www.example.edu/l46.mp3", episodeFileExtension: "mp3", trackTimeMillis: 120000 },
    ] });
    expect(resolved).toMatchObject({ previewUrl: "https://www.example.edu/l46.mp3", mimeType: "audio/mpeg", durationSeconds: 120, needsResolve: false, externalUrl: "https://podcasts.apple.com/us/podcast/astronomy-161/id192740136" });
  });

  it("scholarly and data: arXiv Atom and CKAN records", () => {
    const [paper] = parseArxiv(`<feed><entry><id>http://arxiv.org/abs/2101.00001v2</id><published>2021-01-01T00:00:00Z</published>
      <title>Nanodust &amp; the Solar System</title><summary>Abstract.</summary><author><name>A. One</name></author><author><name>B. Two</name></author></entry></feed>`);
    expect(paper).toMatchObject({ providerItemId: "2101.00001", title: "Nanodust & the Solar System", creator: "A. One, B. Two", externalUrl: "https://arxiv.org/abs/2101.00001", publishedAt: "2021-01-01" });

    const [set] = parseCkan({ result: { results: [{ name: "nigeria-education", title: "Nigeria - Education", license_title: "Creative Commons Attribution International (CC BY)",
      license_url: "http://www.opendefinition.org/licenses/cc-by", organization: { title: "World Bank Group" },
      resources: [{ format: "CSV", url: "https://data.humdata.org/dataset/x/resource/y/download/data.csv", size: 853198 }] }] } },
    { id: "hdx", name: "Humanitarian Data Exchange", datasetBase: "https://data.humdata.org/dataset/" });
    expect(set).toMatchObject({ contentType: "dataset", mimeType: "text/csv", sizeBytes: 853198, publisher: "World Bank Group", externalUrl: "https://data.humdata.org/dataset/nigeria-education" });
    expect(set.downloadUrl).toMatch(/data\.csv$/);
  });

  it("keyed providers: parse their documented shapes and respect provider rules", () => {
    const [photo] = parseUnsplash({ results: [{ id: "Dwu85P9SOIk", alt_description: "a cat", urls: { small: "https://images.unsplash.com/s", regular: "https://images.unsplash.com/r" }, links: { html: "https://unsplash.com/photos/Dwu85P9SOIk" }, user: { name: "Jane" } }] });
    // Unsplash downloads must go through its tracking endpoint, so none is offered.
    expect(photo).toMatchObject({ altText: "a cat", downloadUrl: null, attribution: "Photo by Jane on Unsplash" });
    const [pexel] = parsePexelsPhotos({ photos: [{ id: 1, url: "https://www.pexels.com/photo/1/", alt: "forest", photographer: "Sam", src: { medium: "https://images.pexels.com/m", large: "https://images.pexels.com/l", original: "https://images.pexels.com/o" } }] });
    expect(pexel.downloadUrl).toBe("https://images.pexels.com/o");
    const [video] = parseYouTube({ items: [{ id: { videoId: "dQw4w9WgXcQ" }, snippet: { title: "Photosynthesis", channelTitle: "Edu" } }, { id: { videoId: "bad" }, snippet: { title: "x" } }] });
    expect(video.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(video.downloadUrl).toBeNull();
  });
});

describe("aggregation", () => {
  const input = normalizeSearchInput({ query: "  solar   system ", language: "ar-LB", page: 99, limit: 50 })!;

  it("clamps what the caller sends", () => {
    expect(input).toMatchObject({ query: "solar system", language: "ar", page: 20, limit: 12, categories: [], providers: [] });
    expect(normalizeSearchInput({ query: " a " })).toBeNull();
    expect(normalizeSearchInput({ query: "x".repeat(500) })!.query).toHaveLength(200);
    expect(normalizeSearchInput({ query: "ok", categories: ["images", "nonsense"], providers: ["nasa", "evil"] })).toMatchObject({ categories: ["images"], providers: ["nasa"] });
  });

  it("selects only ready providers that serve the requested category", () => {
    const audio = selectProviders(normalizeSearchInput({ query: "rain", categories: ["audio"] })!, noEnv).map((p) => p.id);
    expect(audio).toContain("wikimedia_commons");
    expect(audio).toContain("radio_browser");
    expect(audio).not.toContain("freesound"); // needs a key
    expect(audio).not.toContain("gutenberg"); // not audio
    const withKey = selectProviders(normalizeSearchInput({ query: "rain", categories: ["audio"] })!, (n) => (n === "FREESOUND_API_KEY" ? "k" : undefined)).map((p) => p.id);
    expect(withKey).toContain("freesound");
  });

  it("skips a failing, a slow and a throttled provider and still answers from the rest", async () => {
    const good = fakeProvider("good", async () => [item("good", "1"), item("good", "2")]);
    const broken = fakeProvider("broken", async () => { throw new ProviderError("http_error", 400); });
    const limited = fakeProvider("limited", async () => { throw new ProviderError("rate_limited", 429); });
    const hanging = fakeProvider("hanging", () => new Promise(() => {}));
    const errors: string[] = [];
    const result = await searchExternalContent(input, { fetch: vi.fn(), env: noEnv }, {
      registry: [good, broken, limited, hanging], cache: null, deadlineMs: 300, onProviderError: (p, c) => errors.push(`${p}:${c}`),
    });
    expect(result.items.map((i) => i.id)).toEqual(["good:1", "good:2"]);
    expect(Object.fromEntries(result.providers.map((p) => [p.provider, p.state]))).toEqual({ good: "ok", broken: "http_error", limited: "rate_limited", hanging: "timeout" });
    expect(errors.sort()).toEqual(["broken:http_error", "hanging:timeout", "limited:rate_limited"]);
  });

  it("retries a network failure once, but never a rate limit", async () => {
    let flaky = 0;
    let limited = 0;
    const result = await searchExternalContent(input, { fetch: vi.fn(), env: noEnv }, {
      cache: null,
      registry: [
        fakeProvider("flaky", async () => { if (flaky++ === 0) throw new TypeError("fetch failed"); return [item("flaky", "1")]; }),
        fakeProvider("limited", async () => { limited++; throw new ProviderError("rate_limited", 429); }),
      ],
    });
    expect(flaky).toBe(2);
    expect(limited).toBe(1);
    expect(result.providers.find((p) => p.provider === "flaky")?.state).toBe("ok");
  });

  it("never calls a provider whose key is missing", async () => {
    const search = vi.fn(async () => [item("keyed", "1")]);
    const keyed = fakeProvider("keyed", search, { auth: { kind: "api_key", env: ["SOME_KEY"] } });
    const result = await searchExternalContent(input, { fetch: vi.fn(), env: noEnv }, { registry: [keyed], cache: null });
    expect(search).not.toHaveBeenCalled();
    expect(result.providers).toEqual([]);
  });

  it("interleaves providers and drops the same work found twice", () => {
    const shared = "https://upload.wikimedia.org/a/b/Moon.jpg";
    const { items, duplicates } = mergeResults([
      [item("commons", "1", { previewUrl: shared }), item("commons", "2")],
      [item("openverse", "9", { previewUrl: shared }), item("openverse", "8")],
      [item("met", "5", { title: "Sunflowers", creator: "Vincent van Gogh" })],
      [item("artic", "6", { title: "Sunflowers!", creator: "Vincent  van Gogh" })],
    ]);
    expect(items.map((i) => i.id)).toEqual(["commons:1", "met:5", "commons:2", "openverse:8"]);
    expect(duplicates).toBe(2);
    // A bare title with no creator is not proof of sameness.
    expect(dedupeKeys(item("a", "1", { title: "Moon" })).some((k) => k.startsWith("work:"))).toBe(false);
  });

  it("serves repeat searches from a bounded, expiring cache", async () => {
    let now = 0;
    const cache = new ResultCache(1000, 2, () => now);
    const search = vi.fn(async () => [item("p", "1")]);
    const registry = [fakeProvider("p", search)];
    await searchExternalContent(input, { fetch: vi.fn(), env: noEnv }, { registry, cache });
    await searchExternalContent(input, { fetch: vi.fn(), env: noEnv }, { registry, cache });
    expect(search).toHaveBeenCalledTimes(1);
    now = 2000;
    await searchExternalContent(input, { fetch: vi.fn(), env: noEnv }, { registry, cache });
    expect(search).toHaveBeenCalledTimes(2);
    cache.set("a", []); cache.set("b", []); cache.set("c", []);
    expect(cache.size).toBe(2);
  });

  it("honours a provider's minimum interval between calls", async () => {
    const search = vi.fn(async () => [item("slowpoke", "1")]);
    const registry = [fakeProvider("slowpoke", search, { minIntervalMs: 60_000 })];
    const first = await searchExternalContent(input, { fetch: vi.fn(), env: noEnv }, { registry, cache: null });
    const second = await searchExternalContent(normalizeSearchInput({ query: "other" })!, { fetch: vi.fn(), env: noEnv }, { registry, cache: null });
    expect(first.providers[0].state).toBe("ok");
    expect(second.providers[0].state).toBe("skipped");
    expect(search).toHaveBeenCalledTimes(1);
  });
});

describe("keys and errors", () => {
  it("sends each secret the way its provider documents, and never leaks it into an error", async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      return json({ error: "nope" }, 403);
    });
    const env = (n: string) => ({ UNSPLASH_ACCESS_KEY: "UNSPLASH-SECRET", YOUTUBE_API_KEY: "YT-SECRET" } as Record<string, string>)[n];
    const params = { query: "cat", categories: [], language: "en", page: 1, limit: 3 } as const;
    const failures = await Promise.allSettled([unsplash.search(params, { fetch: fetchFn, env }), youtube.search(params, { fetch: fetchFn, env })]);
    expect(calls[0].headers.Authorization).toBe("Client-ID UNSPLASH-SECRET");
    expect(new URL(calls[1].url).searchParams.get("key")).toBe("YT-SECRET");
    for (const f of failures) {
      expect(f.status).toBe("rejected");
      const reason = (f as PromiseRejectedResult).reason as Error;
      expect(reason.message).toBe("http_error");
      expect(JSON.stringify({ m: reason.message, s: String(reason) })).not.toMatch(/SECRET/);
    }
  });

  it("a keyed adapter called without its key fails as not_configured without a request", async () => {
    const fetchFn = vi.fn();
    await expect(unsplash.search({ query: "cat", categories: [], language: "en", page: 1, limit: 3 }, { fetch: fetchFn, env: noEnv })).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("health: not_configured without a key, degraded on a rate limit, down on an error", async () => {
    expect((await checkProviderHealth(unsplash, { fetch: vi.fn(), env: noEnv })).state).toBe("not_configured");
    const limited = fakeProvider("l", async () => { throw new ProviderError("rate_limited", 429); });
    expect(await checkProviderHealth(limited, { fetch: vi.fn(), env: noEnv })).toMatchObject({ state: "degraded", errorCode: "rate_limited" });
    const down = fakeProvider("d", async () => { throw new TypeError("fetch failed"); });
    expect(await checkProviderHealth(down, { fetch: vi.fn(), env: noEnv })).toMatchObject({ state: "down", errorCode: "network" });
  });

  it("resolves a NASA video to files and fetches its captions server-side", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("/search?nasa_id=")) return json({ collection: { items: [{ data: [{ nasa_id: "GSFC_Solar", media_type: "video", title: "Edge", center: "GSFC" }], links: [] }] } });
      if (url.includes("/asset/")) return json({ collection: { items: [{ href: "http://images-assets.nasa.gov/video/GSFC_Solar/GSFC_Solar~mobile.mp4" }, { href: "http://images-assets.nasa.gov/video/GSFC_Solar/GSFC_Solar.vtt" }] } });
      if (url.endsWith(".vtt")) return new Response("WEBVTT\n\n00:00.000 --> 00:02.000\nHello");
      return json({}, 404);
    });
    const resolved = await resolveExternalItem("nasa:GSFC_Solar", { fetch: fetchFn, env: noEnv });
    expect(resolved).toMatchObject({ previewUrl: "https://images-assets.nasa.gov/video/GSFC_Solar/GSFC_Solar~mobile.mp4", captionsUrl: "https://images-assets.nasa.gov/video/GSFC_Solar/GSFC_Solar.vtt", needsResolve: false });
    expect(resolved?.captionsVtt).toContain("Hello");
    expect(await resolveExternalItem("unknown:1", { fetch: fetchFn, env: noEnv })).toBeNull();
    expect(await resolveExternalItem("wikipedia:1", { fetch: fetchFn, env: noEnv })).toBeNull(); // no getItem
    expect(nasa.getItem).toBeTypeOf("function");
  });
});

describe("edge function wiring", () => {
  const source = readFileSync("supabase/functions/library-research-assistant/index.ts", "utf8");

  it("dispatches content modes before the AI allowance and meters them under their own name", () => {
    const content = source.indexOf("if (CONTENT_MODES.has(body.mode))");
    const aiLimit = source.indexOf("_function_name: \"library-research-assistant\"");
    expect(content).toBeGreaterThan(0);
    expect(content).toBeLessThan(aiLimit);
    expect(source).toContain("_function_name: \"library-content-search\"");
  });

  it("requires a signed-in user for every mode and an admin for the live health check", () => {
    const auth = source.indexOf("auth.getUser()");
    expect(auth).toBeGreaterThan(0);
    expect(auth).toBeLessThan(source.indexOf("if (CONTENT_MODES.has(body.mode))"));
    const health = source.slice(source.indexOf("if (body.mode === \"content_health\")"));
    expect(health.slice(0, 200)).toContain("if (!(await isAdmin())) return json({ error: \"Forbidden\" }, 403, cors);");
  });

  it("shows env var names to admins only and never logs a query", () => {
    expect(source).toContain("admin ? p : { ...p, missingEnv: [] }");
    expect(source).not.toMatch(/console\.\w+\([^)]*body\.query/);
  });

  it("the migration gives content search its own ceiling and keeps health rows admin-only", () => {
    const sql = readFileSync("supabase/migrations/20261061000000_library_external_content.sql", "utf8");
    expect(sql).toContain("WHEN 'library-content-search' THEN 300");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO service_role;");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toMatch(/USING \(\(SELECT public\.has_role\(\(SELECT auth\.uid\(\)\), 'admin'::public\.app_role\)\)\)/);
    expect(sql).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)/);
  });
});
