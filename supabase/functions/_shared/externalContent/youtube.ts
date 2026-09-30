/**
 * YouTube, through the official YouTube Data API v3 — discovery only.
 *
 * What this does: finds videos, channels and playlists, and describes them. What
 * it never does: download, proxy or scrape anything. A video is played only in
 * YouTube's own embedded player (the privacy-enhanced domain), every result links
 * to its page on YouTube, and every URL is built here from an id that passed a
 * pattern check — never taken from a response.
 *
 * ── Quota ──────────────────────────────────────────────────────────────────
 *
 * The default daily quota is 10,000 units, and one search costs 100. So:
 *   • page size is 12 by default and never above 20;
 *   • pages are explicit (a token comes back, the reader asks for the next one);
 *   • an identical search is answered from a short in-memory cache, and a stale
 *     entry is revalidated with its ETag (If-None-Match) instead of re-downloaded;
 *   • a page of video results costs ONE extra unit, not one per result: the
 *     durations come from a single batched videos.list;
 *   • fuller details (views, embeddability) are fetched only when a reader opens
 *     an item (`getYouTubeResource`), one unit each.
 *
 * ── Secrets ────────────────────────────────────────────────────────────────
 *
 * YOUTUBE_API_KEY is read from the server environment and sent in the
 * `x-goog-api-key` header, so it is never in a URL that a log could keep. No
 * error carries a URL, a header or a provider message: Google's error body is
 * read only to be classified, and what leaves this module is a VisionEX code.
 *
 * Pure of Deno and of any client: the caller passes `fetch` and `env`, so the
 * suite drives every branch offline.
 */

import { embeds } from "./embed.ts";
import { clean, cleanOrNull, makeItem } from "./http.ts";
import type { ExternalContentItem, Fetch, GetEnv } from "./types.ts";

const API = "https://www.googleapis.com/youtube/v3";
const TIMEOUT_MS = 8_000;

export const YOUTUBE_DEFAULT_LIMIT = 12;
export const YOUTUBE_MAX_LIMIT = 20;
export const YOUTUBE_MAX_QUERY_CHARS = 100;
const SEARCH_TTL_MS = 15 * 60 * 1000;
const RESOURCE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;

export type YouTubeResource = "video" | "channel" | "playlist";
export type YouTubeOrder = "relevance" | "date" | "viewCount";
export type YouTubeDuration = "short" | "medium" | "long";

// ─── Errors: what a caller may see ─────────────────────────────────────────

export type YouTubeErrorCode =
  | "youtube_not_configured"
  | "youtube_unavailable"
  | "youtube_quota_exceeded"
  | "youtube_rate_limited"
  | "youtube_invalid_request"
  | "youtube_not_found"
  | "youtube_timeout"
  | "youtube_bad_response"
  | "youtube_failed";

/** HTTP status for each code, for the Edge Function. */
export const YOUTUBE_ERROR_STATUS: Readonly<Record<YouTubeErrorCode, number>> = {
  youtube_not_configured: 503,
  youtube_unavailable: 503,
  youtube_quota_exceeded: 429,
  youtube_rate_limited: 429,
  youtube_invalid_request: 400,
  youtube_not_found: 404,
  youtube_timeout: 504,
  youtube_bad_response: 502,
  youtube_failed: 502,
};

export class YouTubeError extends Error {
  constructor(readonly code: YouTubeErrorCode, readonly detail?: string) {
    super(code);
    this.name = "YouTubeError";
  }
}

/**
 * Sorts a Google error into a VisionEX code. The body is only read here; nothing
 * of it is kept. A bad or blocked key and a disabled API are one code
 * ("unavailable"): the reader cannot fix either, and the difference is for the
 * operator, who reads it in the function log as a code.
 */
export function classifyGoogleError(status: number, body: unknown): YouTubeErrorCode {
  const err = ((body as { error?: unknown })?.error ?? {}) as {
    message?: unknown; errors?: Array<{ reason?: unknown }>; details?: Array<{ reason?: unknown }>;
  };
  const reasons = [...(err.errors ?? []), ...(err.details ?? [])].map((r) => String(r?.reason ?? ""));
  const message = typeof err.message === "string" ? err.message : "";
  const has = (...names: string[]) => reasons.some((r) => names.includes(r));
  if (has("rateLimitExceeded", "userRateLimitExceeded", "RATE_LIMIT_EXCEEDED")) return "youtube_rate_limited";
  if (status === 429 || has("quotaExceeded", "dailyLimitExceeded", "RESOURCE_EXHAUSTED")) return "youtube_quota_exceeded";
  if (
    has("keyInvalid", "API_KEY_INVALID", "accessNotConfigured", "SERVICE_DISABLED", "API_KEY_SERVICE_BLOCKED",
      "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED", "ipRefererBlocked", "forbidden") ||
    /API key not valid|API key expired|API_KEY_INVALID/i.test(message)
  ) return "youtube_unavailable";
  if (status === 401) return "youtube_unavailable";
  if (status === 404 || has("videoNotFound", "channelNotFound", "playlistNotFound", "notFound")) return "youtube_not_found";
  if (status === 400) return "youtube_invalid_request";
  if (status === 403) return "youtube_unavailable";
  return "youtube_failed";
}

/** The body and status an Edge Function answers with. Never carries a message from Google. */
export function youtubeErrorResponse(err: unknown): { status: number; body: { ok: false; error: YouTubeErrorCode } } {
  const code = err instanceof YouTubeError ? err.code : "youtube_failed";
  return { status: YOUTUBE_ERROR_STATUS[code], body: { ok: false, error: code } };
}

// ─── Counters ──────────────────────────────────────────────────────────────

export interface YouTubeStats {
  youtube_search_requests: number;
  youtube_video_detail_requests: number;
  youtube_channel_requests: number;
  youtube_playlist_requests: number;
  errors: number;
  cache_hits: number;
  cache_misses: number;
}

const zeroStats = (): YouTubeStats => ({
  youtube_search_requests: 0, youtube_video_detail_requests: 0, youtube_channel_requests: 0,
  youtube_playlist_requests: 0, errors: 0, cache_hits: 0, cache_misses: 0,
});
let stats = zeroStats();

/** What this server instance has spent since it started. Counts only; no query, no id, no key. */
export const youtubeStats = (): YouTubeStats => ({ ...stats });
export const resetYouTubeStats = (): void => { stats = zeroStats(); };

// ─── Input ─────────────────────────────────────────────────────────────────

export interface YouTubeSearchInput {
  query: string;
  type: YouTubeResource;
  order: YouTubeOrder;
  /** ISO 639-1, lower case. Relevance hint, not a filter. */
  language: string | null;
  /** ISO 3166-1 alpha-2, upper case. */
  region: string | null;
  captions: boolean;
  hd: boolean;
  duration: YouTubeDuration | null;
  channelId: string | null;
  pageToken: string | null;
  limit: number;
}

export type NormalizedYouTubeSearch =
  | { ok: true; value: YouTubeSearchInput }
  | { ok: false; reason: string };

export const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
const PAGE_TOKEN = /^[A-Za-z0-9_-]{1,120}$/;

const bool = (v: unknown): boolean => v === true || v === "true" || v === 1 || v === "1";

/**
 * Checks what a caller sent and turns it into one search, or says why not.
 *
 * The rules are YouTube's: captions, definition and duration exist only for
 * video searches; "most viewed" is offered for videos; a channel filter narrows
 * videos and playlists, and makes no sense while searching for channels.
 * A combination the API would reject or silently ignore is rejected here.
 */
export function normalizeYouTubeSearch(raw: unknown): NormalizedYouTubeSearch {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const query = typeof r.query === "string" ? r.query.replace(/\s+/g, " ").trim() : "";
  if (query.length < 2) return { ok: false, reason: "query" };
  if (query.length > YOUTUBE_MAX_QUERY_CHARS) return { ok: false, reason: "query_too_long" };

  const type = r.type === undefined || r.type === null || r.type === "" ? "video" : r.type;
  if (type !== "video" && type !== "channel" && type !== "playlist") return { ok: false, reason: "type" };

  const order = r.order === undefined || r.order === null || r.order === "" ? "relevance" : r.order;
  if (order !== "relevance" && order !== "date" && order !== "viewCount") return { ok: false, reason: "order" };
  if (order === "viewCount" && type !== "video") return { ok: false, reason: "order_not_supported_for_type" };

  let language: string | null = null;
  if (r.language !== undefined && r.language !== null && r.language !== "") {
    if (typeof r.language !== "string" || !/^[a-z]{2}$/i.test(r.language)) return { ok: false, reason: "language" };
    language = r.language.toLowerCase();
  }
  let region: string | null = null;
  if (r.region !== undefined && r.region !== null && r.region !== "") {
    if (typeof r.region !== "string" || !/^[a-z]{2}$/i.test(r.region)) return { ok: false, reason: "region" };
    region = r.region.toUpperCase();
  }

  const captions = bool(r.captions);
  const hd = bool(r.hd);
  let duration: YouTubeDuration | null = null;
  if (r.duration !== undefined && r.duration !== null && r.duration !== "") {
    if (r.duration !== "short" && r.duration !== "medium" && r.duration !== "long") return { ok: false, reason: "duration" };
    duration = r.duration;
  }
  if ((captions || hd || duration) && type !== "video") return { ok: false, reason: "video_filter_needs_video_type" };

  let channelId: string | null = null;
  if (r.channelId !== undefined && r.channelId !== null && r.channelId !== "") {
    if (typeof r.channelId !== "string" || !CHANNEL_ID.test(r.channelId)) return { ok: false, reason: "channel_id" };
    if (type === "channel") return { ok: false, reason: "channel_filter_needs_video_or_playlist" };
    channelId = r.channelId;
  }

  let pageToken: string | null = null;
  if (r.pageToken !== undefined && r.pageToken !== null && r.pageToken !== "") {
    if (typeof r.pageToken !== "string" || !PAGE_TOKEN.test(r.pageToken)) return { ok: false, reason: "page_token" };
    pageToken = r.pageToken;
  }

  const limit = r.limit === undefined || r.limit === null ? YOUTUBE_DEFAULT_LIMIT
    : Number.isInteger(r.limit) ? Math.min(Math.max(r.limit as number, 1), YOUTUBE_MAX_LIMIT) : NaN;
  if (Number.isNaN(limit)) return { ok: false, reason: "limit" };

  return { ok: true, value: { query, type, order, language, region, captions, hd, duration, channelId, pageToken, limit } };
}

// ─── Canonical URLs and thumbnails ─────────────────────────────────────────

export const youtubeUrl = {
  video: (id: string): string | null => VIDEO_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null,
  channel: (id: string): string | null => CHANNEL_ID.test(id) ? `https://www.youtube.com/channel/${id}` : null,
  playlist: (id: string): string | null => PLAYLIST_ID.test(id) ? `https://www.youtube.com/playlist?list=${id}` : null,
};

/** A YouTube page address we would store or show, or null. Anything else is not ours to link. */
export function isYouTubeResourceUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 200) return false;
  return /^https:\/\/www\.youtube\.com\/(watch\?v=[A-Za-z0-9_-]{11}|channel\/UC[A-Za-z0-9_-]{22}|playlist\?list=[A-Za-z0-9_-]{10,64})$/.test(value);
}

const THUMB_HOSTS = new Set(["i.ytimg.com", "yt3.ggpht.com", "yt3.googleusercontent.com"]);

function thumbnail(thumbs: unknown): string | null {
  const t = (thumbs ?? {}) as Record<string, { url?: unknown } | undefined>;
  for (const size of ["medium", "high", "default"]) {
    const url = t[size]?.url;
    if (typeof url !== "string") continue;
    try {
      const u = new URL(url);
      if (u.protocol === "https:" && THUMB_HOSTS.has(u.hostname) && !u.username && !u.password) return u.toString();
    } catch { /* try the next size */ }
  }
  return null;
}

/** ISO 8601 duration ("PT1H2M3S", "P1DT2H") to seconds; null when unreadable or zero. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!m) return null;
  const seconds = Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
  return seconds > 0 ? seconds : null;
}

// ─── Normalisation ─────────────────────────────────────────────────────────

const day = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

type Json = Record<string, unknown>;

function videoItem(id: string, snippet: Json, extra: Partial<ExternalContentItem> = {}, metadata: Record<string, string | number | boolean | null> = {}): ExternalContentItem | null {
  const url = youtubeUrl.video(id);
  const title = clean(snippet.title, 200);
  if (!url || !title) return null;
  const channelId = typeof snippet.channelId === "string" && CHANNEL_ID.test(snippet.channelId) ? snippet.channelId : null;
  const channelTitle = cleanOrNull(snippet.channelTitle, 120);
  return {
    ...makeItem("YouTube", {
      provider: "youtube",
      providerItemId: id,
      title,
      description: cleanOrNull(snippet.description, 500),
      contentType: "video",
      thumbnailUrl: thumbnail(snippet.thumbnails),
      embedUrl: embeds.youtube(id),
      externalUrl: url,
      creator: channelTitle,
      publisher: "YouTube",
      attribution: channelTitle ? `${channelTitle} · YouTube` : "YouTube",
      publishedAt: day(snippet.publishedAt),
      // Views, duration and embeddability are fetched when a reader opens the video.
      needsResolve: true,
    }),
    ...extra,
    metadata: { resourceType: "video", channelId, ...metadata },
  };
}

function channelItem(id: string, snippet: Json, metadata: Record<string, string | number | boolean | null> = {}): ExternalContentItem | null {
  const url = youtubeUrl.channel(id);
  const title = clean(snippet.title ?? snippet.channelTitle, 200);
  if (!url || !title) return null;
  return {
    ...makeItem("YouTube", {
      provider: "youtube",
      providerItemId: `channel:${id}`,
      title,
      description: cleanOrNull(snippet.description, 500),
      contentType: "channel",
      thumbnailUrl: thumbnail(snippet.thumbnails),
      externalUrl: url,
      creator: title,
      publisher: "YouTube",
      attribution: `${title} · YouTube`,
      publishedAt: day(snippet.publishedAt),
    }),
    metadata: { resourceType: "channel", channelId: id, ...metadata },
  };
}

function playlistItem(id: string, snippet: Json, metadata: Record<string, string | number | boolean | null> = {}): ExternalContentItem | null {
  const url = youtubeUrl.playlist(id);
  const title = clean(snippet.title, 200);
  if (!url || !title) return null;
  const channelId = typeof snippet.channelId === "string" && CHANNEL_ID.test(snippet.channelId) ? snippet.channelId : null;
  const channelTitle = cleanOrNull(snippet.channelTitle, 120);
  return {
    ...makeItem("YouTube", {
      provider: "youtube",
      providerItemId: `playlist:${id}`,
      title,
      description: cleanOrNull(snippet.description, 500),
      contentType: "playlist",
      thumbnailUrl: thumbnail(snippet.thumbnails),
      externalUrl: url,
      creator: channelTitle,
      publisher: "YouTube",
      attribution: channelTitle ? `${channelTitle} · YouTube` : "YouTube",
      publishedAt: day(snippet.publishedAt),
    }),
    metadata: { resourceType: "playlist", channelId, ...metadata },
  };
}

/** The results of a search.list answer, of any type. Ids and URLs are rebuilt here, never trusted. */
export function parseYouTubeSearch(data: unknown): ExternalContentItem[] {
  const items = ((data as { items?: unknown })?.items);
  if (!Array.isArray(items)) return [];
  return items.flatMap((entry) => {
    const item = (entry ?? {}) as Json;
    const id = (item.id ?? {}) as Json;
    const snippet = (item.snippet ?? {}) as Json;
    if (typeof id.videoId === "string") return [videoItem(id.videoId, snippet)].filter((x): x is ExternalContentItem => !!x);
    if (typeof id.channelId === "string") return [channelItem(id.channelId, snippet)].filter((x): x is ExternalContentItem => !!x);
    if (typeof id.playlistId === "string") return [playlistItem(id.playlistId, snippet)].filter((x): x is ExternalContentItem => !!x);
    return [];
  });
}

/** The old adapter's entry point, kept so a search.list answer still parses the same way. */
export const parseYouTube = parseYouTubeSearch;

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
};

/** One videos.list answer to the full item. Embeddable only when public or unlisted and the owner allows it. */
export function parseYouTubeVideo(data: unknown, requestedId: string): ExternalContentItem | null {
  const first = ((data as { items?: unknown })?.items);
  const entry = Array.isArray(first) ? (first[0] as Json | undefined) : undefined;
  if (!entry || entry.id !== requestedId) return null;
  const status = (entry.status ?? {}) as Json;
  const content = (entry.contentDetails ?? {}) as Json;
  const stats = (entry.statistics ?? {}) as Json;
  const snippet = (entry.snippet ?? {}) as Json;
  const embeddable = status.embeddable === true && (status.privacyStatus === "public" || status.privacyStatus === "unlisted");
  const item = videoItem(requestedId, snippet, {
    durationSeconds: parseIsoDuration(content.duration),
    needsResolve: false,
    language: cleanOrNull(snippet.defaultAudioLanguage ?? snippet.defaultLanguage, 12),
  }, {
    categoryId: typeof snippet.categoryId === "string" ? snippet.categoryId.slice(0, 6) : null,
    viewCount: num(stats.viewCount),
    likeCount: num(stats.likeCount),
    captionsAvailable: content.caption === "true" ? true : content.caption === "false" ? false : null,
    embeddable,
    live: typeof snippet.liveBroadcastContent === "string" && snippet.liveBroadcastContent !== "none",
  });
  if (!item) return null;
  return embeddable ? item : { ...item, embedUrl: null };
}

export function parseYouTubeChannel(data: unknown, requestedId: string): ExternalContentItem | null {
  const first = ((data as { items?: unknown })?.items);
  const entry = Array.isArray(first) ? (first[0] as Json | undefined) : undefined;
  if (!entry || entry.id !== requestedId) return null;
  const stats = (entry.statistics ?? {}) as Json;
  return channelItem(requestedId, (entry.snippet ?? {}) as Json, {
    country: cleanOrNull(((entry.snippet ?? {}) as Json).country, 2),
    videoCount: num(stats.videoCount),
    viewCount: num(stats.viewCount),
    subscriberCount: stats.hiddenSubscriberCount === true ? null : num(stats.subscriberCount),
  });
}

export function parseYouTubePlaylist(data: unknown, requestedId: string): ExternalContentItem | null {
  const first = ((data as { items?: unknown })?.items);
  const entry = Array.isArray(first) ? (first[0] as Json | undefined) : undefined;
  if (!entry || entry.id !== requestedId) return null;
  const content = (entry.contentDetails ?? {}) as Json;
  return playlistItem(requestedId, (entry.snippet ?? {}) as Json, { itemCount: num(content.itemCount) });
}

// ─── Requests ──────────────────────────────────────────────────────────────

interface CacheEntry { at: number; etag: string | null; body: unknown }

export class YouTubeCache {
  private entries = new Map<string, CacheEntry>();
  constructor(private max = CACHE_MAX) {}
  get(key: string): CacheEntry | undefined {
    const hit = this.entries.get(key);
    if (hit) { this.entries.delete(key); this.entries.set(key, hit); }
    return hit;
  }
  set(key: string, entry: CacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
  get size(): number { return this.entries.size; }
}

const sharedCache = new YouTubeCache();

export interface YouTubeDeps {
  fetch: Fetch;
  env: GetEnv;
  /** null turns caching off (tests); omitted uses the shared one. */
  cache?: YouTubeCache | null;
  now?: () => number;
}

function apiKey(env: GetEnv): string {
  const key = env("YOUTUBE_API_KEY")?.trim();
  if (!key) throw new YouTubeError("youtube_not_configured");
  return key;
}

type Counter = "youtube_search_requests" | "youtube_video_detail_requests" | "youtube_channel_requests" | "youtube_playlist_requests";

/**
 * One GET against the API: cached, revalidated by ETag, timed out, and reduced to
 * a VisionEX error on any failure. `cacheKey` is built from the normalised
 * request, never from a URL, so the key can never appear in it.
 */
async function call(
  deps: YouTubeDeps, endpoint: string, params: Record<string, string>, cacheKey: string, ttlMs: number, counter: Counter,
): Promise<{ body: unknown; cached: boolean }> {
  const key = apiKey(deps.env);
  const now = deps.now ?? (() => Date.now());
  const cache = deps.cache === undefined ? sharedCache : deps.cache;
  const hit = cache?.get(cacheKey);
  if (hit && now() - hit.at < ttlMs) {
    stats.cache_hits++;
    return { body: hit.body, cached: true };
  }
  stats.cache_misses++;

  const headers: Record<string, string> = { Accept: "application/json", "x-goog-api-key": key };
  // A stale entry is revalidated: a 304 keeps the body and costs no download.
  if (hit?.etag) headers["If-None-Match"] = hit.etag;

  let res: Response;
  try {
    stats[counter]++;
    res = await deps.fetch(`${API}/${endpoint}?${new URLSearchParams(params)}`, {
      headers,
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
    });
  } catch (err) {
    stats.errors++;
    const name = (err as { name?: string } | null)?.name;
    throw new YouTubeError(name === "TimeoutError" || name === "AbortError" ? "youtube_timeout" : "youtube_failed");
  }

  if (res.status === 304 && hit) {
    cache?.set(cacheKey, { ...hit, at: now() });
    return { body: hit.body, cached: true };
  }
  if (!res.ok) {
    stats.errors++;
    let body: unknown = null;
    try { body = await res.json(); } catch { /* an unreadable error body is classified by status alone */ }
    throw new YouTubeError(classifyGoogleError(res.status, body), `${endpoint} ${res.status}`);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    stats.errors++;
    throw new YouTubeError("youtube_bad_response");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    stats.errors++;
    throw new YouTubeError("youtube_bad_response");
  }
  const etag = res.headers.get("etag") ?? (typeof (body as { etag?: unknown }).etag === "string" ? (body as { etag: string }).etag : null);
  cache?.set(cacheKey, { at: now(), etag, body });
  return { body, cached: false };
}

// ─── Search ────────────────────────────────────────────────────────────────

export interface YouTubePage {
  items: ExternalContentItem[];
  nextPageToken: string | null;
  prevPageToken: string | null;
  totalResults: number | null;
  cached: boolean;
}

const SEARCH_FIELDS = "etag,nextPageToken,prevPageToken,pageInfo(totalResults),items(id(kind,videoId,channelId,playlistId),snippet(publishedAt,channelId,title,description,thumbnails(default,medium,high),channelTitle))";

export function searchParamsFor(input: YouTubeSearchInput): Record<string, string> {
  const p: Record<string, string> = {
    part: "snippet", type: input.type, q: input.query, maxResults: String(input.limit), order: input.order,
    // Public content for a public audience that includes children: strict, always.
    safeSearch: "strict", fields: SEARCH_FIELDS,
  };
  if (input.language) p.relevanceLanguage = input.language;
  if (input.region) p.regionCode = input.region;
  if (input.channelId) p.channelId = input.channelId;
  if (input.pageToken) p.pageToken = input.pageToken;
  if (input.type === "video") {
    // A result the reader cannot play in the embedded player is not a result.
    p.videoEmbeddable = "true";
    if (input.captions) p.videoCaption = "closedCaption";
    if (input.hd) p.videoDefinition = "high";
    if (input.duration) p.videoDuration = input.duration;
  }
  return p;
}

/** Durations for a page of videos in ONE request (one quota unit), not one request per result. */
async function withDurations(items: ExternalContentItem[], deps: YouTubeDeps): Promise<ExternalContentItem[]> {
  const ids = items.filter((i) => i.contentType === "video").map((i) => i.providerItemId);
  if (ids.length === 0) return items;
  try {
    const { body } = await call(deps, "videos", {
      part: "contentDetails", id: ids.join(","), maxResults: String(ids.length), fields: "items(id,contentDetails(duration))",
    }, `durations|${ids.join(",")}`, RESOURCE_TTL_MS, "youtube_video_detail_requests");
    const seconds = new Map<string, number>();
    for (const v of ((body as { items?: Array<{ id?: unknown; contentDetails?: { duration?: unknown } }> }).items ?? [])) {
      const s = parseIsoDuration(v.contentDetails?.duration);
      if (typeof v.id === "string" && s) seconds.set(v.id, s);
    }
    return items.map((i) => (seconds.has(i.providerItemId) ? { ...i, durationSeconds: seconds.get(i.providerItemId)! } : i));
  } catch {
    // Durations are an addition; the results stand without them.
    return items;
  }
}

/** Stable across identical searches; never contains the key. */
export const searchCacheKey = (i: YouTubeSearchInput): string =>
  ["search", i.type, i.order, i.language ?? "", i.region ?? "", i.captions ? "cc" : "", i.hd ? "hd" : "", i.duration ?? "", i.channelId ?? "", i.limit, i.pageToken ?? "", i.query.toLowerCase()].join("|");

export async function searchYouTube(input: YouTubeSearchInput, deps: YouTubeDeps): Promise<YouTubePage> {
  const { body, cached } = await call(deps, "search", searchParamsFor(input), searchCacheKey(input), SEARCH_TTL_MS, "youtube_search_requests");
  const b = body as { nextPageToken?: unknown; prevPageToken?: unknown; pageInfo?: { totalResults?: unknown }; items?: unknown };
  if (!Array.isArray(b.items)) throw new YouTubeError("youtube_bad_response");
  const parsed = parseYouTubeSearch(b);
  const items = input.type === "video" ? await withDurations(parsed, deps) : parsed;
  const token = (v: unknown) => (typeof v === "string" && PAGE_TOKEN.test(v) ? v : null);
  return {
    items,
    nextPageToken: token(b.nextPageToken),
    prevPageToken: token(b.prevPageToken),
    totalResults: num(b.pageInfo?.totalResults),
    cached,
  };
}

// ─── One resource ──────────────────────────────────────────────────────────

const VIDEO_FIELDS = "etag,items(id,snippet(publishedAt,channelId,title,description,thumbnails(default,medium,high),channelTitle,categoryId,defaultLanguage,defaultAudioLanguage,liveBroadcastContent),contentDetails(duration,caption),status(privacyStatus,embeddable),statistics(viewCount,likeCount))";
const CHANNEL_FIELDS = "etag,items(id,snippet(title,description,publishedAt,thumbnails(default,medium,high),country),statistics(viewCount,subscriberCount,hiddenSubscriberCount,videoCount))";
const PLAYLIST_FIELDS = "etag,items(id,snippet(title,description,publishedAt,channelId,channelTitle,thumbnails(default,medium,high)),contentDetails(itemCount))";

/** The full item for a video, channel or playlist id. Unavailable, private and deleted ones are "not found". */
export async function getYouTubeResource(type: YouTubeResource, id: string, deps: YouTubeDeps): Promise<ExternalContentItem> {
  const valid = type === "video" ? VIDEO_ID.test(id) : type === "channel" ? CHANNEL_ID.test(id) : type === "playlist" ? PLAYLIST_ID.test(id) : false;
  if (!valid) throw new YouTubeError("youtube_invalid_request");
  const spec = type === "video"
    ? { endpoint: "videos", part: "snippet,contentDetails,status,statistics", fields: VIDEO_FIELDS, counter: "youtube_video_detail_requests" as const }
    : type === "channel"
      ? { endpoint: "channels", part: "snippet,statistics", fields: CHANNEL_FIELDS, counter: "youtube_channel_requests" as const }
      : { endpoint: "playlists", part: "snippet,contentDetails", fields: PLAYLIST_FIELDS, counter: "youtube_playlist_requests" as const };
  const { body } = await call(deps, spec.endpoint, { part: spec.part, id, maxResults: "1", fields: spec.fields }, `${type}|${id}`, RESOURCE_TTL_MS, spec.counter);
  const item = type === "video" ? parseYouTubeVideo(body, id) : type === "channel" ? parseYouTubeChannel(body, id) : parseYouTubePlaylist(body, id);
  if (!item) throw new YouTubeError("youtube_not_found");
  return item;
}

/** "channel:UC…" / "playlist:PL…" / an 11-character video id, as the registry stores them. */
export function splitYouTubeItemId(providerItemId: string): { type: YouTubeResource; id: string } | null {
  if (VIDEO_ID.test(providerItemId)) return { type: "video", id: providerItemId };
  const m = /^(channel|playlist):(.+)$/.exec(providerItemId);
  if (!m) return null;
  return m[1] === "channel" ? (CHANNEL_ID.test(m[2]) ? { type: "channel", id: m[2] } : null) : (PLAYLIST_ID.test(m[2]) ? { type: "playlist", id: m[2] } : null);
}
