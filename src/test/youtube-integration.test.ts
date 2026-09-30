// YouTube through the official Data API v3: discovery only. Every branch is
// driven offline with a stand-in for fetch; nothing here reaches Google.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { mergeResults, normalizeSearchInput, searchExternalContent } from "../../supabase/functions/_shared/externalContent/aggregate.ts";
import { ProviderError } from "../../supabase/functions/_shared/externalContent/http.ts";
import { providerStatus } from "../../supabase/functions/_shared/externalContent/registry.ts";
import { youtube } from "../../supabase/functions/_shared/externalContent/providers/keyed.ts";
import {
  YOUTUBE_DEFAULT_LIMIT, YOUTUBE_MAX_LIMIT, YouTubeCache, YouTubeError, classifyGoogleError, getYouTubeResource, isYouTubeResourceUrl,
  normalizeYouTubeSearch, parseIsoDuration, parseYouTubeChannel, parseYouTubePlaylist, parseYouTubeSearch, parseYouTubeVideo, resetYouTubeStats,
  searchCacheKey, searchParamsFor, searchYouTube, splitYouTubeItemId, youtubeErrorResponse, youtubeStats, youtubeUrl,
  type YouTubeSearchInput,
} from "../../supabase/functions/_shared/externalContent/youtube.ts";

const KEY = "AIza-TEST-KEY-never-real";
const env = (n: string) => (n === "YOUTUBE_API_KEY" ? KEY : undefined);
const noEnv = () => undefined;
const VIDEO = "dQw4w9WgXcQ";
const CHANNEL = "UCX6OQ3DkcsbYNE6H8uQQuVA";
const PLAYLIST = "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf";
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const searchBody = (over: Record<string, unknown> = {}) => ({
  etag: "etag-1", nextPageToken: "CAoQAA", prevPageToken: "CAUQAQ", pageInfo: { totalResults: 1234 },
  items: [
    { id: { kind: "youtube#video", videoId: VIDEO }, snippet: { publishedAt: "2026-03-12T10:00:00Z", channelId: CHANNEL, title: "Photosynthesis explained", description: "How <b>plants</b> make food", channelTitle: "Edu Channel", thumbnails: { medium: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg" } } } },
    { id: { kind: "youtube#video", videoId: "aaaaaaaaaaa" }, snippet: { publishedAt: "2026-03-01T10:00:00Z", channelId: CHANNEL, title: "Second video", channelTitle: "Edu Channel" } },
  ],
  ...over,
});
const durationsBody = { items: [{ id: VIDEO, contentDetails: { duration: "PT1H2M3S" } }, { id: "aaaaaaaaaaa", contentDetails: { duration: "PT4M5S" } }] };

const input = (over: Partial<YouTubeSearchInput> = {}): YouTubeSearchInput => ({
  query: "photosynthesis", type: "video", order: "relevance", language: null, region: null, captions: false, hd: false,
  duration: null, channelId: null, pageToken: null, limit: 12, ...over,
});

/** A fetch that answers by endpoint and records every call. */
function api(answers: { search?: () => Response; videos?: () => Response; channels?: () => Response; playlists?: () => Response }) {
  const calls: Array<{ url: URL; headers: Record<string, string> }> = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    calls.push({ url: u, headers: (init?.headers ?? {}) as Record<string, string> });
    const endpoint = u.pathname.split("/").pop() as "search" | "videos" | "channels" | "playlists";
    const answer = answers[endpoint];
    if (!answer) throw new Error(`unexpected ${endpoint}`);
    return answer();
  });
  return { fetchFn, calls };
}

// ─── Input: what a caller may ask for ─────────────────────────────────────

describe("normalizeYouTubeSearch", () => {
  const ok = (raw: unknown) => { const r = normalizeYouTubeSearch(raw); if (!("value" in r)) throw new Error((r as { reason: string }).reason); return r.value; };
  const why = (raw: unknown) => { const r = normalizeYouTubeSearch(raw); return "value" in r ? null : (r as { reason: string }).reason; };

  it("defaults to a conservative video search", () => {
    expect(ok({ query: "  photosynthesis   basics " })).toEqual({
      query: "photosynthesis basics", type: "video", order: "relevance", language: null, region: null, captions: false, hd: false,
      duration: null, channelId: null, pageToken: null, limit: YOUTUBE_DEFAULT_LIMIT,
    });
    expect(YOUTUBE_DEFAULT_LIMIT).toBeLessThanOrEqual(20);
  });

  it("accepts each kind, each sort, and the filters that fit", () => {
    expect(ok({ query: "x1", type: "channel", order: "date" })).toMatchObject({ type: "channel", order: "date" });
    expect(ok({ query: "x1", type: "playlist", order: "relevance" })).toMatchObject({ type: "playlist" });
    expect(ok({ query: "x1", type: "video", order: "viewCount", captions: true, hd: "true", duration: "long", language: "AR", region: "jo" }))
      .toMatchObject({ order: "viewCount", captions: true, hd: true, duration: "long", language: "ar", region: "JO" });
    expect(ok({ query: "x1", type: "video", channelId: CHANNEL })).toMatchObject({ channelId: CHANNEL });
    expect(ok({ query: "x1", type: "playlist", channelId: CHANNEL })).toMatchObject({ type: "playlist", channelId: CHANNEL });
  });

  it("rejects what the API would refuse or silently ignore", () => {
    expect(why({ query: "x1", type: "channel", captions: true })).toBe("video_filter_needs_video_type");
    expect(why({ query: "x1", type: "playlist", hd: true })).toBe("video_filter_needs_video_type");
    expect(why({ query: "x1", type: "channel", duration: "short" })).toBe("video_filter_needs_video_type");
    expect(why({ query: "x1", type: "channel", order: "viewCount" })).toBe("order_not_supported_for_type");
    expect(why({ query: "x1", type: "playlist", order: "viewCount" })).toBe("order_not_supported_for_type");
    expect(why({ query: "x1", type: "channel", channelId: CHANNEL })).toBe("channel_filter_needs_video_or_playlist");
  });

  it("rejects malformed values", () => {
    expect(why({ query: "" })).toBe("query");
    expect(why({ query: "a" })).toBe("query");
    expect(why({ query: "x".repeat(101) })).toBe("query_too_long");
    expect(why({ query: 5 })).toBe("query");
    expect(why(null)).toBe("query");
    expect(why({ query: "x1", type: "live" })).toBe("type");
    expect(why({ query: "x1", order: "rating" })).toBe("order");
    expect(why({ query: "x1", order: "videoCount" })).toBe("order");
    expect(why({ query: "x1", language: "english" })).toBe("language");
    expect(why({ query: "x1", region: "USA" })).toBe("region");
    expect(why({ query: "x1", duration: "epic" })).toBe("duration");
    expect(why({ query: "x1", channelId: "UCshort" })).toBe("channel_id");
    expect(why({ query: "x1", channelId: `${CHANNEL}` .replace("UC", "XX") })).toBe("channel_id");
    expect(why({ query: "x1", pageToken: "bad token!" })).toBe("page_token");
    expect(why({ query: "x1", pageToken: "a".repeat(200) })).toBe("page_token");
    expect(why({ query: "x1", limit: 1.5 })).toBe("limit");
    expect(why({ query: "x1", limit: "12" })).toBe("limit");
  });

  it("clamps the page size, and never lets it pass 20", () => {
    expect(ok({ query: "x1", limit: 500 }).limit).toBe(YOUTUBE_MAX_LIMIT);
    expect(ok({ query: "x1", limit: 0 }).limit).toBe(1);
    expect(ok({ query: "x1", limit: -3 }).limit).toBe(1);
    expect(YOUTUBE_MAX_LIMIT).toBe(20);
  });

  it("ignores everything else a caller sends: safe search, embeddability and the raw API parameters are not theirs to set", () => {
    const value = ok({ query: "x1", safeSearch: "none", videoEmbeddable: "false", key: "AIza-attacker", part: "id", forContentOwner: true, maxResults: 50 });
    const params = searchParamsFor(value);
    expect(params.safeSearch).toBe("strict");
    expect(params.videoEmbeddable).toBe("true");
    expect(params.part).toBe("snippet");
    expect(params.maxResults).toBe(String(YOUTUBE_DEFAULT_LIMIT));
    expect(params).not.toHaveProperty("key");
    expect(params).not.toHaveProperty("forContentOwner");
  });
});

describe("the request that goes to search.list", () => {
  it("uses the official parameters for a video search", () => {
    const p = searchParamsFor(input({ language: "ar", region: "JO", order: "viewCount", captions: true, hd: true, duration: "medium", channelId: CHANNEL, pageToken: "CAoQAA", limit: 10 }));
    expect(p).toMatchObject({
      part: "snippet", type: "video", q: "photosynthesis", maxResults: "10", order: "viewCount", safeSearch: "strict", videoEmbeddable: "true",
      relevanceLanguage: "ar", regionCode: "JO", channelId: CHANNEL, pageToken: "CAoQAA", videoCaption: "closedCaption", videoDefinition: "high", videoDuration: "medium",
    });
    expect(p.fields).toContain("nextPageToken");
    expect(p.fields).toContain("items(id(kind,videoId,channelId,playlistId)");
  });

  it("sends no video-only parameter with a channel or playlist search", () => {
    for (const type of ["channel", "playlist"] as const) {
      const p = searchParamsFor(input({ type }));
      for (const name of ["videoEmbeddable", "videoCaption", "videoDefinition", "videoDuration"]) expect(p, `${type} ${name}`).not.toHaveProperty(name);
      expect(p.type).toBe(type);
    }
  });
});

// ─── Normalisation ────────────────────────────────────────────────────────

describe("results", () => {
  it("normalises a video: an id-built address, YouTube's own player, the channel, the date, and 'resolve me on open'", () => {
    const [video] = parseYouTubeSearch(searchBody());
    expect(video).toMatchObject({
      id: `youtube:${VIDEO}`, provider: "youtube", providerName: "YouTube", providerItemId: VIDEO, title: "Photosynthesis explained",
      description: "How plants make food", contentType: "video", creator: "Edu Channel", publisher: "YouTube",
      externalUrl: `https://www.youtube.com/watch?v=${VIDEO}`, embedUrl: `https://www.youtube-nocookie.com/embed/${VIDEO}`,
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg", publishedAt: "2026-03-12", attribution: "Edu Channel · YouTube",
      downloadUrl: null, previewUrl: null, license: null, needsResolve: true,
      metadata: { resourceType: "video", channelId: CHANNEL },
    });
  });

  it("normalises a channel", () => {
    const [channel] = parseYouTubeSearch({ items: [{ id: { kind: "youtube#channel", channelId: CHANNEL }, snippet: { title: "Edu Channel", description: "Lessons", publishedAt: "2015-01-02T00:00:00Z", thumbnails: { default: { url: "https://yt3.ggpht.com/a=s88" } } } }] });
    expect(channel).toMatchObject({
      id: `youtube:channel:${CHANNEL}`, providerItemId: `channel:${CHANNEL}`, contentType: "channel", title: "Edu Channel", creator: "Edu Channel",
      externalUrl: `https://www.youtube.com/channel/${CHANNEL}`, embedUrl: null, downloadUrl: null, publishedAt: "2015-01-02",
      thumbnailUrl: "https://yt3.ggpht.com/a=s88", metadata: { resourceType: "channel", channelId: CHANNEL },
    });
  });

  it("normalises a playlist", () => {
    const [playlist] = parseYouTubeSearch({ items: [{ id: { kind: "youtube#playlist", playlistId: PLAYLIST }, snippet: { title: "Biology course", channelId: CHANNEL, channelTitle: "Edu Channel", description: "All lectures" } }] });
    expect(playlist).toMatchObject({
      id: `youtube:playlist:${PLAYLIST}`, providerItemId: `playlist:${PLAYLIST}`, contentType: "playlist", title: "Biology course", creator: "Edu Channel",
      externalUrl: `https://www.youtube.com/playlist?list=${PLAYLIST}`, embedUrl: null, metadata: { resourceType: "playlist", channelId: CHANNEL },
    });
  });

  it("drops anything with an id that is not a YouTube id, and rebuilds every address from the id", () => {
    const items = parseYouTubeSearch({ items: [
      { id: { videoId: "short" }, snippet: { title: "bad video id" } },
      { id: { channelId: "UCshort" }, snippet: { title: "bad channel id" } },
      { id: { playlistId: "x" }, snippet: { title: "bad playlist id" } },
      { id: { kind: "youtube#video" }, snippet: { title: "no id at all" } },
      { id: { videoId: VIDEO }, snippet: { title: "" } },
      { id: { videoId: VIDEO }, snippet: { title: "Good", url: "https://evil.example/x", channelId: "UCevil", thumbnails: { medium: { url: "https://evil.example/t.jpg" }, default: { url: "http://i.ytimg.com/plain.jpg" } } } },
      null, 5, "x",
    ] });
    expect(items).toHaveLength(1);
    expect(items[0].externalUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO}`);
    expect(items[0].thumbnailUrl).toBeNull(); // not a YouTube image host, or not https
    expect(items[0].metadata?.channelId).toBeNull(); // not a channel id
    expect(parseYouTubeSearch(null)).toEqual([]);
    expect(parseYouTubeSearch({ items: "nope" })).toEqual([]);
  });

  it("strips markup from titles and descriptions", () => {
    const [v] = parseYouTubeSearch({ items: [{ id: { videoId: VIDEO }, snippet: { title: "A <script>alert(1)</script> title &amp; more", description: "<img src=x onerror=1>plain" } }] });
    expect(v.title).not.toMatch(/[<>]/);
    expect(v.description).toBe("plain");
  });
});

describe("details", () => {
  const videoBody = (over: Record<string, unknown> = {}) => ({ items: [{
    id: VIDEO,
    snippet: { publishedAt: "2026-03-12T10:00:00Z", channelId: CHANNEL, title: "Photosynthesis explained", description: "Text", channelTitle: "Edu Channel", categoryId: "27", defaultAudioLanguage: "en", liveBroadcastContent: "none" },
    contentDetails: { duration: "PT1H2M3S", caption: "true" }, status: { privacyStatus: "public", embeddable: true }, statistics: { viewCount: "12345", likeCount: "99" }, ...over,
  }] });

  it("reads duration, statistics, captions and the category, and keeps the player", () => {
    const v = parseYouTubeVideo(videoBody(), VIDEO)!;
    expect(v).toMatchObject({ durationSeconds: 3723, needsResolve: false, language: "en", embedUrl: `https://www.youtube-nocookie.com/embed/${VIDEO}` });
    expect(v.metadata).toMatchObject({ resourceType: "video", categoryId: "27", viewCount: 12345, likeCount: 99, captionsAvailable: true, embeddable: true, live: false, channelId: CHANNEL });
  });

  it("offers no player for a private or non-embeddable video, but still describes it", () => {
    for (const status of [{ privacyStatus: "private", embeddable: true }, { privacyStatus: "public", embeddable: false }, { privacyStatus: "unlisted", embeddable: false }]) {
      const v = parseYouTubeVideo(videoBody({ status }), VIDEO)!;
      expect(v.embedUrl, JSON.stringify(status)).toBeNull();
      expect(v.title).toBe("Photosynthesis explained");
      expect(v.externalUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO}`);
    }
  });

  it("returns nothing for a deleted, unavailable or different video", () => {
    expect(parseYouTubeVideo({ items: [] }, VIDEO)).toBeNull();
    expect(parseYouTubeVideo({}, VIDEO)).toBeNull();
    expect(parseYouTubeVideo(videoBody(), "bbbbbbbbbbb")).toBeNull();
  });

  it("reads a channel and a playlist, and treats hidden subscriber counts as unknown", () => {
    const c = parseYouTubeChannel({ items: [{ id: CHANNEL, snippet: { title: "Edu Channel", description: "d", publishedAt: "2015-01-02T00:00:00Z", country: "JO" }, statistics: { viewCount: "9", subscriberCount: "1000", hiddenSubscriberCount: true, videoCount: "42" } }] }, CHANNEL)!;
    expect(c.metadata).toMatchObject({ resourceType: "channel", country: "JO", videoCount: 42, viewCount: 9, subscriberCount: null });
    const p = parseYouTubePlaylist({ items: [{ id: PLAYLIST, snippet: { title: "Course", channelId: CHANNEL, channelTitle: "Edu Channel" }, contentDetails: { itemCount: 17 } }] }, PLAYLIST)!;
    expect(p.metadata).toMatchObject({ resourceType: "playlist", itemCount: 17 });
    expect(parseYouTubeChannel({ items: [] }, CHANNEL)).toBeNull();
    expect(parseYouTubePlaylist({ items: [] }, PLAYLIST)).toBeNull();
  });

  it("reads ISO 8601 durations", () => {
    expect(parseIsoDuration("PT4M5S")).toBe(245);
    expect(parseIsoDuration("PT1H")).toBe(3600);
    expect(parseIsoDuration("P1DT2H")).toBe(93600);
    expect(parseIsoDuration("PT0S")).toBeNull();
    expect(parseIsoDuration("P0D")).toBeNull();
    expect(parseIsoDuration("garbage")).toBeNull();
    expect(parseIsoDuration(60)).toBeNull();
  });
});

describe("addresses", () => {
  it("builds YouTube's canonical address only from a valid id", () => {
    expect(youtubeUrl.video(VIDEO)).toBe(`https://www.youtube.com/watch?v=${VIDEO}`);
    expect(youtubeUrl.channel(CHANNEL)).toBe(`https://www.youtube.com/channel/${CHANNEL}`);
    expect(youtubeUrl.playlist(PLAYLIST)).toBe(`https://www.youtube.com/playlist?list=${PLAYLIST}`);
    expect(youtubeUrl.video("x")).toBeNull();
    expect(youtubeUrl.video("../../etc/passwd")).toBeNull();
    expect(youtubeUrl.channel("UC")).toBeNull();
    expect(youtubeUrl.playlist("a b")).toBeNull();
  });

  it("recognises only real YouTube resource addresses", () => {
    for (const ok of [`https://www.youtube.com/watch?v=${VIDEO}`, `https://www.youtube.com/channel/${CHANNEL}`, `https://www.youtube.com/playlist?list=${PLAYLIST}`]) expect(isYouTubeResourceUrl(ok), ok).toBe(true);
    for (const bad of [
      "http://www.youtube.com/watch?v=" + VIDEO, "https://youtube.com/watch?v=" + VIDEO, "https://www.youtube.com.evil.example/watch?v=" + VIDEO,
      "https://evil.example/https://www.youtube.com/watch?v=" + VIDEO, `https://www.youtube.com/watch?v=${VIDEO}&list=x`, `https://www.youtube.com/watch?v=${VIDEO}/../x`,
      "https://www.youtube.com/@handle", "javascript:alert(1)", "https://user:pw@www.youtube.com/watch?v=" + VIDEO, "", null, 5,
    ]) expect(isYouTubeResourceUrl(bad), String(bad)).toBe(false);
  });

  it("splits the registry's item ids", () => {
    expect(splitYouTubeItemId(VIDEO)).toEqual({ type: "video", id: VIDEO });
    expect(splitYouTubeItemId(`channel:${CHANNEL}`)).toEqual({ type: "channel", id: CHANNEL });
    expect(splitYouTubeItemId(`playlist:${PLAYLIST}`)).toEqual({ type: "playlist", id: PLAYLIST });
    for (const bad of ["", "channel:UCshort", "playlist:x", "video:" + VIDEO, "short", "../x"]) expect(splitYouTubeItemId(bad), bad).toBeNull();
  });
});

// ─── The API, offline ─────────────────────────────────────────────────────

describe("searchYouTube", () => {
  it("sends the key in a header, never in the address, and reads the page", async () => {
    resetYouTubeStats();
    const { fetchFn, calls } = api({ search: () => json(searchBody()), videos: () => json(durationsBody) });
    const page = await searchYouTube(input({ language: "ar", region: "JO" }), { fetch: fetchFn as never, env, cache: null });
    const search = calls[0];
    expect(search.url.origin + search.url.pathname).toBe("https://www.googleapis.com/youtube/v3/search");
    expect(search.headers["x-goog-api-key"]).toBe(KEY);
    expect(search.url.toString()).not.toContain(KEY);
    expect(search.url.searchParams.has("key")).toBe(false);
    expect(search.url.searchParams.get("relevanceLanguage")).toBe("ar");
    expect(page.items.map((i) => i.providerItemId)).toEqual([VIDEO, "aaaaaaaaaaa"]);
    expect(page).toMatchObject({ nextPageToken: "CAoQAA", prevPageToken: "CAUQAQ", totalResults: 1234, cached: false });
  });

  it("fills in durations with ONE extra request for the whole page, not one per result", async () => {
    resetYouTubeStats();
    const { fetchFn, calls } = api({ search: () => json(searchBody()), videos: () => json(durationsBody) });
    const page = await searchYouTube(input(), { fetch: fetchFn as never, env, cache: null });
    expect(calls.map((c) => c.url.pathname.split("/").pop())).toEqual(["search", "videos"]);
    expect(calls[1].url.searchParams.get("id")).toBe(`${VIDEO},aaaaaaaaaaa`);
    expect(calls[1].url.searchParams.get("part")).toBe("contentDetails");
    expect(calls[1].url.searchParams.get("fields")).toBe("items(id,contentDetails(duration))");
    expect(page.items.map((i) => i.durationSeconds)).toEqual([3723, 245]);
    expect(youtubeStats()).toMatchObject({ youtube_search_requests: 1, youtube_video_detail_requests: 1 });
  });

  it("does not look up durations for a channel or playlist search", async () => {
    const { fetchFn, calls } = api({ search: () => json({ items: [{ id: { channelId: CHANNEL }, snippet: { title: "Edu" } }] }) });
    const page = await searchYouTube(input({ type: "channel" }), { fetch: fetchFn as never, env, cache: null });
    expect(calls).toHaveLength(1);
    expect(page.items[0].contentType).toBe("channel");
  });

  it("a failed duration lookup never fails the search", async () => {
    const { fetchFn } = api({ search: () => json(searchBody()), videos: () => json({ error: { code: 500 } }, 500) });
    const page = await searchYouTube(input(), { fetch: fetchFn as never, env, cache: null });
    expect(page.items).toHaveLength(2);
    expect(page.items.every((i) => i.durationSeconds === null)).toBe(true);
  });

  it("pages explicitly: the token goes back as pageToken, and no further page is fetched by itself", async () => {
    const { fetchFn, calls } = api({ search: () => json(searchBody()), videos: () => json(durationsBody) });
    await searchYouTube(input({ pageToken: "CAoQAA" }), { fetch: fetchFn as never, env, cache: null });
    expect(calls[0].url.searchParams.get("pageToken")).toBe("CAoQAA");
    expect(calls.filter((c) => c.url.pathname.endsWith("/search"))).toHaveLength(1);
  });

  it("an empty answer is an empty page with no tokens", async () => {
    const { fetchFn } = api({ search: () => json({ items: [] }) });
    expect(await searchYouTube(input(), { fetch: fetchFn as never, env, cache: null })).toEqual({ items: [], nextPageToken: null, prevPageToken: null, totalResults: null, cached: false });
  });

  it("ignores a malformed page token in the answer rather than passing it on", async () => {
    const { fetchFn } = api({ search: () => json(searchBody({ nextPageToken: "bad token!", prevPageToken: 5 })), videos: () => json(durationsBody) });
    const page = await searchYouTube(input(), { fetch: fetchFn as never, env, cache: null });
    expect(page.nextPageToken).toBeNull();
    expect(page.prevPageToken).toBeNull();
  });
});

describe("cache and ETags", () => {
  it("answers an identical search from memory: a miss, then a hit, one request to Google", async () => {
    resetYouTubeStats();
    const cache = new YouTubeCache();
    const { fetchFn } = api({ search: () => json(searchBody()), videos: () => json(durationsBody) });
    const deps = { fetch: fetchFn as never, env, cache };
    const first = await searchYouTube(input(), deps);
    const callsAfterFirst = fetchFn.mock.calls.length;
    const second = await searchYouTube(input(), deps);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(fetchFn.mock.calls.length).toBe(callsAfterFirst);
    expect(second.items.map((i) => i.durationSeconds)).toEqual([3723, 245]);
    expect(youtubeStats()).toMatchObject({ cache_misses: 2, cache_hits: 2, youtube_search_requests: 1, youtube_video_detail_requests: 1 });
  });

  it("does not confuse two different searches", async () => {
    const cache = new YouTubeCache();
    const { fetchFn } = api({ search: () => json(searchBody()), videos: () => json(durationsBody) });
    const deps = { fetch: fetchFn as never, env, cache };
    await searchYouTube(input(), deps);
    const before = fetchFn.mock.calls.length;
    for (const change of [{ order: "date" }, { language: "ar" }, { region: "JO" }, { captions: true }, { hd: true }, { pageToken: "CAoQAA" }, { query: "other" }, { type: "playlist" }] as Array<Partial<YouTubeSearchInput>>) {
      const beforeEach = fetchFn.mock.calls.length;
      await searchYouTube(input(change), deps);
      expect(fetchFn.mock.calls.length, JSON.stringify(change)).toBeGreaterThan(beforeEach);
    }
    expect(fetchFn.mock.calls.length).toBeGreaterThan(before);
  });

  it("the cache key is built from the request, is case-insensitive in the query, and never holds the key", () => {
    expect(searchCacheKey(input({ query: "Photosynthesis" }))).toBe(searchCacheKey(input({ query: "photosynthesis" })));
    expect(searchCacheKey(input())).not.toContain(KEY);
    expect(searchCacheKey(input({ pageToken: "CAoQAA" }))).not.toBe(searchCacheKey(input()));
  });

  it("revalidates a stale entry with its ETag; a 304 keeps the cached page and costs no download", async () => {
    let now = 1_000_000;
    const cache = new YouTubeCache();
    let mode: "full" | "notModified" = "full";
    const seenHeaders: Array<Record<string, string>> = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const endpoint = new URL(url).pathname.split("/").pop();
      seenHeaders.push({ endpoint: endpoint ?? "", ...((init?.headers ?? {}) as Record<string, string>) });
      if (endpoint === "videos") return json(durationsBody);
      return mode === "notModified" ? new Response(null, { status: 304 }) : json(searchBody(), 200, { ETag: '"abc123"' });
    });
    const deps = { fetch: fetchFn as never, env, cache, now: () => now };
    await searchYouTube(input(), deps);
    now += 16 * 60 * 1000; // past the 15-minute freshness of a search
    mode = "notModified";
    const page = await searchYouTube(input(), deps);
    const revalidation = seenHeaders.filter((h) => h.endpoint === "search")[1];
    expect(revalidation["If-None-Match"]).toBe('"abc123"');
    expect(page.items).toHaveLength(2);
    expect(page.cached).toBe(true);
  });

  it("refetches in full when the ETag no longer matches", async () => {
    let now = 5;
    const cache = new YouTubeCache();
    let title = "First";
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("/videos")) return json(durationsBody);
      return json(searchBody({ items: [{ id: { videoId: VIDEO }, snippet: { title } }] }), 200, { ETag: `"${title}"` });
    });
    const deps = { fetch: fetchFn as never, env, cache, now: () => now };
    expect((await searchYouTube(input(), deps)).items[0].title).toBe("First");
    now += 20 * 60 * 1000;
    title = "Second";
    expect((await searchYouTube(input(), deps)).items[0].title).toBe("Second");
  });

  it("keeps at most 200 entries", () => {
    const cache = new YouTubeCache(3);
    for (let i = 0; i < 10; i++) cache.set(`k${i}`, { at: 0, etag: null, body: i });
    expect(cache.size).toBe(3);
    expect(cache.get("k9")).toBeDefined();
    expect(cache.get("k0")).toBeUndefined();
  });
});

describe("one resource", () => {
  it("fetches a video's details with only the parts and fields it needs", async () => {
    const { fetchFn, calls } = api({ videos: () => json({ items: [{ id: VIDEO, snippet: { title: "T", channelId: CHANNEL }, contentDetails: { duration: "PT5M" }, status: { privacyStatus: "public", embeddable: true }, statistics: {} }] }) });
    const item = await getYouTubeResource("video", VIDEO, { fetch: fetchFn as never, env, cache: null });
    expect(item.durationSeconds).toBe(300);
    expect(calls[0].url.searchParams.get("part")).toBe("snippet,contentDetails,status,statistics");
    expect(calls[0].url.searchParams.get("id")).toBe(VIDEO);
    expect(calls[0].url.searchParams.get("fields")).toContain("items(id,snippet(");
    expect(calls[0].url.searchParams.get("maxResults")).toBe("1");
  });

  it("uses channels.list and playlists.list for the other kinds, and counts each", async () => {
    resetYouTubeStats();
    const { fetchFn, calls } = api({
      channels: () => json({ items: [{ id: CHANNEL, snippet: { title: "Edu" }, statistics: {} }] }),
      playlists: () => json({ items: [{ id: PLAYLIST, snippet: { title: "Course" }, contentDetails: { itemCount: 3 } }] }),
    });
    expect((await getYouTubeResource("channel", CHANNEL, { fetch: fetchFn as never, env, cache: null })).contentType).toBe("channel");
    expect((await getYouTubeResource("playlist", PLAYLIST, { fetch: fetchFn as never, env, cache: null })).contentType).toBe("playlist");
    expect(calls.map((c) => c.url.pathname.split("/").pop())).toEqual(["channels", "playlists"]);
    expect(youtubeStats()).toMatchObject({ youtube_channel_requests: 1, youtube_playlist_requests: 1, youtube_search_requests: 0 });
  });

  it("says 'not found' for a deleted or private video, and refuses a bad id without a request", async () => {
    const { fetchFn } = api({ videos: () => json({ items: [] }) });
    await expect(getYouTubeResource("video", VIDEO, { fetch: fetchFn as never, env, cache: null })).rejects.toMatchObject({ code: "youtube_not_found" });
    const untouched = vi.fn();
    for (const [type, id] of [["video", "short"], ["channel", "UC"], ["playlist", "x"], ["video", "../../x"], ["live", VIDEO]] as const) {
      await expect(getYouTubeResource(type as never, id, { fetch: untouched as never, env, cache: null }), `${type} ${id}`).rejects.toMatchObject({ code: "youtube_invalid_request" });
    }
    expect(untouched).not.toHaveBeenCalled();
  });
});

// ─── Failure: every one a VisionEX code, none a Google message ─────────────

describe("errors", () => {
  const SENTINEL = "SENSITIVE-PROVIDER-DETAIL-9f3a";
  const google = (status: number, reason: string, message = SENTINEL) =>
    json({ error: { code: status, message, errors: [{ reason, message }], status: "X", details: [{ reason }] } }, status);
  const codeFor = async (respond: () => Response) => {
    const fetchFn = vi.fn(async () => respond());
    try {
      await searchYouTube(input(), { fetch: fetchFn as never, env, cache: null });
      return "no error";
    } catch (e) {
      expect(e).toBeInstanceOf(YouTubeError);
      const err = e as YouTubeError;
      // Nothing Google said, no address and no key, in anything a caller could read.
      for (const text of [err.message, String(err), JSON.stringify(err), JSON.stringify(youtubeErrorResponse(err))]) {
        expect(text).not.toContain(SENTINEL);
        expect(text).not.toContain(KEY);
        expect(text).not.toContain("googleapis.com");
      }
      return err.code;
    }
  };

  it("has no key: says so, and never calls out", async () => {
    const fetchFn = vi.fn();
    await expect(searchYouTube(input(), { fetch: fetchFn as never, env: noEnv, cache: null })).rejects.toMatchObject({ code: "youtube_not_configured" });
    await expect(searchYouTube(input(), { fetch: fetchFn as never, env: (n) => (n === "YOUTUBE_API_KEY" ? "   " : undefined), cache: null })).rejects.toMatchObject({ code: "youtube_not_configured" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("maps Google's answers to safe codes", async () => {
    expect(await codeFor(() => google(403, "quotaExceeded"))).toBe("youtube_quota_exceeded");
    expect(await codeFor(() => google(403, "dailyLimitExceeded"))).toBe("youtube_quota_exceeded");
    expect(await codeFor(() => google(429, "rateLimitExceeded"))).toBe("youtube_rate_limited");
    expect(await codeFor(() => google(403, "userRateLimitExceeded"))).toBe("youtube_rate_limited");
    expect(await codeFor(() => google(429, "other"))).toBe("youtube_quota_exceeded");
    expect(await codeFor(() => google(400, "badRequest", "API key not valid. Please pass a valid API key."))).toBe("youtube_unavailable");
    expect(await codeFor(() => google(400, "keyInvalid"))).toBe("youtube_unavailable");
    expect(await codeFor(() => google(403, "accessNotConfigured"))).toBe("youtube_unavailable");
    expect(await codeFor(() => google(403, "forbidden"))).toBe("youtube_unavailable");
    expect(await codeFor(() => google(403, "ipRefererBlocked"))).toBe("youtube_unavailable");
    expect(await codeFor(() => google(401, "authError"))).toBe("youtube_unavailable");
    expect(await codeFor(() => google(400, "invalidParameter"))).toBe("youtube_invalid_request");
    expect(await codeFor(() => google(404, "videoNotFound"))).toBe("youtube_not_found");
    expect(await codeFor(() => google(500, "backendError"))).toBe("youtube_failed");
    expect(await codeFor(() => google(503, "serviceUnavailable"))).toBe("youtube_failed");
  });

  it("an unreadable error body is classified by its status alone", async () => {
    expect(await codeFor(() => new Response("<html>oops</html>", { status: 500 }))).toBe("youtube_failed");
    expect(await codeFor(() => new Response("", { status: 429 }))).toBe("youtube_quota_exceeded");
    expect(await codeFor(() => new Response("nope", { status: 404 }))).toBe("youtube_not_found");
  });

  it("times out, and reports a network failure", async () => {
    for (const name of ["TimeoutError", "AbortError"]) {
      const fetchFn = vi.fn(async () => { throw new DOMException("slow", name); });
      await expect(searchYouTube(input(), { fetch: fetchFn as never, env, cache: null })).rejects.toMatchObject({ code: "youtube_timeout" });
    }
    const down = vi.fn(async () => { throw new TypeError("fetch failed"); });
    await expect(searchYouTube(input(), { fetch: down as never, env, cache: null })).rejects.toMatchObject({ code: "youtube_failed" });
  });

  it("rejects an answer that is not the shape the API documents", async () => {
    expect(await codeFor(() => new Response("<html>bot check</html>", { status: 200 }))).toBe("youtube_bad_response");
    expect(await codeFor(() => json([1, 2, 3]))).toBe("youtube_bad_response");
    expect(await codeFor(() => json("text"))).toBe("youtube_bad_response");
    expect(await codeFor(() => json({ nothing: true }))).toBe("youtube_bad_response");
    expect(await codeFor(() => json({ items: "not a list" }))).toBe("youtube_bad_response");
  });

  it("counts errors, and turns any unexpected error into the generic code", () => {
    expect(youtubeErrorResponse(new Error("boom"))).toEqual({ status: 502, body: { ok: false, error: "youtube_failed" } });
    expect(youtubeErrorResponse("string")).toEqual({ status: 502, body: { ok: false, error: "youtube_failed" } });
    expect(youtubeErrorResponse(new YouTubeError("youtube_not_configured"))).toEqual({ status: 503, body: { ok: false, error: "youtube_not_configured" } });
    expect(youtubeErrorResponse(new YouTubeError("youtube_quota_exceeded")).status).toBe(429);
    expect(youtubeErrorResponse(new YouTubeError("youtube_invalid_request")).status).toBe(400);
    expect(youtubeErrorResponse(new YouTubeError("youtube_not_found")).status).toBe(404);
    expect(youtubeErrorResponse(new YouTubeError("youtube_timeout")).status).toBe(504);
  });

  it("classifies from the body's reasons and message, not from what a reader could see", () => {
    expect(classifyGoogleError(403, { error: { errors: [{ reason: "quotaExceeded" }] } })).toBe("youtube_quota_exceeded");
    expect(classifyGoogleError(400, { error: { message: "API key not valid" } })).toBe("youtube_unavailable");
    expect(classifyGoogleError(200, null)).toBe("youtube_failed");
    expect(classifyGoogleError(400, undefined)).toBe("youtube_invalid_request");
  });

  it("counts every failed request", async () => {
    resetYouTubeStats();
    await codeFor(() => google(403, "quotaExceeded"));
    await codeFor(() => google(500, "backendError"));
    expect(youtubeStats().errors).toBe(2);
  });
});

// ─── The registry's face of it ────────────────────────────────────────────

describe("the registry provider", () => {
  const params = { query: "physics", categories: [], language: "en", page: 1, limit: 6 } as const;

  it("is dormant without a key, and keyed providers say so by code", async () => {
    expect(providerStatus(youtube, noEnv)).toBe("configuration_required");
    const fetchFn = vi.fn();
    await expect(youtube.search(params, { fetch: fetchFn as never, env: noEnv })).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("is opt-in: a search across every source cannot spend the quota; naming YouTube can", async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string) => {
      calls.push(new URL(url).hostname);
      return url.includes("googleapis.com/youtube/v3/videos") ? json(durationsBody) : url.includes("googleapis.com") ? json(searchBody()) : json({});
    });
    const everything = normalizeSearchInput({ query: "photosynthesis", categories: ["video"] })!;
    await searchExternalContent(everything, { fetch: fetchFn as never, env }, { cache: null });
    expect(calls).not.toContain("www.googleapis.com");
    calls.length = 0;
    const named = normalizeSearchInput({ query: "photosynthesis", providers: ["youtube"] })!;
    const result = await searchExternalContent(named, { fetch: fetchFn as never, env }, { cache: null });
    expect(calls.filter((h) => h === "www.googleapis.com").length).toBeGreaterThan(0);
    expect(result.items.map((i) => i.provider)).toEqual(["youtube", "youtube"]);
  });

  it("maps quota and rate limits to the aggregator's own codes, and details to the item", async () => {
    const quota = vi.fn(async () => json({ error: { errors: [{ reason: "quotaExceeded" }] } }, 403));
    await expect(youtube.search(params, { fetch: quota as never, env })).rejects.toMatchObject({ code: "rate_limited" });
    const bad = vi.fn(async () => json({ error: { message: "API key not valid" } }, 400));
    await expect(youtube.search(params, { fetch: bad as never, env })).rejects.toBeInstanceOf(ProviderError);
    const { fetchFn } = api({ videos: () => json({ items: [{ id: VIDEO, snippet: { title: "T" }, contentDetails: { duration: "PT1M" }, status: { privacyStatus: "public", embeddable: true } }] }) });
    const item = await youtube.getItem!(VIDEO, { fetch: fetchFn as never, env });
    expect(item?.durationSeconds).toBe(60);
    expect(await youtube.getItem!("garbage", { fetch: fetchFn as never, env })).toBeNull();
    const gone = api({ videos: () => json({ items: [] }) });
    // (a different id: the one above is now in the shared cache, as it should be)
    expect(await youtube.getItem!("bbbbbbbbbbb", { fetch: gone.fetchFn as never, env })).toBeNull();
  });

  it("returns nothing for a second page: a stateless page number cannot carry a token", async () => {
    const fetchFn = vi.fn();
    expect(await youtube.search({ ...params, page: 2 }, { fetch: fetchFn as never, env })).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

// ─── Where it is served, and who may ask ──────────────────────────────────

describe("the Edge Function", () => {
  const source = readFileSync("supabase/functions/library-research-assistant/index.ts", "utf8");
  const content = source.slice(source.indexOf("async function handleContentMode"), source.indexOf("const SCHEMAS"));

  it("serves YouTube from the existing content modes, behind the same sign-in, plan gate and daily ceiling", () => {
    expect(source).toContain('"youtube_search"');
    expect(source).toContain('"youtube_resource"');
    expect(source).toContain('"youtube_stats"');
    const gate = source.indexOf("await subscriptionGate(");
    expect(gate).toBeGreaterThan(-1);
    expect(source.indexOf("await handleContentMode(")).toBeGreaterThan(gate);
    // The daily ceiling comes before any YouTube call; only the admin counter is exempt.
    expect(content.indexOf('function_name: "library-content-search"')).toBeGreaterThan(-1);
    expect(content.indexOf("await searchYouTube(")).toBeGreaterThan(content.indexOf('function_name: "library-content-search"'));
    expect(content.indexOf("await getYouTubeResource(")).toBeGreaterThan(content.indexOf('function_name: "library-content-search"'));
  });

  it("the usage counter is for administrators only", () => {
    const stats = content.slice(content.indexOf('body.mode === "youtube_stats"'), content.indexOf("const { data: allowed }"));
    expect(stats).toContain("await isAdmin()");
    expect(stats).toContain("403");
  });

  it("answers every failure with a code and never with a message from Google", () => {
    const branch = content.slice(content.indexOf('body.mode === "youtube_search" || body.mode === "youtube_resource"'), content.indexOf("if (body.mode === \"content_item\")"));
    expect(branch).toContain("youtubeErrorResponse(err)");
    expect(branch).not.toMatch(/err\.message|String\(err\)|JSON\.stringify\(err\)/);
    // The log line carries the code and the mode: no query, no id, no key.
    expect(branch).toMatch(/console\.warn\(`\[\$\{body\.mode\}\] \$\{answer\.body\.error\}`\)/);
  });

  it("rejects an invalid combination with 400 before any request to Google", () => {
    expect(content).toContain('return json({ ok: false, error: "youtube_invalid_request", reason: input.reason }, 400, cors);');
    expect(content.indexOf("normalizeYouTubeSearch(")).toBeLessThan(content.indexOf("await searchYouTube("));
  });
});

describe("the key never leaves the server", () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
    }
    return out;
  };

  it("YOUTUBE_API_KEY is named only in server code, the deploy workflow and tests", () => {
    const offenders = walk("src").filter((f) => !f.includes("/test/") && !f.includes("/i18n/")).filter((f) => readFileSync(f, "utf8").includes("YOUTUBE_API_KEY"));
    expect(offenders).toEqual([]);
    const server = walk("supabase/functions").filter((f) => readFileSync(f, "utf8").includes("YOUTUBE_API_KEY"));
    expect(server.map((f) => f.replace(/\\/g, "/")).sort()).toEqual([
      "supabase/functions/_shared/externalContent/providers/keyed.ts",
      "supabase/functions/_shared/externalContent/youtube.ts",
    ].sort());
    expect(readFileSync(".github/workflows/deploy.yml", "utf8")).toContain("YOUTUBE_API_KEY:");
  });

  it("the client module for YouTube carries no key and no Google address", () => {
    const client = readFileSync("src/services/library/externalContent.ts", "utf8");
    expect(client).not.toMatch(/googleapis|x-goog-api-key|AIza/);
    const panel = readFileSync("src/components/library/external/YouTubeSearchPanel.tsx", "utf8");
    expect(panel).not.toMatch(/googleapis|x-goog-api-key|AIza|fetch\(/);
  });

  it("no source file contains something shaped like a Google API key", () => {
    const files = [...walk("supabase/functions"), ...walk("src")].filter((f) => !f.includes("/i18n/"));
    const shaped = files.filter((f) => /AIza[0-9A-Za-z_-]{30,}/.test(readFileSync(f, "utf8")));
    expect(shaped).toEqual([]);
  });

  it("the server module sends the key only in a header, and never logs anything but codes", () => {
    const yt = readFileSync("supabase/functions/_shared/externalContent/youtube.ts", "utf8");
    expect(yt).toContain('"x-goog-api-key": key');
    expect(yt).not.toMatch(/searchParams\.set\("key"|key=\$\{|\bkey,\s*$/m);
    expect(yt).not.toMatch(/console\.(log|warn|error|info)/);
    expect(yt).not.toMatch(/downloadUrl:\s*[^n]/); // a YouTube item never offers a file
  });
});

describe("merging results", () => {
  it("keeps two different YouTube videos apart (the address differs only in its v parameter)", () => {
    const [a, b] = parseYouTubeSearch(searchBody());
    const { items, duplicates } = mergeResults([[a, b]]);
    expect(items.map((i) => i.providerItemId)).toEqual([VIDEO, "aaaaaaaaaaa"]);
    expect(duplicates).toBe(0);
  });

  it("still recognises the same video twice, however the address is spelled", () => {
    const [a] = parseYouTubeSearch(searchBody());
    const again = { ...a, id: "other:1", provider: "other", externalUrl: `http://youtube.com/watch?v=${VIDEO}&utm_source=x` };
    const { items, duplicates } = mergeResults([[a], [again]]);
    expect(items).toHaveLength(1);
    expect(duplicates).toBe(1);
  });

  it("keeps a playlist and a video with the same title and channel apart", () => {
    const [video] = parseYouTubeSearch({ items: [{ id: { videoId: VIDEO }, snippet: { title: "Biology course", channelTitle: "Edu" } }] });
    const [playlist] = parseYouTubeSearch({ items: [{ id: { playlistId: PLAYLIST }, snippet: { title: "Biology course", channelTitle: "Edu" } }] });
    expect(mergeResults([[video, playlist]]).items).toHaveLength(2);
  });
});
