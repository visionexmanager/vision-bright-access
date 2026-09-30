/**
 * Providers that need a server secret. Each adapter is complete; it answers
 * as soon as its environment variables are set as Supabase secrets, and until
 * then the registry reports it as `configuration_required` and never calls it.
 *
 * Keys are read from the server environment only, never sent to the browser,
 * and never appear in an error: `ProviderError` carries a code, not the URL.
 */

import { embeds } from "../embed.ts";
import { getYouTubeResource, searchYouTube, splitYouTubeItemId, YouTubeError, YOUTUBE_MAX_LIMIT, YOUTUBE_MAX_QUERY_CHARS } from "../youtube.ts";
import { allowsRedistribution, clean, cleanOrNull, getJson, httpsUrl, licenseFromUrl, makeItem, positiveNumber, ProviderError, tagList, wants } from "../http.ts";
import type { ContentLicense, ContentProvider, ContentType, ExternalContentItem, ProviderContext } from "../types.ts";

function secret(ctx: ProviderContext, name: string): string {
  const value = ctx.env(name)?.trim();
  if (!value) throw new ProviderError("not_configured");
  return value;
}

// ─── Unsplash ──────────────────────────────────────────────────────────────

export function parseUnsplash(data: unknown): ExternalContentItem[] {
  const results = ((data as { results?: Array<Record<string, unknown>> })?.results) ?? [];
  return results.flatMap((photo) => {
    const id = typeof photo.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(photo.id) ? photo.id : null;
    const urls = (photo.urls ?? {}) as Record<string, string>;
    const links = (photo.links ?? {}) as Record<string, string>;
    const user = (photo.user ?? {}) as { name?: string };
    const page = httpsUrl(links.html);
    if (!id || !page || !httpsUrl(urls.regular)) return [];
    const alt = cleanOrNull(photo.alt_description, 300);
    const creator = cleanOrNull(user.name, 120);
    return [makeItem("Unsplash", {
      provider: "unsplash",
      providerItemId: id,
      title: clean(photo.description, 200) || alt || "Unsplash photo",
      altText: alt,
      contentType: "image",
      thumbnailUrl: httpsUrl(urls.small),
      // Unsplash requires hotlinking its image URLs, and a download must go
      // through its tracking endpoint, so no download URL is offered here.
      previewUrl: httpsUrl(urls.regular),
      externalUrl: page,
      creator,
      license: { name: "Unsplash License", url: "https://unsplash.com/license" },
      attribution: creator ? `Photo by ${creator} on Unsplash` : "Unsplash",
      publishedAt: typeof photo.created_at === "string" ? photo.created_at.slice(0, 10) : null,
    })];
  });
}

export const unsplash: ContentProvider = {
  id: "unsplash",
  name: "Unsplash",
  homepage: "https://unsplash.com",
  docs: "https://unsplash.com/documentation",
  categories: ["images"],
  auth: { kind: "api_key", env: ["UNSPLASH_ACCESS_KEY"] },
  capabilities: { search: true, preview: true, embed: false, download: false },
  licenseNote: "Unsplash License: free to use; the API guidelines require hotlinked images and a credit to the photographer and Unsplash.",
  rateLimit: "50 requests per hour in demo mode, 5,000 once approved for production.",
  healthQuery: "mountain",
  async search(params, ctx) {
    const key = secret(ctx, "UNSPLASH_ACCESS_KEY");
    const q = new URLSearchParams({ query: params.query, page: String(params.page), per_page: String(params.limit), content_filter: "high" });
    return parseUnsplash(await getJson(ctx, `https://api.unsplash.com/search/photos?${q}`, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } }));
  },
};

// ─── Pexels ────────────────────────────────────────────────────────────────

const PEXELS_LICENSE: ContentLicense = { name: "Pexels License", url: "https://www.pexels.com/license/" };

export function parsePexelsPhotos(data: unknown): ExternalContentItem[] {
  const photos = ((data as { photos?: Array<Record<string, unknown>> })?.photos) ?? [];
  return photos.flatMap((p) => {
    const src = (p.src ?? {}) as Record<string, string>;
    const page = httpsUrl(p.url);
    if (typeof p.id !== "number" || !page || !httpsUrl(src.large)) return [];
    const alt = cleanOrNull(p.alt, 300);
    const creator = cleanOrNull(p.photographer, 120);
    return [makeItem("Pexels", {
      provider: "pexels",
      providerItemId: `photo:${p.id}`,
      title: alt ?? "Pexels photo",
      altText: alt,
      contentType: "image",
      thumbnailUrl: httpsUrl(src.medium),
      previewUrl: httpsUrl(src.large),
      externalUrl: page,
      downloadUrl: httpsUrl(src.original),
      creator,
      license: PEXELS_LICENSE,
      attribution: creator ? `Photo by ${creator} on Pexels` : "Pexels",
    })];
  });
}

export function parsePexelsVideos(data: unknown): ExternalContentItem[] {
  const videos = ((data as { videos?: Array<Record<string, unknown>> })?.videos) ?? [];
  return videos.flatMap((v) => {
    const page = httpsUrl(v.url);
    const files = ((v.video_files as Array<{ link?: string; file_type?: string; width?: number }>) ?? [])
      .filter((f) => f.file_type === "video/mp4" && httpsUrl(f.link))
      .sort((a, b) => Math.abs((a.width ?? 0) - 960) - Math.abs((b.width ?? 0) - 960));
    if (typeof v.id !== "number" || !page || files.length === 0) return [];
    const user = (v.user ?? {}) as { name?: string };
    const creator = cleanOrNull(user.name, 120);
    const slug = page.match(/\/video\/([a-z0-9-]+?)-\d+\/?$/)?.[1];
    return [makeItem("Pexels", {
      provider: "pexels",
      providerItemId: `video:${v.id}`,
      title: slug ? clean(slug.replace(/-/g, " "), 200) : "Pexels video",
      contentType: "video",
      mimeType: "video/mp4",
      thumbnailUrl: httpsUrl(v.image),
      previewUrl: httpsUrl(files[0].link),
      externalUrl: page,
      downloadUrl: httpsUrl(files[0].link),
      creator,
      durationSeconds: positiveNumber(v.duration),
      license: PEXELS_LICENSE,
      attribution: creator ? `Video by ${creator} on Pexels` : "Pexels",
    })];
  });
}

export const pexels: ContentProvider = {
  id: "pexels",
  name: "Pexels",
  homepage: "https://www.pexels.com",
  docs: "https://www.pexels.com/api/documentation/",
  categories: ["images", "video"],
  auth: { kind: "api_key", env: ["PEXELS_API_KEY"] },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Pexels License: free to use and download; the API terms ask for a visible link back to Pexels and the creator.",
  rateLimit: "200 requests per hour, 20,000 per month by default.",
  healthQuery: "forest",
  async search(params, ctx) {
    const key = secret(ctx, "PEXELS_API_KEY");
    const q = new URLSearchParams({ query: params.query, page: String(params.page), per_page: String(params.limit) });
    const headers = { Authorization: key };
    const runs: Array<Promise<ExternalContentItem[]>> = [];
    if (wants(params.categories, "images")) runs.push(getJson(ctx, `https://api.pexels.com/v1/search?${q}`, { headers }).then(parsePexelsPhotos));
    if (wants(params.categories, "video")) runs.push(getJson(ctx, `https://api.pexels.com/videos/search?${q}`, { headers }).then(parsePexelsVideos));
    return (await Promise.all(runs)).flat();
  },
};

// ─── Pixabay ───────────────────────────────────────────────────────────────

const PIXABAY_LICENSE: ContentLicense = { name: "Pixabay Content License", url: "https://pixabay.com/service/license-summary/" };

export function parsePixabay(data: unknown, kind: "image" | "video"): ExternalContentItem[] {
  const hits = ((data as { hits?: Array<Record<string, unknown>> })?.hits) ?? [];
  return hits.flatMap((h) => {
    const page = httpsUrl(h.pageURL);
    if (typeof h.id !== "number" || !page) return [];
    const tags = typeof h.tags === "string" ? h.tags.split(",").map((t) => clean(t, 40)).filter(Boolean) : [];
    const videos = (h.videos ?? {}) as Record<string, { url?: string; thumbnail?: string } | undefined>;
    const video = videos.medium ?? videos.small;
    const preview = kind === "image" ? httpsUrl(h.webformatURL) : httpsUrl(video?.url);
    if (!preview) return [];
    const creator = cleanOrNull(h.user, 120);
    return [makeItem("Pixabay", {
      provider: "pixabay",
      providerItemId: `${kind}:${h.id}`,
      title: tags.slice(0, 3).join(", ") || `Pixabay ${kind}`,
      altText: kind === "image" ? tags.join(", ") || null : null,
      contentType: kind,
      mimeType: kind === "video" ? "video/mp4" : null,
      thumbnailUrl: kind === "image" ? httpsUrl(h.previewURL) : httpsUrl(video?.thumbnail),
      // Pixabay allows its URLs for showing search results, not permanent hotlinking.
      previewUrl: preview,
      externalUrl: page,
      creator,
      durationSeconds: positiveNumber(h.duration),
      license: PIXABAY_LICENSE,
      attribution: creator ? `${creator} on Pixabay` : "Pixabay",
      tags,
    })];
  });
}

export const pixabay: ContentProvider = {
  id: "pixabay",
  name: "Pixabay",
  homepage: "https://pixabay.com",
  docs: "https://pixabay.com/api/docs/",
  categories: ["images", "video"],
  auth: { kind: "api_key", env: ["PIXABAY_API_KEY"] },
  capabilities: { search: true, preview: true, embed: false, download: false },
  licenseNote: "Pixabay Content License; the API forbids permanent hotlinking, so results are shown and linked, never stored.",
  rateLimit: "100 requests per 60 seconds; results must be cached for 24 hours.",
  healthQuery: "flower",
  async search(params, ctx) {
    const key = secret(ctx, "PIXABAY_API_KEY");
    const q = new URLSearchParams({ key, q: params.query.slice(0, 100), page: String(params.page), per_page: String(Math.max(3, params.limit)), safesearch: "true", lang: params.language });
    const runs: Array<Promise<ExternalContentItem[]>> = [];
    if (wants(params.categories, "images")) runs.push(getJson(ctx, `https://pixabay.com/api/?${q}`).then((d) => parsePixabay(d, "image")));
    if (wants(params.categories, "video")) runs.push(getJson(ctx, `https://pixabay.com/api/videos/?${q}`).then((d) => parsePixabay(d, "video")));
    return (await Promise.all(runs)).flat();
  },
};

// ─── YouTube ───────────────────────────────────────────────────────────────
//
// The full integration (search, details, channels, playlists, cache, ETags, error
// mapping) lives in ../youtube.ts. This is only the registry's face of it: a
// video search for a search that names YouTube, mapped onto the ProviderError
// codes the aggregator reports.

export { parseYouTube } from "../youtube.ts";

function asProviderError(err: unknown): never {
  if (!(err instanceof YouTubeError)) throw err;
  switch (err.code) {
    case "youtube_not_configured": throw new ProviderError("not_configured");
    case "youtube_quota_exceeded":
    case "youtube_rate_limited": throw new ProviderError("rate_limited", 429);
    case "youtube_timeout": throw new ProviderError("timeout");
    case "youtube_bad_response": throw new ProviderError("invalid_response");
    default: throw new ProviderError("http_error");
  }
}

export const youtube: ContentProvider = {
  id: "youtube",
  name: "YouTube",
  homepage: "https://www.youtube.com",
  docs: "https://developers.google.com/youtube/v3/docs/search/list",
  categories: ["video", "education"],
  auth: { kind: "api_key", env: ["YOUTUBE_API_KEY"] },
  capabilities: { search: true, preview: false, embed: true, download: false },
  licenseNote: "Discovery through the official YouTube Data API. Played only in YouTube's embedded player (privacy-enhanced domain), always linked to YouTube; downloading is prohibited by YouTube's terms.",
  rateLimit: "10,000 quota units a day on the default key; one search costs 100 units. Searched only when named, cached for 15 minutes.",
  optIn: true,
  healthQuery: "photosynthesis",
  async search(params, ctx) {
    apiKeyPresent(ctx);
    // Paging needs the previous response's token, which a stateless page number cannot carry.
    if (params.page > 1) return [];
    try {
      const page = await searchYouTube({
        query: params.query.slice(0, YOUTUBE_MAX_QUERY_CHARS), type: "video", order: "relevance", language: params.language,
        region: null, captions: false, hd: false, duration: null, channelId: null, pageToken: null,
        limit: Math.min(params.limit, YOUTUBE_MAX_LIMIT),
      }, { fetch: ctx.fetch, env: ctx.env });
      return page.items;
    } catch (err) {
      return asProviderError(err);
    }
  },
  /** Details for one video, channel or playlist, fetched when a reader opens it (one quota unit). */
  async getItem(providerItemId, ctx) {
    apiKeyPresent(ctx);
    const ref = splitYouTubeItemId(providerItemId);
    if (!ref) return null;
    try {
      return await getYouTubeResource(ref.type, ref.id, { fetch: ctx.fetch, env: ctx.env });
    } catch (err) {
      if (err instanceof YouTubeError && err.code === "youtube_not_found") return null;
      return asProviderError(err);
    }
  },
};

function apiKeyPresent(ctx: ProviderContext): void {
  if (!ctx.env("YOUTUBE_API_KEY")?.trim()) throw new ProviderError("not_configured");
}

// ─── Vimeo ─────────────────────────────────────────────────────────────────

const VIMEO_LICENSES: Record<string, string> = {
  by: "CC BY", "by-sa": "CC BY-SA", "by-nd": "CC BY-ND", "by-nc": "CC BY-NC",
  "by-nc-sa": "CC BY-NC-SA", "by-nc-nd": "CC BY-NC-ND", cc0: "CC0",
};

export function parseVimeo(data: unknown): ExternalContentItem[] {
  const videos = ((data as { data?: Array<Record<string, unknown>> })?.data) ?? [];
  return videos.flatMap((v) => {
    const id = typeof v.uri === "string" ? v.uri.match(/^\/videos\/(\d+)$/)?.[1] : undefined;
    const title = clean(v.name, 200);
    const page = httpsUrl(v.link);
    if (!id || !title || !page) return [];
    const privacy = (v.privacy ?? {}) as { embed?: string };
    const sizes = (((v.pictures ?? {}) as { sizes?: Array<{ link?: string; width?: number }> }).sizes ?? []);
    const thumb = sizes.find((s) => (s.width ?? 0) >= 295) ?? sizes.at(-1);
    const user = (v.user ?? {}) as { name?: string };
    return [makeItem("Vimeo", {
      provider: "vimeo",
      providerItemId: id,
      title,
      description: cleanOrNull(v.description, 300),
      contentType: "video",
      thumbnailUrl: httpsUrl(thumb?.link),
      embedUrl: privacy.embed === "public" ? embeds.vimeo(id) : null,
      externalUrl: page,
      creator: cleanOrNull(user.name, 120),
      durationSeconds: positiveNumber(v.duration),
      language: typeof v.language === "string" ? v.language.slice(0, 5) : null,
      // Vimeo names the licence family but not its version, so no URL is guessed.
      license: typeof v.license === "string" && VIMEO_LICENSES[v.license] ? { name: VIMEO_LICENSES[v.license], url: null } : null,
      publishedAt: typeof v.created_time === "string" ? v.created_time.slice(0, 10) : null,
    })];
  });
}

export const vimeo: ContentProvider = {
  id: "vimeo",
  name: "Vimeo",
  homepage: "https://vimeo.com",
  docs: "https://developer.vimeo.com/api/reference/videos#search_videos",
  categories: ["video", "education"],
  auth: { kind: "api_key", env: ["VIMEO_ACCESS_TOKEN"] },
  capabilities: { search: true, preview: false, embed: true, download: false },
  licenseNote: "Embedded only when the owner allows public embedding; Creative Commons licences are shown when the owner set one.",
  rateLimit: "Per-app limit returned in X-RateLimit headers (hundreds of calls per 15 minutes).",
  healthQuery: "nature",
  async search(params, ctx) {
    const token = secret(ctx, "VIMEO_ACCESS_TOKEN");
    const q = new URLSearchParams({
      query: params.query, page: String(params.page), per_page: String(params.limit),
      fields: "uri,name,description,link,duration,pictures.sizes,user.name,license,privacy.embed,language,created_time",
    });
    return parseVimeo(await getJson(ctx, `https://api.vimeo.com/videos?${q}`, {
      headers: { Authorization: `bearer ${token}`, Accept: "application/vnd.vimeo.*+json;version=3.4" },
    }));
  },
};

// ─── Freesound ─────────────────────────────────────────────────────────────

export function parseFreesound(data: unknown): ExternalContentItem[] {
  const results = ((data as { results?: Array<Record<string, unknown>> })?.results) ?? [];
  return results.flatMap((s) => {
    const previews = (s.previews ?? {}) as Record<string, string>;
    const page = httpsUrl(s.url);
    const title = clean(s.name, 200);
    const preview = httpsUrl(previews["preview-hq-mp3"] ?? previews["preview-lq-mp3"]);
    if (typeof s.id !== "number" || !page || !title || !preview) return [];
    const license = licenseFromUrl(s.license);
    const creator = cleanOrNull(s.username, 120);
    return [makeItem("Freesound", {
      provider: "freesound",
      providerItemId: String(s.id),
      title,
      description: cleanOrNull(s.description, 300),
      contentType: "audio",
      mimeType: "audio/mpeg",
      thumbnailUrl: httpsUrl(((s.images ?? {}) as Record<string, string>).waveform_m),
      // Previews are free to stream; the original file needs the user's own OAuth login.
      previewUrl: preview,
      externalUrl: page,
      creator,
      durationSeconds: positiveNumber(s.duration),
      license,
      attribution: [title, creator ? `by ${creator}` : "", license?.name, "Freesound"].filter(Boolean).join(", "),
      tags: tagList(s.tags, 6),
    })];
  });
}

export const freesound: ContentProvider = {
  id: "freesound",
  name: "Freesound",
  homepage: "https://freesound.org",
  docs: "https://freesound.org/docs/api/",
  categories: ["audio"],
  auth: { kind: "api_key", env: ["FREESOUND_API_KEY"] },
  capabilities: { search: true, preview: true, embed: false, download: false },
  licenseNote: "Sounds under CC0, CC BY or CC BY-NC; each carries its licence. Previews stream freely.",
  rateLimit: "60 requests per minute, 2,000 per day.",
  healthQuery: "rain",
  async search(params, ctx) {
    const key = secret(ctx, "FREESOUND_API_KEY");
    const q = new URLSearchParams({
      query: params.query, page: String(params.page), page_size: String(params.limit),
      fields: "id,name,description,username,license,previews,duration,url,tags,images",
    });
    return parseFreesound(await getJson(ctx, `https://freesound.org/apiv2/search/text/?${q}`, { headers: { Authorization: `Token ${key}` } }));
  },
};

// ─── Jamendo ───────────────────────────────────────────────────────────────

export function parseJamendo(data: unknown): ExternalContentItem[] {
  const results = ((data as { results?: Array<Record<string, unknown>> })?.results) ?? [];
  return results.flatMap((t) => {
    const id = typeof t.id === "string" && /^\d+$/.test(t.id) ? t.id : null;
    const title = clean(t.name, 200);
    const page = httpsUrl(t.shareurl);
    if (!id || !title || !page) return [];
    const license = licenseFromUrl(t.license_ccurl);
    const creator = cleanOrNull(t.artist_name, 120);
    return [makeItem("Jamendo", {
      provider: "jamendo",
      providerItemId: id,
      title,
      contentType: "audio",
      mimeType: "audio/mpeg",
      thumbnailUrl: httpsUrl(t.image ?? t.album_image),
      previewUrl: httpsUrl(t.audio),
      externalUrl: page,
      downloadUrl: t.audiodownload_allowed === true && allowsRedistribution(license) ? httpsUrl(t.audiodownload) : null,
      creator,
      publisher: cleanOrNull(t.album_name, 160),
      durationSeconds: positiveNumber(t.duration),
      license,
      attribution: [title, creator ? `by ${creator}` : "", license?.name, "Jamendo"].filter(Boolean).join(", "),
      publishedAt: typeof t.releasedate === "string" ? t.releasedate : null,
    })];
  });
}

export const jamendo: ContentProvider = {
  id: "jamendo",
  name: "Jamendo",
  homepage: "https://www.jamendo.com",
  docs: "https://developer.jamendo.com/v3.0/tracks",
  categories: ["audio"],
  auth: { kind: "api_key", env: ["JAMENDO_CLIENT_ID"] },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Independent music under Creative Commons. The API is free for non-commercial use; commercial use needs a Jamendo agreement.",
  rateLimit: "35,000 requests per month on the free tier.",
  healthQuery: "piano",
  async search(params, ctx) {
    const clientId = secret(ctx, "JAMENDO_CLIENT_ID");
    const q = new URLSearchParams({
      client_id: clientId, format: "json", search: params.query, limit: String(params.limit),
      offset: String((params.page - 1) * params.limit), audioformat: "mp32", include: "licenses",
    });
    return parseJamendo(await getJson(ctx, `https://api.jamendo.com/v3.0/tracks/?${q}`));
  },
};

// ─── Europeana ─────────────────────────────────────────────────────────────

const EUROPEANA_TYPES: Record<string, ContentType> = { IMAGE: "image", SOUND: "audio", VIDEO: "video", TEXT: "document", "3D": "image" };

export function parseEuropeana(data: unknown): ExternalContentItem[] {
  const items = ((data as { items?: Array<Record<string, unknown>> })?.items) ?? [];
  const first = (v: unknown, max = 200) => clean(Array.isArray(v) ? v[0] : v, max);
  return items.flatMap((item) => {
    const id = typeof item.id === "string" && /^\/[\w-]+\/[\w.-]+$/.test(item.id) ? item.id : null;
    const title = first(item.title);
    const page = httpsUrl(item.guid);
    if (!id || !title || !page) return [];
    const license = licenseFromUrl(first(item.rights, 300));
    const creator = first(item.dcCreator, 160) || null;
    const provider = first(item.dataProvider, 160) || null;
    return [makeItem("Europeana", {
      provider: "europeana",
      providerItemId: id.slice(1),
      title,
      contentType: EUROPEANA_TYPES[String(item.type)] ?? "document",
      thumbnailUrl: httpsUrl(first(item.edmPreview, 1000)),
      externalUrl: page.split("?")[0],
      creator,
      publisher: provider,
      language: first(item.language, 10) || null,
      license,
      attribution: [creator, provider, license?.name, "Europeana"].filter(Boolean).join(", "),
      publishedAt: first(item.year, 10) || null,
    })];
  });
}

export const europeana: ContentProvider = {
  id: "europeana",
  name: "Europeana",
  homepage: "https://www.europeana.eu",
  docs: "https://europeana.atlassian.net/wiki/spaces/EF/pages/2385739812/Search+API+Documentation",
  categories: ["images", "audio", "video", "books", "documents"],
  auth: { kind: "api_key", env: ["EUROPEANA_API_KEY"] },
  capabilities: { search: true, preview: true, embed: false, download: false },
  licenseNote: "Europe's cultural heritage; the search asks only for openly reusable items, each with its rights statement.",
  rateLimit: "No published hard limit for a free personal key.",
  healthQuery: "painting",
  async search(params, ctx) {
    const key = secret(ctx, "EUROPEANA_API_KEY");
    const q = new URLSearchParams({
      wskey: key, query: params.query, rows: String(params.limit),
      start: String((params.page - 1) * params.limit + 1), reusability: "open", media: "true",
    });
    return parseEuropeana(await getJson(ctx, `https://api.europeana.eu/record/v2/search.json?${q}`));
  },
};

// ─── Digital Public Library of America ─────────────────────────────────────

export function parseDpla(data: unknown): ExternalContentItem[] {
  const docs = ((data as { docs?: Array<Record<string, unknown>> })?.docs) ?? [];
  const first = (v: unknown, max = 200) => clean(Array.isArray(v) ? v[0] : v, max);
  return docs.flatMap((doc) => {
    const id = typeof doc.id === "string" && /^[0-9a-f]{32}$/.test(doc.id) ? doc.id : null;
    const source = (doc.sourceResource ?? {}) as Record<string, unknown>;
    const title = first(source.title);
    const page = httpsUrl(doc.isShownAt);
    if (!id || !title || !page) return [];
    const type = first(source.type, 20).toLowerCase();
    const license = licenseFromUrl(doc.rights);
    const holder = doc.dataProvider;
    const provider = clean(
      typeof holder === "string" ? holder
        : Array.isArray(holder) ? holder[0]
        : (holder as { name?: string } | undefined)?.name ?? ((doc.provider ?? {}) as { name?: string }).name,
      160,
    ) || null;
    return [makeItem("Digital Public Library of America", {
      provider: "dpla",
      providerItemId: id,
      title,
      description: first(source.description, 400) || null,
      contentType: type === "image" ? "image" : type === "sound" ? "audio" : type === "moving image" ? "video" : "document",
      thumbnailUrl: httpsUrl(doc.object),
      externalUrl: page,
      creator: first(source.creator, 160) || null,
      publisher: provider,
      license,
      attribution: [provider, license?.name, "DPLA"].filter(Boolean).join(", "),
      publishedAt: clean(((source.date ?? {}) as { displayDate?: string }).displayDate, 40) || null,
    })];
  });
}

export const dpla: ContentProvider = {
  id: "dpla",
  name: "Digital Public Library of America",
  homepage: "https://dp.la",
  docs: "https://pro.dp.la/developers/requests",
  categories: ["images", "books", "documents"],
  auth: { kind: "api_key", env: ["DPLA_API_KEY"] },
  capabilities: { search: true, preview: true, embed: false, download: false },
  licenseNote: "Metadata is CC0; each item links to its holding library with that library's rights statement.",
  rateLimit: "No published limit for a free key.",
  healthQuery: "map",
  async search(params, ctx) {
    const key = secret(ctx, "DPLA_API_KEY");
    const q = new URLSearchParams({ q: params.query, api_key: key, page_size: String(params.limit), page: String(params.page) });
    return parseDpla(await getJson(ctx, `https://api.dp.la/v2/items?${q}`));
  },
};

// ─── Smithsonian Open Access ───────────────────────────────────────────────

export function parseSmithsonian(data: unknown): ExternalContentItem[] {
  const rows = ((data as { response?: { rows?: Array<Record<string, unknown>> } })?.response?.rows) ?? [];
  return rows.flatMap((row) => {
    const content = (row.content ?? {}) as Record<string, Record<string, unknown> | undefined>;
    const desc = content.descriptiveNonRepeating ?? {};
    const media = ((((desc.online_media ?? {}) as { media?: Array<Record<string, unknown>> }).media) ?? [])
      .find((m) => ((m.usage ?? {}) as { access?: string }).access === "CC0" && httpsUrl(m.content));
    const title = clean(row.title, 200);
    const page = httpsUrl(desc.record_link);
    if (typeof row.id !== "string" || !title || !page || !media) return [];
    const names = (((content.freetext ?? {}) as { name?: Array<{ content?: string }> }).name) ?? [];
    const creator = cleanOrNull(names[0]?.content, 160);
    const unit = cleanOrNull(desc.data_source, 160);
    return [makeItem("Smithsonian Open Access", {
      provider: "smithsonian",
      providerItemId: row.id.slice(0, 120),
      title,
      contentType: "image",
      thumbnailUrl: httpsUrl(media.thumbnail),
      previewUrl: httpsUrl(media.content),
      externalUrl: page,
      downloadUrl: httpsUrl(media.content),
      creator,
      publisher: unit,
      license: { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
      attribution: [creator, unit, "Smithsonian", "CC0"].filter(Boolean).join(", "),
    })];
  });
}

export const smithsonian: ContentProvider = {
  id: "smithsonian",
  name: "Smithsonian Open Access",
  homepage: "https://www.si.edu/openaccess",
  docs: "https://edan.si.edu/openaccess/apidocs/",
  categories: ["images", "education"],
  auth: { kind: "api_key", env: ["SMITHSONIAN_API_KEY"] },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Only media the Smithsonian marks CC0 is shown.",
  rateLimit: "api.data.gov key: 1,000 requests per hour.",
  healthQuery: "dinosaur",
  async search(params, ctx) {
    const key = secret(ctx, "SMITHSONIAN_API_KEY");
    const q = new URLSearchParams({ q: `${params.query} AND online_media_type:"Images"`, api_key: key, rows: String(params.limit), start: String((params.page - 1) * params.limit) });
    return parseSmithsonian(await getJson(ctx, `https://api.si.edu/openaccess/api/v1.0/search?${q}`));
  },
};

// ─── Flickr ────────────────────────────────────────────────────────────────

// Flickr licence ids, from flickr.photos.licenses.getInfo. Only open ones are requested.
const FLICKR_LICENSES: Record<string, ContentLicense> = {
  "1": { name: "CC BY-NC-SA 2.0", url: "https://creativecommons.org/licenses/by-nc-sa/2.0/" },
  "2": { name: "CC BY-NC 2.0", url: "https://creativecommons.org/licenses/by-nc/2.0/" },
  "3": { name: "CC BY-NC-ND 2.0", url: "https://creativecommons.org/licenses/by-nc-nd/2.0/" },
  "4": { name: "CC BY 2.0", url: "https://creativecommons.org/licenses/by/2.0/" },
  "5": { name: "CC BY-SA 2.0", url: "https://creativecommons.org/licenses/by-sa/2.0/" },
  "6": { name: "CC BY-ND 2.0", url: "https://creativecommons.org/licenses/by-nd/2.0/" },
  "7": { name: "No known copyright restrictions", url: "https://www.flickr.com/commons/usage/" },
  "8": { name: "United States Government Work", url: "http://www.usa.gov/copyright.shtml" },
  "9": { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "10": { name: "Public Domain Mark", url: "https://creativecommons.org/publicdomain/mark/1.0/" },
};

export function parseFlickr(data: unknown): ExternalContentItem[] {
  const photos = ((data as { photos?: { photo?: Array<Record<string, unknown>> } })?.photos?.photo) ?? [];
  return photos.flatMap((p) => {
    const id = typeof p.id === "string" && /^\d+$/.test(p.id) ? p.id : null;
    const owner = typeof p.owner === "string" && /^[\w@-]+$/.test(p.owner) ? p.owner : null;
    const license = FLICKR_LICENSES[String(p.license)];
    const image = httpsUrl(p.url_m);
    if (!id || !owner || !license || !image) return [];
    const creator = cleanOrNull(p.ownername, 120);
    return [makeItem("Flickr", {
      provider: "flickr",
      providerItemId: id,
      title: clean(p.title, 200) || "Flickr photo",
      description: cleanOrNull(((p.description ?? {}) as { _content?: string })._content, 300),
      contentType: "image",
      thumbnailUrl: httpsUrl(p.url_q) ?? image,
      previewUrl: image,
      externalUrl: `https://www.flickr.com/photos/${owner}/${id}`,
      downloadUrl: image,
      creator,
      license: { name: license.name, url: httpsUrl(license.url) },
      attribution: [creator, license.name, "Flickr"].filter(Boolean).join(", "),
      publishedAt: typeof p.datetaken === "string" ? p.datetaken.slice(0, 10) : null,
    })];
  });
}

export const flickr: ContentProvider = {
  id: "flickr",
  name: "Flickr",
  homepage: "https://www.flickr.com",
  docs: "https://www.flickr.com/services/api/flickr.photos.search.html",
  categories: ["images"],
  auth: { kind: "api_key", env: ["FLICKR_API_KEY"] },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Only Creative Commons, public-domain and no-known-restriction photos are requested; each carries its licence.",
  rateLimit: "3,600 requests per hour per key; non-commercial keys are free, commercial use needs Flickr's approval.",
  healthQuery: "bridge",
  async search(params, ctx) {
    const key = secret(ctx, "FLICKR_API_KEY");
    const q = new URLSearchParams({
      method: "flickr.photos.search", api_key: key, text: params.query, license: Object.keys(FLICKR_LICENSES).join(","),
      safe_search: "1", content_type: "1", media: "photos", extras: "license,owner_name,url_m,url_q,description,date_taken",
      per_page: String(params.limit), page: String(params.page), format: "json", nojsoncallback: "1",
    });
    return parseFlickr(await getJson(ctx, `https://api.flickr.com/services/rest/?${q}`));
  },
};

// ─── Google Books ──────────────────────────────────────────────────────────

export function parseGoogleBooks(data: unknown): ExternalContentItem[] {
  const items = ((data as { items?: Array<Record<string, unknown>> })?.items) ?? [];
  return items.flatMap((item) => {
    const id = typeof item.id === "string" && /^[A-Za-z0-9_-]{1,20}$/.test(item.id) ? item.id : null;
    const info = (item.volumeInfo ?? {}) as Record<string, unknown>;
    const access = (item.accessInfo ?? {}) as { embeddable?: boolean; publicDomain?: boolean; viewability?: string };
    const title = clean(info.title, 200);
    if (!id || !title) return [];
    const images = (info.imageLinks ?? {}) as Record<string, string>;
    const canPreview = access.embeddable === true && access.viewability !== "NO_PAGES";
    return [makeItem("Google Books", {
      provider: "google_books",
      providerItemId: id,
      title,
      description: cleanOrNull(info.description, 400),
      contentType: "book",
      thumbnailUrl: httpsUrl(images.thumbnail?.replace(/^http:/, "https:")),
      embedUrl: canPreview ? embeds.googleBooks(id) : null,
      externalUrl: httpsUrl(info.infoLink) ?? `https://books.google.com/books?id=${id}`,
      creator: Array.isArray(info.authors) ? info.authors.map((a) => clean(a, 80)).filter(Boolean).slice(0, 3).join(", ") || null : null,
      publisher: cleanOrNull(info.publisher, 120),
      language: typeof info.language === "string" ? info.language.slice(0, 5) : null,
      license: access.publicDomain ? { name: "Public domain", url: null } : null,
      publishedAt: typeof info.publishedDate === "string" ? info.publishedDate.slice(0, 10) : null,
    })];
  });
}

export const googleBooks: ContentProvider = {
  id: "google_books",
  name: "Google Books",
  homepage: "https://books.google.com",
  docs: "https://developers.google.com/books/docs/v1/using",
  categories: ["books"],
  auth: { kind: "api_key", env: ["GOOGLE_BOOKS_API_KEY"] },
  capabilities: { search: true, preview: false, embed: true, download: false },
  licenseNote: "Book previews only through Google's embedded viewer, and only where the publisher allows it.",
  rateLimit: "1,000 requests per day by default. The keyless quota was exhausted when probed (HTTP 429).",
  healthQuery: "astronomy",
  async search(params, ctx) {
    const key = secret(ctx, "GOOGLE_BOOKS_API_KEY");
    const q = new URLSearchParams({ q: params.query, key, maxResults: String(params.limit), startIndex: String((params.page - 1) * params.limit), printType: "books", langRestrict: params.language });
    return parseGoogleBooks(await getJson(ctx, `https://www.googleapis.com/books/v1/volumes?${q}`));
  },
};

// ─── Podcast Index ─────────────────────────────────────────────────────────

async function sha1Hex(text: string): Promise<string> {
  // Hash the encoded view itself: a sliced ArrayBuffer crosses realms badly.
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function parsePodcastIndex(data: unknown): ExternalContentItem[] {
  const feeds = ((data as { feeds?: Array<Record<string, unknown>> })?.feeds) ?? [];
  return feeds.flatMap((f) => {
    const title = clean(f.title, 200);
    const link = httpsUrl(f.link) ?? httpsUrl(f.url);
    if (typeof f.id !== "number" || !title || !link) return [];
    return [makeItem("Podcast Index", {
      provider: "podcast_index",
      providerItemId: String(f.id),
      title,
      description: cleanOrNull(f.description, 300),
      contentType: "podcast",
      thumbnailUrl: httpsUrl(f.artwork ?? f.image),
      externalUrl: `https://podcastindex.org/podcast/${f.id}`,
      creator: cleanOrNull(f.author, 120),
      language: typeof f.language === "string" ? f.language.slice(0, 5) : null,
    })];
  });
}

export const podcastIndex: ContentProvider = {
  id: "podcast_index",
  name: "Podcast Index",
  homepage: "https://podcastindex.org",
  docs: "https://podcastindex-org.github.io/docs-api/",
  categories: ["audio"],
  auth: { kind: "api_key", env: ["PODCASTINDEX_API_KEY", "PODCASTINDEX_API_SECRET"] },
  capabilities: { search: true, preview: false, embed: false, download: false },
  licenseNote: "An open podcast directory; episodes belong to their shows.",
  rateLimit: "No published limit for a free key.",
  healthQuery: "science",
  async search(params, ctx) {
    const key = secret(ctx, "PODCASTINDEX_API_KEY");
    const apiSecret = secret(ctx, "PODCASTINDEX_API_SECRET");
    if (params.page > 1) return [];
    const date = String(Math.floor(Date.now() / 1000));
    const q = new URLSearchParams({ q: params.query, max: String(params.limit), clean: "true" });
    return parsePodcastIndex(await getJson(ctx, `https://api.podcastindex.org/api/1.0/search/byterm?${q}`, {
      headers: { "X-Auth-Date": date, "X-Auth-Key": key, Authorization: await sha1Hex(key + apiSecret + date) },
    }));
  },
};

// ─── CORE ──────────────────────────────────────────────────────────────────

export function parseCore(data: unknown): ExternalContentItem[] {
  const results = ((data as { results?: Array<Record<string, unknown>> })?.results) ?? [];
  return results.flatMap((w) => {
    const title = clean(w.title, 250);
    if (typeof w.id !== "number" || !title) return [];
    const download = httpsUrl(w.downloadUrl);
    const doi = typeof w.doi === "string" && /^10\.\S+$/.test(w.doi) ? w.doi : null;
    const authors = ((w.authors as Array<{ name?: string }>) ?? []).map((a) => clean(a.name, 80)).filter(Boolean);
    return [makeItem("CORE", {
      provider: "core",
      providerItemId: String(w.id),
      title,
      description: cleanOrNull(w.abstract, 500),
      contentType: "document",
      mimeType: download ? "application/pdf" : null,
      externalUrl: doi ? `https://doi.org/${doi}` : `https://core.ac.uk/works/${w.id}`,
      // CORE aggregates open-access repositories; the full text is the author's open copy.
      downloadUrl: download,
      creator: authors.slice(0, 3).join(", ") || null,
      publisher: cleanOrNull(w.publisher, 120),
      language: cleanOrNull(((w.language ?? {}) as { code?: string }).code, 5),
      publishedAt: typeof w.yearPublished === "number" ? String(w.yearPublished) : null,
    })];
  });
}

export const core: ContentProvider = {
  id: "core",
  name: "CORE",
  homepage: "https://core.ac.uk",
  docs: "https://api.core.ac.uk/docs/v3",
  categories: ["documents"],
  auth: { kind: "api_key", env: ["CORE_API_KEY"] },
  capabilities: { search: true, preview: false, embed: false, download: true },
  licenseNote: "Open-access research papers aggregated from repositories; full text is the author's open copy.",
  rateLimit: "Free key: 1,000 tokens per day, 10 per minute.",
  healthQuery: "education",
  async search(params, ctx) {
    const key = secret(ctx, "CORE_API_KEY");
    const q = new URLSearchParams({ q: params.query, limit: String(params.limit), offset: String((params.page - 1) * params.limit) });
    return parseCore(await getJson(ctx, `https://api.core.ac.uk/v3/search/works?${q}`, { headers: { Authorization: `Bearer ${key}` } }));
  },
};
