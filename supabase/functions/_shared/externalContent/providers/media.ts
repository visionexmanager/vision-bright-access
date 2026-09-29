/**
 * Video, podcasts and radio with keyless public APIs: Dailymotion (official
 * embeds), Apple Podcasts search (directory data and each show's own episode
 * files) and Radio Browser (a community directory of live stations).
 */

import { embeds } from "../embed.ts";
import { clean, cleanOrNull, getJson, httpsUrl, makeItem, positiveNumber } from "../http.ts";
import type { ContentProvider, ExternalContentItem } from "../types.ts";

// ─── Dailymotion ───────────────────────────────────────────────────────────

export function parseDailymotion(data: unknown): ExternalContentItem[] {
  const list = ((data as { list?: Array<Record<string, unknown>> })?.list) ?? [];
  return list.flatMap((video) => {
    const id = typeof video.id === "string" && /^[A-Za-z0-9]{1,20}$/.test(video.id) ? video.id : null;
    const title = clean(video.title, 200);
    if (!id || !title) return [];
    const created = positiveNumber(video.created_time);
    return [makeItem("Dailymotion", {
      provider: "dailymotion",
      providerItemId: id,
      title,
      description: cleanOrNull(video.description, 300),
      contentType: "video",
      thumbnailUrl: httpsUrl(video.thumbnail_360_url),
      embedUrl: video.allow_embed === false ? null : embeds.dailymotion(id),
      externalUrl: `https://www.dailymotion.com/video/${id}`,
      creator: cleanOrNull(video["owner.screenname"], 120),
      durationSeconds: positiveNumber(video.duration),
      language: typeof video.language === "string" ? video.language.slice(0, 5) : null,
      publishedAt: created ? new Date(created * 1000).toISOString().slice(0, 10) : null,
    })];
  });
}

export const dailymotion: ContentProvider = {
  id: "dailymotion",
  name: "Dailymotion",
  homepage: "https://www.dailymotion.com",
  docs: "https://developers.dailymotion.com/api/platform-api/reference/",
  categories: ["video"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: true, download: false },
  licenseNote: "Videos belong to their uploaders; shown only through Dailymotion's official player, never copied.",
  rateLimit: "Public data reads need no key; Dailymotion throttles heavy anonymous use.",
  healthQuery: "science",
  async search(params, ctx) {
    const q = new URLSearchParams({
      search: params.query, limit: String(params.limit), page: String(params.page),
      family_filter: "true", fields: "id,title,description,thumbnail_360_url,duration,owner.screenname,language,created_time,allow_embed",
    });
    return parseDailymotion(await getJson(ctx, `https://api.dailymotion.com/videos?${q}`));
  },
};

// ─── Apple Podcasts ────────────────────────────────────────────────────────

function podcastShow(show: Record<string, unknown>): ExternalContentItem | null {
  const id = typeof show.collectionId === "number" ? show.collectionId : null;
  const title = clean(show.collectionName, 200);
  const page = httpsUrl(show.collectionViewUrl);
  if (!id || !title || !page) return null;
  return makeItem("Apple Podcasts", {
    provider: "apple_podcasts",
    providerItemId: String(id),
    title,
    contentType: "podcast",
    thumbnailUrl: httpsUrl(show.artworkUrl600 ?? show.artworkUrl100),
    externalUrl: page.split("?")[0],
    creator: cleanOrNull(show.artistName, 160),
    tags: Array.isArray(show.genres) ? show.genres.filter((g): g is string => typeof g === "string" && g !== "Podcasts").slice(0, 4) : [],
    publishedAt: typeof show.releaseDate === "string" ? show.releaseDate.slice(0, 10) : null,
    // The latest episode's file comes from a lookup.
    needsResolve: true,
  });
}

export function parsePodcastSearch(data: unknown): ExternalContentItem[] {
  const results = ((data as { results?: Array<Record<string, unknown>> })?.results) ?? [];
  return results.flatMap((r) => (r.kind === "podcast" ? podcastShow(r) : null) ?? []);
}

/** The show plus its newest episode that is served over https, as the playable preview. */
export function parsePodcastLookup(data: unknown): ExternalContentItem | null {
  const results = ((data as { results?: Array<Record<string, unknown>> })?.results) ?? [];
  const show = results.find((r) => r.kind === "podcast");
  const base = show ? podcastShow(show) : null;
  if (!base) return null;
  const episode = results.find((r) => r.wrapperType === "podcastEpisode" && httpsUrl(r.episodeUrl));
  if (!episode) return { ...base, needsResolve: false };
  const millis = positiveNumber(episode.trackTimeMillis);
  const ext = typeof episode.episodeFileExtension === "string" ? episode.episodeFileExtension : "";
  return {
    ...base,
    description: [clean(episode.trackName, 200), clean(episode.description, 300)].filter(Boolean).join(" — ") || null,
    mimeType: ext === "mp3" ? "audio/mpeg" : ext === "m4a" ? "audio/mp4" : null,
    previewUrl: httpsUrl(episode.episodeUrl),
    durationSeconds: millis ? Math.round(millis / 1000) : null,
    publishedAt: typeof episode.releaseDate === "string" ? episode.releaseDate.slice(0, 10) : base.publishedAt,
    needsResolve: false,
  };
}

export const applePodcasts: ContentProvider = {
  id: "apple_podcasts",
  name: "Apple Podcasts",
  homepage: "https://podcasts.apple.com",
  docs: "https://performance-partners.apple.com/search-api",
  categories: ["audio", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: true, embed: false, download: false },
  licenseNote: "Directory data from the iTunes Search API; episodes stream from each show's own public feed and remain the show's property.",
  rateLimit: "About 20 requests per minute (Apple's guidance).",
  healthQuery: "history",
  async search(params, ctx) {
    // The Search API has no paging beyond `limit`.
    if (params.page > 1) return [];
    const q = new URLSearchParams({ term: params.query, media: "podcast", limit: String(params.limit) });
    return parsePodcastSearch(await getJson(ctx, `https://itunes.apple.com/search?${q}`));
  },
  async getItem(providerItemId, ctx) {
    if (!/^\d{1,15}$/.test(providerItemId)) return null;
    const q = new URLSearchParams({ id: providerItemId, entity: "podcastEpisode", limit: "5" });
    return parsePodcastLookup(await getJson(ctx, `https://itunes.apple.com/lookup?${q}`));
  },
};

// ─── Radio Browser ─────────────────────────────────────────────────────────

export function parseRadioBrowser(data: unknown): ExternalContentItem[] {
  const stations = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
  return stations.flatMap((s) => {
    const id = typeof s.stationuuid === "string" && /^[0-9a-f-]{36}$/.test(s.stationuuid) ? s.stationuuid : null;
    const name = clean(s.name, 160);
    // An http stream would be blocked on an https page, and HLS needs a player
    // the browser does not have natively.
    const stream = s.hls === 1 ? null : httpsUrl(s.url_resolved);
    if (!id || !name || s.lastcheckok === 0) return [];
    const homepage = httpsUrl(s.homepage);
    return [makeItem("Radio Browser", {
      provider: "radio_browser",
      providerItemId: id,
      title: name,
      description: [clean(s.country, 80), clean(s.codec, 20), positiveNumber(s.bitrate) ? `${s.bitrate} kbps` : ""].filter(Boolean).join(" · ") || null,
      contentType: "radio",
      thumbnailUrl: httpsUrl(s.favicon),
      previewUrl: stream,
      externalUrl: homepage ?? `https://www.radio-browser.info/history/${id}`,
      language: typeof s.languagecodes === "string" && s.languagecodes ? s.languagecodes.split(",")[0].slice(0, 5) : null,
      tags: typeof s.tags === "string" ? s.tags.split(",").map((t) => clean(t, 40)).filter(Boolean).slice(0, 5) : [],
    })];
  });
}

export const radioBrowser: ContentProvider = {
  id: "radio_browser",
  name: "Radio Browser",
  homepage: "https://www.radio-browser.info",
  docs: "https://api.radio-browser.info/",
  categories: ["audio"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: true, embed: false, download: false },
  licenseNote: "The directory is public domain; streams are the stations' own public broadcasts, played live and never recorded.",
  rateLimit: "Community servers; no published quota.",
  healthQuery: "news",
  async search(params, ctx) {
    const q = new URLSearchParams({
      name: params.query, limit: String(params.limit), offset: String((params.page - 1) * params.limit),
      hidebroken: "true", order: "clickcount", reverse: "true",
    });
    return parseRadioBrowser(await getJson(ctx, `https://all.api.radio-browser.info/json/stations/search?${q}`));
  },
};
