/**
 * Public archives with keyless APIs: the Internet Archive (films, audio,
 * books, images — including every LibriVox audiobook) and the NASA Image and
 * Video Library.
 */

import { embeds } from "../embed.ts";
import { allowsRedistribution, clean, cleanOrNull, getJson, httpsUrl, licenseFromUrl, makeItem, tagList, wants } from "../http.ts";
import type { ContentCategory, ContentProvider, ContentType, ExternalContentItem } from "../types.ts";

// ─── Internet Archive ──────────────────────────────────────────────────────

const IA_MEDIATYPES: Array<{ category: ContentCategory; mediatypes: string[] }> = [
  { category: "video", mediatypes: ["movies"] },
  { category: "audio", mediatypes: ["audio", "etree"] },
  { category: "books", mediatypes: ["texts"] },
  { category: "images", mediatypes: ["image"] },
];

const IA_TYPE: Record<string, ContentType> = { movies: "video", audio: "audio", etree: "audio", texts: "book", image: "image" };

const firstString = (value: unknown, max = 200): string =>
  clean(Array.isArray(value) ? value[0] : value, max);

/**
 * The Archive holds uploads of every kind, including copyrighted ones and
 * in-copyright books it only lends. The query keeps items whose uploader
 * attached a licence (Creative Commons or public domain), which excludes
 * both, and ranks by downloads so the curated collections surface first.
 */
export function archiveQuery(query: string, categories: readonly ContentCategory[]): string | null {
  const mediatypes = IA_MEDIATYPES.filter((m) => wants(categories, m.category)).flatMap((m) => m.mediatypes);
  if (mediatypes.length === 0) return null;
  const terms = query.replace(/[():"\\[\]{}^~*?]/g, " ").replace(/\b(AND|OR|NOT)\b/g, " ").replace(/\s+/g, " ").trim();
  if (!terms) return null;
  return `(${terms}) AND mediatype:(${mediatypes.join(" OR ")}) AND licenseurl:*`;
}

export function parseArchive(data: unknown): ExternalContentItem[] {
  const docs = ((data as { response?: { docs?: Array<Record<string, unknown>> } })?.response?.docs) ?? [];
  return docs.flatMap((doc) => {
    const id = typeof doc.identifier === "string" && /^[A-Za-z0-9._-]{1,120}$/.test(doc.identifier) ? doc.identifier : null;
    const title = firstString(doc.title);
    const contentType = IA_TYPE[String(doc.mediatype)];
    if (!id || !title || !contentType) return [];
    const license = licenseFromUrl(doc.licenseurl);
    return [makeItem("Internet Archive", {
      provider: "internet_archive",
      providerItemId: id,
      title,
      description: cleanOrNull(Array.isArray(doc.description) ? doc.description[0] : doc.description, 400),
      contentType,
      thumbnailUrl: `https://archive.org/services/img/${id}`,
      // The Archive's own player handles video, audio and its book reader.
      embedUrl: contentType === "image" ? null : embeds.archive(id),
      previewUrl: null,
      externalUrl: `https://archive.org/details/${id}`,
      downloadUrl: allowsRedistribution(license) ? `https://archive.org/download/${id}` : null,
      creator: firstString(doc.creator, 160) || null,
      language: firstString(doc.language, 40) || null,
      license,
      attribution: license ? [firstString(doc.creator, 160), license.name, "Internet Archive"].filter(Boolean).join(", ") : null,
      tags: tagList(Array.isArray(doc.subject) ? doc.subject : typeof doc.subject === "string" ? [doc.subject] : []),
      publishedAt: doc.year ? String(doc.year).slice(0, 10) : null,
    })];
  });
}

export const internetArchive: ContentProvider = {
  id: "internet_archive",
  name: "Internet Archive",
  homepage: "https://archive.org",
  docs: "https://archive.org/developers/",
  categories: ["video", "audio", "books", "images"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: true, download: true },
  licenseNote: "Search is limited to items that carry a Creative Commons or public-domain licence; lending-only books are excluded.",
  rateLimit: "No published quota. Response time varies widely (0.8 s to 30 s measured).",
  healthQuery: "moon",
  async search(params, ctx) {
    const q = archiveQuery(params.query, params.categories);
    if (!q) return [];
    const search = new URLSearchParams({ q, rows: String(params.limit), page: String(params.page), output: "json" });
    for (const field of ["identifier", "title", "mediatype", "licenseurl", "creator", "description", "year", "language", "subject"]) search.append("fl[]", field);
    search.append("sort[]", "downloads desc");
    return parseArchive(await getJson(ctx, `https://archive.org/advancedsearch.php?${search}`));
  },
};

// ─── NASA Image and Video Library ──────────────────────────────────────────

const NASA_MEDIA: Array<{ category: ContentCategory; media: string }> = [
  { category: "images", media: "image" },
  { category: "video", media: "video" },
  { category: "audio", media: "audio" },
];

interface NasaEntry {
  data?: Array<Record<string, unknown>>;
  links?: Array<{ href?: string; render?: string; width?: number }>;
}

function nasaItem(entry: NasaEntry, files?: string[]): ExternalContentItem | null {
  const data = entry.data?.[0];
  const id = typeof data?.nasa_id === "string" && data.nasa_id.length <= 200 ? data.nasa_id : null;
  const media = String(data?.media_type ?? "");
  const title = clean(data?.title, 200);
  if (!data || !id || !title || !["image", "video", "audio"].includes(media)) return null;
  const images = (entry.links ?? []).filter((l) => l.render === "image" || /\.(jpe?g|png)$/i.test(l.href ?? ""));
  const largest = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  const thumbnail = httpsUrl((images.find((l) => (l.width ?? 0) <= 500) ?? images[0])?.href);
  const pick = (re: RegExp) => httpsUrl(files?.find((f) => re.test(f)));
  const previewUrl = media === "image"
    ? httpsUrl(largest?.href)
    : media === "video"
      ? pick(/~(mobile|small|medium|preview)\.mp4$/i) ?? pick(/\.mp4$/i)
      : pick(/~128k\.mp3$/i) ?? pick(/\.(mp3|m4a)$/i);
  const center = clean(data.center, 20);
  const description = cleanOrNull(data.description_508 ?? data.description, 500);
  return makeItem("NASA Image and Video Library", {
    provider: "nasa",
    providerItemId: id,
    title,
    description,
    altText: media === "image" ? description : null,
    contentType: media as ContentType,
    mimeType: media === "video" ? "video/mp4" : media === "audio" ? "audio/mpeg" : null,
    thumbnailUrl: thumbnail,
    previewUrl,
    captionsUrl: media === "video" ? pick(/\.vtt$/i) : null,
    externalUrl: `https://images.nasa.gov/details/${encodeURIComponent(id)}`,
    creator: cleanOrNull(data.photographer ?? data.secondary_creator, 160),
    publisher: center ? `NASA ${center}` : "NASA",
    attribution: center ? `NASA/${center}` : "NASA",
    tags: tagList(data.keywords),
    publishedAt: typeof data.date_created === "string" ? data.date_created.slice(0, 10) : null,
    // Search results carry no file list for video and audio.
    needsResolve: media !== "image" && !files,
  });
}

export function parseNasaSearch(data: unknown): ExternalContentItem[] {
  const items = ((data as { collection?: { items?: NasaEntry[] } })?.collection?.items) ?? [];
  return items.flatMap((entry) => nasaItem(entry) ?? []);
}

export function parseNasaAsset(data: unknown): string[] {
  const items = ((data as { collection?: { items?: Array<{ href?: string }> } })?.collection?.items) ?? [];
  return items.map((i) => i.href).filter((h): h is string => typeof h === "string");
}

export const nasa: ContentProvider = {
  id: "nasa",
  name: "NASA Image and Video Library",
  homepage: "https://images.nasa.gov",
  docs: "https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf",
  categories: ["images", "video", "audio", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: true, embed: false, download: false },
  licenseNote: "NASA material is generally not copyrighted in the US, but some items belong to third parties; credit NASA and check each item before reuse.",
  rateLimit: "No key and no published quota for images-api.nasa.gov.",
  healthQuery: "moon",
  async search(params, ctx) {
    const media = NASA_MEDIA.filter((m) => wants(params.categories, m.category) || params.categories.includes("education")).map((m) => m.media);
    if (media.length === 0) return [];
    const q = new URLSearchParams({ q: params.query, media_type: media.join(","), page: String(params.page), page_size: String(params.limit) });
    return parseNasaSearch(await getJson(ctx, `https://images-api.nasa.gov/search?${q}`));
  },
  async getItem(providerItemId, ctx) {
    const id = encodeURIComponent(providerItemId);
    const [search, asset] = await Promise.all([
      getJson(ctx, `https://images-api.nasa.gov/search?nasa_id=${id}`),
      getJson(ctx, `https://images-api.nasa.gov/asset/${id}`),
    ]);
    const entry = ((search as { collection?: { items?: NasaEntry[] } })?.collection?.items ?? [])[0];
    return entry ? nasaItem(entry, parseNasaAsset(asset)) : null;
  },
};
