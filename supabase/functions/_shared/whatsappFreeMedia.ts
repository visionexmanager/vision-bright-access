// Videos, podcasts and audiobooks from open sources.
//
// A sender asking for a video or something to listen to should get an answer,
// not a refusal. Every source here is keyless and answered from a datacenter
// when probed on 2026-09-17:
//
//   Dailymotion API    video search                 no key
//   Internet Archive   free films, LibriVox books   no key, public domain
//   iTunes Search      podcasts and audiobooks      no key
//
// There is no keyless YouTube search, so a video answer always ends with a
// YouTube search link — which is also why a video request is never empty.
//
// What leaves this module: the words the sender asked for. Nothing else.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

export type MediaKind = "video" | "podcast" | "audiobook";

export interface MediaRequest {
  kind: MediaKind;
  /** Null when only the kind was named: answered by asking what to find. */
  query: string | null;
}

export const MEDIA_QUERY_MAX_CHARS = 80;
export const MAX_MEDIA_ITEMS = 5;
const MEDIA_TIMEOUT_MS = 7_000;
const USER_AGENT = "VisionexAssistant/1.0 (+https://visionex.app; support@visionex.app)";

/** Longest first within each kind, so "كتاب صوتي" is read before "كتاب". */
const KIND_WORDS: Array<[MediaKind, string[]]> = [
  ["audiobook", [
    "كتاب صوتي", "كتب صوتية", "كتب صوتيه", "audiobooks", "audiobook", "audio book", "audio books",
    "livre audio", "hörbuch", "audiolibro", "audiolivro", "аудиокнига", "有声书", "オーディオブック",
    "오디오북", "ऑडियोबुक", "অডিওবুক", "کتاب صوتی", "آڈیو بک", "sesli kitap", "buku audio",
    "luisterboek", "sách nói",
  ]],
  ["podcast", [
    "بودكاست", "بودكاستات", "podcasts", "podcast", "pódcast", "подкаст", "播客", "ポッドキャスト",
    "팟캐스트", "पॉडकास्ट", "পডকাস্ট", "پادکست", "پوڈکاسٹ", "podcastu",
  ]],
  ["video", [
    "فيديوهات", "فيديو", "مقاطع", "مقطع", "أفلام", "افلام", "فيلم", "فلم",
    "videos", "video", "clips", "clip", "movies", "movie", "films", "film", "documentary",
    "vídeo", "vidéo", "видео", "фильм", "视频", "動画", "비디오", "영상", "वीडियो", "ভিডিও",
    "ویدیو", "ویڈیو", "wideo", "filme", "phim",
  ]],
];

const LEAD = /^(?:(?:بدي|بدّي|ابغى|أبغى|ابي|أبي|أريد|اريد|عايز|عاوز|محتاج|شغل|شغّل|شغللي|شغّللي|اعرض|اعرضلي|ورجيني|فرجيني|ابعتلي|ابعثلي|أرسل|ارسل|دورلي على|دوّرلي على|ابحث عن|ابحثلي عن|هات|اعطيني|أعطني|i want|i need|play|show me|send me|find me|find|search for|looking for|watch|listen to|recommend|suggest|a|an|some|quiero|busco|je cherche|ich suche|procuro|szukam|ik zoek|saya cari)\s+)*/iu;
const CONNECTING = /^(?:(?:عن|على|حول|لـ|about|on|for|of|de|sur|über|sobre|o|про|о)\s+)/iu;
const TRAILING = /[\s.,!?؟،。！？…]+$/u;

/**
 * A media request, or null.
 *
 * The kind word must open the message (after at most a few "I want" words), so
 * "شفت فيديو حلو امبارح" stays a conversation.
 */
export function parseMediaRequest(text: string): MediaRequest | null {
  const trimmed = (text ?? "").trim().replace(TRAILING, "");
  if (!trimmed || trimmed.length > MEDIA_QUERY_MAX_CHARS + 40) return null;
  const rest = trimmed.replace(LEAD, "");
  const lower = rest.toLowerCase();

  for (const [kind, words] of KIND_WORDS) {
    const word = [...words]
      .sort((a, b) => b.length - a.length)
      .find((candidate) => lower === candidate || [" ", ":", "："].some((gap) => lower.startsWith(candidate + gap)));
    if (!word) continue;
    const query = rest
      .slice(word.length)
      .replace(/^[\s:：-]+/u, "")
      .replace(CONNECTING, "")
      .replace(/^[«"'“”]+|[»"'“”]+$/gu, "")
      .trim();
    if (!query) return { kind, query: null };
    // "the video you sent was great": a sentence about a video, not a request.
    if (/^(?:you|i|we|he|she|they|it|was|is|that|this|أرسلته|بعتلي|بعتتلي|اللي)(?:[\s]|$)/iu.test(query)) return null;
    if (query.length > MEDIA_QUERY_MAX_CHARS) return null;
    return { kind, query };
  }
  return null;
}

/** One thing to watch or listen to. */
export interface MediaItem {
  title: string;
  /** Channel, podcaster or author. */
  by: string | null;
  url: string;
  /** Free and legal to watch or listen to in full. */
  free: boolean;
  /** Seconds, for a video. */
  duration: number | null;
  source: "dailymotion" | "archive" | "itunes" | "librivox";
}

type Fetch = typeof fetch;

async function getJson<T>(url: string, fetchImpl: Fetch): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEDIA_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!response.ok) {
      console.error(`[whatsapp-media] ${new URL(url).host} responded ${response.status}`);
      return null;
    }
    return await response.json() as T;
  } catch {
    // Never the message: it quotes the URL, which carries the search.
    console.error(`[whatsapp-media] ${new URL(url).host} request failed`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** An Internet Archive identifier that can be put in a path. */
const ARCHIVE_ID = /^[A-Za-z0-9._-]{1,100}$/;

/** Archive search terms: letters, digits and spaces only, so no query syntax gets in. */
export function archiveTerms(query: string): string {
  return query.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().slice(0, MEDIA_QUERY_MAX_CHARS);
}

async function archiveSearch(
  query: string,
  filter: string,
  source: "archive" | "librivox",
  fetchImpl: Fetch,
): Promise<MediaItem[] | null> {
  const terms = archiveTerms(query);
  if (!terms) return [];
  const q = `(${terms}) AND ${filter}`;
  const data = await getJson<{ response?: { docs?: Array<{ identifier?: string; title?: string; creator?: string | string[] }> } }>(
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}` +
    "&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&rows=3&sort%5B%5D=downloads+desc&output=json",
    fetchImpl,
  );
  if (!data) return null;
  return (data.response?.docs ?? [])
    .filter((doc) => doc.title && doc.identifier && ARCHIVE_ID.test(doc.identifier))
    .map((doc) => ({
      title: String(doc.title),
      by: Array.isArray(doc.creator) ? doc.creator[0] ?? null : doc.creator ?? null,
      url: `https://archive.org/details/${doc.identifier}`,
      free: true,
      duration: null,
      source,
    }));
}

async function dailymotionSearch(query: string, fetchImpl: Fetch): Promise<MediaItem[] | null> {
  const data = await getJson<{ list?: Array<{ id?: string; title?: string; url?: string; duration?: number; "owner.screenname"?: string }> }>(
    `https://api.dailymotion.com/videos?search=${encodeURIComponent(query)}` +
    "&limit=5&family_filter=true&sort=relevance&fields=id,title,url,duration,owner.screenname",
    fetchImpl,
  );
  if (!data) return null;
  return (data.list ?? [])
    .filter((video) => video.title && typeof video.url === "string" && video.url.startsWith("https://www.dailymotion.com/video/"))
    .map((video) => ({
      title: String(video.title),
      by: video["owner.screenname"] ?? null,
      url: String(video.url),
      free: true,
      duration: typeof video.duration === "number" ? video.duration : null,
      source: "dailymotion" as const,
    }));
}

async function itunesSearch(query: string, media: "podcast" | "audiobook", fetchImpl: Fetch): Promise<MediaItem[] | null> {
  const data = await getJson<{ results?: Array<{ collectionName?: string; artistName?: string; collectionViewUrl?: string }> }>(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=${media}&limit=5`,
    fetchImpl,
  );
  if (!data) return null;
  return (data.results ?? [])
    .filter((item) => item.collectionName && typeof item.collectionViewUrl === "string" &&
      /^https:\/\/(?:podcasts|books|itunes)\.apple\.com\//.test(item.collectionViewUrl))
    .map((item) => ({
      title: String(item.collectionName),
      by: item.artistName ?? null,
      // Apple's tracking parameter says nothing to a listener.
      url: String(item.collectionViewUrl).replace(/\?uo=\d+$/, ""),
      // A podcast is free to listen to; an audiobook in the Apple store is not.
      free: media === "podcast",
      duration: null,
      source: "itunes" as const,
    }));
}

export interface MediaResults {
  items: MediaItem[];
  /** True when every source failed, which is not the same as finding nothing. */
  unreachable: boolean;
}

/** Everything for one request, free sources first, at most a handful. */
export async function searchMedia(request: { kind: MediaKind; query: string }, fetchImpl: Fetch = fetch): Promise<MediaResults> {
  const { kind, query } = request;
  const lookups: Array<Promise<MediaItem[] | null>> =
    kind === "video"
      ? [dailymotionSearch(query, fetchImpl), archiveSearch(query, "mediatype:(movies)", "archive", fetchImpl)]
      : kind === "podcast"
      ? [itunesSearch(query, "podcast", fetchImpl)]
      : [archiveSearch(query, "collection:(librivoxaudio)", "librivox", fetchImpl), itunesSearch(query, "audiobook", fetchImpl)];
  const answers = await Promise.all(lookups);
  const seen = new Set<string>();
  const items = answers
    .flatMap((answer) => answer ?? [])
    .filter((item) => {
      const key = `${item.title.toLowerCase()}|${(item.by ?? "").toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // The Archive's free films come after the first videos, not before: they
    // are old, and most people asking for a video want something recent.
    .sort((a, b) => Number(b.free) - Number(a.free))
    .slice(0, MAX_MEDIA_ITEMS);
  return { items, unreachable: answers.every((answer) => answer === null) };
}

export const youtubeSearchUrl = (query: string): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;

function minutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const HEADING = { video: "mediaVideoHeading", podcast: "mediaPodcastHeading", audiobook: "mediaAudiobookHeading" } as const;
const ICON = { video: "🎬", podcast: "🎙️", audiobook: "🎧" } as const;

/** The answer. A video answer always ends with a YouTube search, so it is never empty. */
export function formatMedia(params: {
  language: Language;
  request: { kind: MediaKind; query: string };
  items: MediaItem[];
}): string {
  const { language, request, items } = params;
  const lines = [`${ICON[request.kind]} ${say(HEADING[request.kind], language).replace("{query}", request.query)}`];
  for (const item of items) {
    const details = [
      item.by,
      item.duration ? minutes(item.duration) : null,
      item.free ? say("mediaFree", language) : null,
    ].filter(Boolean).join(" · ");
    lines.push("", `• ${item.title}${details ? ` — ${details}` : ""}`, `  ${item.url}`);
  }
  if (request.kind === "video") {
    lines.push("", `▶️ ${say("mediaMoreOnYoutube", language)}: ${youtubeSearchUrl(request.query)}`);
  }
  return lines.join("\n");
}

/** Asked for a video, a podcast or an audiobook without saying which. */
export const mediaAskNotice = (language: Language): string => say("mediaAsk", language);

/** For the assistant, when nothing was found for a podcast or audiobook. */
export function mediaNotFoundDirective(request: { kind: MediaKind; query: string }): string {
  const what = request.kind === "podcast" ? "a podcast" : request.kind === "audiobook" ? "an audiobook" : "a video";
  return [
    `The sender asked for ${what} about or named "${request.query.replace(/["\n]/g, " ").slice(0, MEDIA_QUERY_MAX_CHARS)}".`,
    "The open catalogues searched for it returned nothing.",
    "Do not answer only that nothing was found: suggest well-known titles or creators on that subject if you reliably know any, and suggest a different wording to try.",
    "Never invent a link.",
  ].join(" ");
}
