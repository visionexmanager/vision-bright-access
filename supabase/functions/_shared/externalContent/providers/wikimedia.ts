/**
 * Wikimedia: Commons (free images, audio, video, PDFs) and the text projects —
 * Wikipedia, Wikibooks (open textbooks), Wikisource (public-domain texts) and
 * Wikiversity (learning resources). All keyless MediaWiki APIs.
 */

import { wikipediaLanguage } from "../../openResearchSources.ts";
import { allowsRedistribution, clean, cleanOrNull, getJson, httpsUrl, makeItem, positiveNumber, typeFromMime, wants } from "../http.ts";
import type { ContentCategory, ContentProvider, ContentType, ExternalContentItem, SearchParams } from "../types.ts";

const WIKIMEDIA_RATE = "No fixed quota; Wikimedia asks for a descriptive User-Agent and serial requests.";

type ExtMeta = Record<string, { value?: unknown } | undefined>;

interface CommonsPage {
  pageid?: number;
  title?: string;
  index?: number;
  imageinfo?: Array<{
    url?: string; mime?: string; size?: number; duration?: number; thumburl?: string;
    descriptionurl?: string; extmetadata?: ExtMeta;
  }>;
}

function commonsFilter(categories: readonly ContentCategory[]): string {
  const types: string[] = [];
  if (wants(categories, "images")) types.push("bitmap", "drawing");
  if (wants(categories, "audio")) types.push("audio");
  if (wants(categories, "video")) types.push("video");
  if (categories.length > 0 && types.length === 0) return "";
  return types.length ? ` filetype:${types.join("|")}` : "";
}

export function parseCommons(data: unknown): ExternalContentItem[] {
  const pages = Object.values(((data as { query?: { pages?: Record<string, CommonsPage> } })?.query?.pages) ?? {});
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return pages.flatMap((page) => {
    const info = page.imageinfo?.[0];
    const file = httpsUrl(info?.url);
    const pageUrl = httpsUrl(info?.descriptionurl);
    if (!info || !file || !pageUrl || typeof page.pageid !== "number") return [];
    const meta = info.extmetadata ?? {};
    const value = (key: string) => meta[key]?.value;
    const licenseName = clean(value("LicenseShortName"), 80);
    const license = licenseName ? { name: licenseName, url: httpsUrl(value("LicenseUrl")) } : null;
    const creator = cleanOrNull(value("Artist"), 160);
    const contentType = typeFromMime(info.mime, "document");
    if (contentType === "document" && info.mime !== "application/pdf") return [];
    const title = clean(String(page.title ?? "").replace(/^File:/, "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/_/g, " "), 200);
    if (!title) return [];
    const thumb = httpsUrl(info.thumburl);
    const description = cleanOrNull(value("ImageDescription"), 400);
    return [makeItem("Wikimedia Commons", {
      provider: "wikimedia_commons",
      providerItemId: String(page.pageid),
      title,
      description,
      altText: contentType === "image" ? description : null,
      contentType,
      mimeType: typeof info.mime === "string" ? info.mime : null,
      // Audio files get a generic file-type icon as their "thumbnail".
      thumbnailUrl: thumb && !thumb.includes("/file-type-icons/") ? thumb : null,
      previewUrl: contentType === "document" ? null : file,
      externalUrl: pageUrl,
      downloadUrl: allowsRedistribution(license) ? file : null,
      creator,
      durationSeconds: positiveNumber(info.duration),
      sizeBytes: positiveNumber(info.size),
      license,
      attribution: [creator, license?.name, "via Wikimedia Commons"].filter(Boolean).join(", "),
      publishedAt: cleanOrNull(value("DateTimeOriginal"), 40),
    })];
  });
}

export const wikimediaCommons: ContentProvider = {
  id: "wikimedia_commons",
  name: "Wikimedia Commons",
  homepage: "https://commons.wikimedia.org",
  docs: "https://www.mediawiki.org/wiki/API:Search",
  categories: ["images", "audio", "video", "documents"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Every file is freely licensed or public domain; the licence and author are read from each file page.",
  rateLimit: WIKIMEDIA_RATE,
  healthQuery: "moon",
  async search(params: SearchParams, ctx) {
    const filter = params.categories.length === 1 && params.categories[0] === "documents"
      ? " filemime:application/pdf"
      : commonsFilter(params.categories);
    if (filter === "") return [];
    const q = new URLSearchParams({
      action: "query", format: "json", generator: "search", gsrnamespace: "6",
      gsrsearch: `${params.query}${filter}`, gsrlimit: String(params.limit),
      gsroffset: String((params.page - 1) * params.limit),
      prop: "imageinfo", iiprop: "url|mime|size|extmetadata", iiurlwidth: "480",
      iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|ImageDescription|DateTimeOriginal",
      iiextmetadatalanguage: params.language,
    });
    return parseCommons(await getJson(ctx, `https://commons.wikimedia.org/w/api.php?${q}`));
  },
};

type Project = "wikipedia" | "wikibooks" | "wikisource" | "wikiversity";

const WIKIVERSITY_LANGUAGES = new Set(["ar", "de", "en", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh", "hi", "sv"]);

function projectLanguage(project: Project, query: string, language: string): string {
  const lang = wikipediaLanguage(query, language);
  if (project === "wikiversity" && !WIKIVERSITY_LANGUAGES.has(lang)) return "en";
  return lang;
}

const TEXT_LICENSE = { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" };

export function parseMediaWikiSearch(data: unknown, config: { id: string; name: string; project: Project; contentType: ContentType }, lang: string): ExternalContentItem[] {
  const hits = ((data as { query?: { search?: Array<Record<string, unknown>> } })?.query?.search) ?? [];
  return hits.flatMap((hit) => {
    const title = clean(hit.title, 200);
    if (!title || typeof hit.pageid !== "number") return [];
    const url = `https://${lang}.${config.project}.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    // Wikisource hosts original works, mostly public domain, under their own
    // terms; the site-wide CC BY-SA covers the other three projects' text.
    const license = config.project === "wikisource" ? null : TEXT_LICENSE;
    return [makeItem(config.name, {
      provider: config.id,
      providerItemId: `${lang}:${hit.pageid}`,
      title,
      description: cleanOrNull(hit.snippet, 300),
      contentType: config.contentType,
      externalUrl: url,
      language: lang,
      license,
      attribution: license ? `${config.name} contributors, ${license.name}` : null,
      publishedAt: typeof hit.timestamp === "string" ? hit.timestamp.slice(0, 10) : null,
    })];
  });
}

function mediaWikiProvider(config: {
  id: string; name: string; project: Project; contentType: ContentType;
  categories: readonly ContentCategory[]; licenseNote: string; healthQuery: string;
}): ContentProvider {
  return {
    id: config.id,
    name: config.name,
    homepage: `https://www.${config.project}.org`,
    docs: "https://www.mediawiki.org/wiki/API:Search",
    categories: config.categories,
    auth: { kind: "none" },
    capabilities: { search: true, preview: false, embed: false, download: false },
    licenseNote: config.licenseNote,
    rateLimit: WIKIMEDIA_RATE,
    healthQuery: config.healthQuery,
    async search(params, ctx) {
      const lang = projectLanguage(config.project, params.query, params.language);
      const q = new URLSearchParams({
        action: "query", list: "search", format: "json", srsearch: params.query,
        srlimit: String(params.limit), sroffset: String((params.page - 1) * params.limit),
      });
      return parseMediaWikiSearch(await getJson(ctx, `https://${lang}.${config.project}.org/w/api.php?${q}`), config, lang);
    },
  };
}

export const wikipedia = mediaWikiProvider({
  id: "wikipedia", name: "Wikipedia", project: "wikipedia", contentType: "article",
  categories: ["documents", "education"], healthQuery: "water",
  licenseNote: "Article text is CC BY-SA 4.0; credit Wikipedia contributors and link the article.",
});

export const wikibooks = mediaWikiProvider({
  id: "wikibooks", name: "Wikibooks", project: "wikibooks", contentType: "book",
  categories: ["books", "education"], healthQuery: "algebra",
  licenseNote: "Open textbooks under CC BY-SA 4.0.",
});

export const wikisource = mediaWikiProvider({
  id: "wikisource", name: "Wikisource", project: "wikisource", contentType: "book",
  categories: ["books", "documents"], healthQuery: "poem",
  licenseNote: "Public-domain and freely licensed source texts; each work states its own status.",
});

export const wikiversity = mediaWikiProvider({
  id: "wikiversity", name: "Wikiversity", project: "wikiversity", contentType: "document",
  categories: ["education"], healthQuery: "mathematics",
  licenseNote: "Learning resources under CC BY-SA 4.0.",
});
