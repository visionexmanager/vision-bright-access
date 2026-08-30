// Asking for a song by name, over WhatsApp.
//
// `whatsappRadio.ts` explains why the listening feature built before this one
// was stations rather than tracks: Visionex has no song catalogue, and every
// external service the assistant calls has to be keyless. That is still true.
// What changed is the question — somebody asking for *a named song* is not
// asking for a station, and answering them with a station list is answering a
// different question.
//
// ── What may be sent, and what may not ──────────────────────────────────────
//
// Visionex has no licence to hand out commercial recordings, so it does not.
// Two things are sent instead, and the difference is stated to the sender
// rather than blurred:
//
//   • The publisher's own thirty-second preview, served from Apple's host, plus
//     the link that plays the whole track where the rights holder sells it.
//   • A *complete* recording only when it is freely licensed — found on
//     Wikimedia Commons, where a file's licence is a condition of it being
//     there at all. That is a different performance from the commercial one,
//     and the message says so; a free recording presented as "the track you
//     asked for" would be a small lie told at scale.
//
// ── Why these two services ──────────────────────────────────────────────────
//
// Apple's Search API is keyless, needs no account that can lapse, and is the
// only free catalogue that actually knows the Arabic repertoire this audience
// asks for — «انت عمري» resolves to Umm Kulthum, not to nothing.
//
// Wikimedia Commons is keyless too, and answered in 0.9 seconds when this was
// written. The Internet Archive was the obvious alternative and was measured
// first: its search endpoint took 33 seconds from the same machine, and a
// webhook that must answer Meta cannot wait that long. Reliability decided it,
// not preference.
//
// ── The rules every fetch here follows ──────────────────────────────────────
//
// No key, no `Deno.env`, no bearer token — a billing failure must never be
// able to switch this off, which is the rule `whatsappGeo.ts` is held to and
// the suite checks here too. Every request carries a User-Agent that says who
// is calling, is bounded by an `AbortController`, and every audio URL is
// checked against a host allowlist before a byte is fetched. Nothing the sender
// types ever becomes a URL to fetch: the addresses come from the two APIs'
// own responses, and are still checked.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

/** Who is calling, as both services' usage policies expect. */
const USER_AGENT = "VisionexWhatsApp/1.0 (+https://visionex.app)";

/** A search that has not answered by now is not going to save the reply. */
const SEARCH_TIMEOUT_MS = 8_000;

/** Downloading the audio itself, which is allowed to take longer than a search. */
const DOWNLOAD_TIMEOUT_MS = 20_000;

/** Meta rejects an audio message above 16 MB, so nothing larger is fetched. */
export const SONG_MAX_BYTES = 16 * 1024 * 1024;

/** Rows in one list. Five, as the news list does, leaving room for the way back. */
export const SONG_LIST_SIZE = 5;

/** Longest message still read as naming a song. */
const SONG_MAX_CHARS = 120;

/** Prefix for a song row's selection id, as `news.` is for an article. */
export const SONG_ID_PREFIX = "song.";

export const songRowId = (trackId: number | string): string => `${SONG_ID_PREFIX}${trackId}`;

/** The track id inside a tapped row, or null for any other selection. */
export function parseSongSelection(id: string | null | undefined): string | null {
  if (!id || !id.startsWith(SONG_ID_PREFIX)) return null;
  const trackId = id.slice(SONG_ID_PREFIX.length).trim();
  // Apple's ids are numeric. Anything else did not come from a row this built.
  return /^\d{1,20}$/.test(trackId) ? trackId : null;
}

// ── Naming a song ───────────────────────────────────────────────────────────
//
// The trigger is the *singular* word for "a song", and what makes it a request
// is that something follows it. «أغاني» on its own is somebody who wants music
// and is answered by the radio, exactly as before; «أغنية أم كلثوم» names one,
// and is answered here. That distinction is the whole parser: a plural asks for
// a genre, a singular asks for a title.

const SONG_WORDS: readonly RegExp[] = [
  /\bsongs?\b/i,
  /\bplay\b/i,
  /(أغنية|اغنية|أغنيه|اغنيه|اغنيت|أغنيت)/,
  /(گانا|گیت)/,                       // Urdu
  /(गाना|गीत)/,                       // Hindi
  /(গান)/,                            // Bengali
  /\b(lagu)\b/i,                      // Indonesian
  /(曲|歌)/,                           // Japanese, Chinese
  /(노래)/,                            // Korean
  /\b(canzone)\b/i,                   // Italian
  /\b(liedje|nummer)\b/i,             // Dutch
  /\b(piosenk\w*)\b/i,                // Polish
  /(bài hát)/i,                       // Vietnamese
  /(آهنگ|ترانه)/,                     // Persian
  /\b(canci[oó]n)\b/i,                // Spanish
  /\b(lied)\b/i,                      // German
  /\b(m[uú]sica de)\b/i,              // Portuguese: "música de <artist>"
  // No \b around şarkı: a word boundary is defined against ASCII word
  // characters, so a pattern whose first and last letters are neither can
  // never match — which is how a Turkish request reached the radio instead.
  /(şarkı|sarki)/i,                   // Turkish
  /\b(chanson)\b/i,                   // French
  /(песн\w*)/i,                       // Russian
];

/**
 * Words that carry no title: verbs, pronouns and the trigger words themselves.
 *
 * Removed before deciding whether anything was actually named, so "play a song"
 * is recognised as a request with no title — worth asking about — rather than
 * as a search for the word "a".
 */
const FILLER = new Set([
  "a", "an", "the", "me", "my", "for", "of", "by", "please", "song", "songs",
  "play", "want", "i", "to", "listen", "hear", "some", "put", "on",
  "أغنية", "اغنية", "أغنيه", "اغنيه", "بدي", "بدى", "أريد", "اريد", "لي",
  "شغل", "شغلي", "شغللي", "سمعني", "اسمع", "أسمع", "من", "في", "على", "عن",
  "الى", "إلى", "مع", "يا", "ريت", "لو", "سمحت", "ممكن",
  // The genre words, which name no track. Their presence is what makes
  // "play me some music" come back with an empty query — and an empty query is
  // how the webhook knows to leave that sentence to the radio, which is what
  // the person actually asked for. Without them this would search a catalogue
  // of forty million songs for the word "music" and send back five of them.
  "music", "musica", "música", "musik", "musique", "müzik", "музыка", "музыку",
  "موسيقى", "موسيقا", "أغاني", "اغاني", "أغان", "اغان", "nhạc", "lagu-lagu",
  // The trigger word itself, in the other eighteen. Without these the word
  // that identified the request stays in the query, and the catalogue is asked
  // for a track called "şarkı Sezen Aksu".
  //
  // «şarki» sits beside «şarkı» because JavaScript lowercases the Turkish
  // dotted capital I to a dotted i: "ŞARKI" arrives here as "şarki", which is
  // a word Turkish does not have and a set lookup would otherwise miss.
  "şarkı", "şarki", "sarki", "canción", "cancion", "chanson", "canzone",
  "lied", "liedje", "nummer", "piosenka", "piosenkę", "piosenki", "lagu",
  "گانا", "گیت", "गाना", "गीत", "গান", "曲", "歌", "노래", "bài", "hát",
  "آهنگ", "ترانه", "песня", "песню", "песни", "de",
]);

/** What a sender asked for, once the asking is taken off. */
export interface SongRequest {
  /** The title, artist, or both — whatever was left after the trigger. */
  query: string;
}

/**
 * Whether this message names a song, and which one.
 *
 * Returns `{ query: "" }` when the trigger is there but nothing follows it:
 * that is somebody who asked for "a song" without saying which, and the right
 * answer is a question, not a list. `null` means the message was not about a
 * song at all, and the radio and the assistant get their turn as before.
 */
export function parseSongRequest(text: string | null | undefined): SongRequest | null {
  const raw = (text ?? "").trim();
  if (!raw || raw.length > SONG_MAX_CHARS) return null;

  const words = raw
    .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 0);
  // A title is short. A sentence this long is somebody talking about a song,
  // not asking for one.
  if (words.length === 0 || words.length > MAX_WORDS) return null;

  // Where the trigger sits decides what the sentence is. "Play Despacito"
  // opens with it; "I heard this song at the shop and want to complain"
  // buries it in the middle, and answering that with five tracks would be the
  // assistant talking over a complaint. Matched against the opening words
  // joined rather than word by word, because «bài hát» and "a song" are two
  // words and a per-word test would never see either.
  const opening = words.slice(0, TRIGGER_WITHIN_WORDS).join(" ");
  if (!SONG_WORDS.some((pattern) => pattern.test(opening))) return null;

  const query = words
    .filter((word) => !FILLER.has(word.toLowerCase()))
    .join(" ")
    .trim();
  return { query };
}

/** Longest a request can be before it is a sentence about music, not a request. */
const MAX_WORDS = 7;

/** How far into the message the word "song" may sit and still be the point of it. */
const TRIGGER_WITHIN_WORDS = 3;

// ── What the catalogue answered ─────────────────────────────────────────────

/** One track, as this channel needs it. */
export interface Song {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  /** The publisher's own thirty-second preview. Always on Apple's host. */
  previewUrl: string | null;
  /** Where the whole track plays, at the rights holder's shop. */
  trackUrl: string | null;
}

/** A complete recording that is free to send, and where its licence is stated. */
export interface FreeRecording {
  title: string;
  audioUrl: string;
  mimeType: string;
  bytes: number;
  /** The file's page, which carries the licence and the author. */
  pageUrl: string;
}

const ITUNES_PREVIEW_HOSTS = new Set([
  "audio-ssl.itunes.apple.com",
  "audio-ssl.mzstatic.com",
]);

const COMMONS_AUDIO_HOSTS = new Set([
  "upload.wikimedia.org",
]);

/**
 * Whether an audio address may be fetched at all.
 *
 * Both services return absolute URLs, and both could in principle return one
 * pointing anywhere. An allowlist is what stops a redirected or altered
 * response turning this into a fetcher for arbitrary addresses.
 */
export function isAllowedAudioUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return ITUNES_PREVIEW_HOSTS.has(parsed.hostname) || COMMONS_AUDIO_HOSTS.has(parsed.hostname);
}

/**
 * What WhatsApp will actually play. MIDI and WAV are audio and are not on it.
 *
 * `application/ogg` is here for a measured reason: every free recording on
 * Commons is Ogg, Commons labels them `application/ogg`, and a set without it
 * rejected all five results for "Moonlight Sonata Beethoven" — which would have
 * shipped a "complete recording when it is free" feature that was never once
 * going to send one. Commons has no MP3 at all; `filemime:mp3` returns nothing.
 *
 * Meta documents Ogg support as Opus-only, and a Vorbis file may still be
 * refused at upload. That is why `deliverSong` in the webhook falls back to the
 * preview rather than treating a free recording as the end of the road: the
 * question is answered by production, and either answer leaves the sender with
 * something to listen to.
 */
const PLAYABLE_AUDIO = new Set([
  "audio/mpeg", "audio/mp4", "audio/aac", "audio/amr", "audio/ogg", "audio/opus", "application/ogg",
]);

/** The type as Meta names it, which is not always the type Commons wrote down. */
export function audioMimeType(mimeType: string | null | undefined): string {
  const value = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  return value === "application/ogg" ? "audio/ogg" : value;
}

export const isPlayableAudio = (mimeType: string | null | undefined): boolean =>
  !!mimeType && PLAYABLE_AUDIO.has((mimeType).split(";")[0].trim().toLowerCase());

/** Apple's rows, read into this module's shape. Tolerant: a bad row is dropped. */
export function readSongs(payload: unknown): Song[] {
  const results = (payload as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  const songs: Song[] = [];
  for (const row of results) {
    if (!row || typeof row !== "object") continue;
    const value = row as Record<string, unknown>;
    const trackId = typeof value.trackId === "number" ? String(value.trackId) : "";
    const title = typeof value.trackName === "string" ? value.trackName.trim() : "";
    const artist = typeof value.artistName === "string" ? value.artistName.trim() : "";
    if (!trackId || !title) continue;
    const preview = typeof value.previewUrl === "string" ? value.previewUrl : null;
    const track = typeof value.trackViewUrl === "string" ? value.trackViewUrl : null;
    songs.push({
      trackId,
      title,
      artist,
      album: typeof value.collectionName === "string" ? value.collectionName.trim() : "",
      previewUrl: isAllowedAudioUrl(preview) ? preview : null,
      trackUrl: track,
    });
  }
  return songs;
}

/** Commons' answer, read into this module's shape. Only playable audio survives. */
export function readFreeRecording(payload: unknown): FreeRecording | null {
  const pages = (payload as { query?: { pages?: unknown } })?.query?.pages;
  if (!pages || typeof pages !== "object") return null;
  for (const page of Object.values(pages as Record<string, unknown>)) {
    if (!page || typeof page !== "object") continue;
    const value = page as Record<string, unknown>;
    const info = Array.isArray(value.imageinfo) ? value.imageinfo[0] : null;
    if (!info || typeof info !== "object") continue;
    const file = info as Record<string, unknown>;
    const audioUrl = typeof file.url === "string" ? file.url : "";
    const mimeType = typeof file.mime === "string" ? file.mime : "";
    const bytes = typeof file.size === "number" ? file.size : 0;
    if (!isAllowedAudioUrl(audioUrl)) continue;
    if (!isPlayableAudio(mimeType)) continue;
    if (bytes <= 0 || bytes > SONG_MAX_BYTES) continue;
    return {
      title: typeof value.title === "string" ? value.title.replace(/^File:/, "") : "",
      audioUrl,
      mimeType: audioMimeType(mimeType),
      bytes,
      pageUrl: typeof file.descriptionurl === "string" ? file.descriptionurl : "",
    };
  }
  return null;
}

// ── The two calls ───────────────────────────────────────────────────────────

async function getJson(url: string, timeoutMs: number, fetchImpl?: typeof fetch): Promise<unknown> {
  const doFetch = fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await doFetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** The catalogue's answer to a name. Empty when it knows nothing. */
export async function searchSongs(query: string, fetchImpl?: typeof fetch): Promise<Song[]> {
  const term = query.trim();
  if (!term) return [];
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
    `&entity=song&limit=${SONG_LIST_SIZE}`;
  return readSongs(await getJson(url, SEARCH_TIMEOUT_MS, fetchImpl));
}

/** One track by the id a row carried. */
export async function lookupSong(trackId: string, fetchImpl?: typeof fetch): Promise<Song | null> {
  if (!/^\d{1,20}$/.test(trackId)) return null;
  const url = `https://itunes.apple.com/lookup?id=${trackId}&entity=song`;
  return readSongs(await getJson(url, SEARCH_TIMEOUT_MS, fetchImpl))[0] ?? null;
}

/**
 * A freely licensed recording of the same piece, if Commons has one.
 *
 * Searched by title and artist together, because a title alone matches every
 * cover ever uploaded. A miss is the ordinary case and costs one fast request.
 */
export async function findFreeRecording(song: Song, fetchImpl?: typeof fetch): Promise<FreeRecording | null> {
  const terms = [song.title, song.artist].filter(Boolean).join(" ").trim();
  if (!terms) return null;
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json" +
    `&generator=search&gsrsearch=${encodeURIComponent(`filetype:audio ${terms}`)}` +
    "&gsrlimit=5&gsrnamespace=6&prop=imageinfo&iiprop=url%7Csize%7Cmime";
  return readFreeRecording(await getJson(url, SEARCH_TIMEOUT_MS, fetchImpl));
}

/**
 * The audio itself, refused rather than truncated when it is too big.
 *
 * The length is checked twice: the header first, because a refusal that costs
 * nothing is better than one that costs sixteen megabytes, and then the bytes
 * actually received, because `Content-Length` is a claim and not a promise.
 */
export async function fetchAudio(
  url: string,
  fetchImpl?: typeof fetch,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  if (!isAllowedAudioUrl(url)) return null;
  const doFetch = fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await doFetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > SONG_MAX_BYTES) return null;
    const declaredType = res.headers.get("content-type") ?? "";
    if (!isPlayableAudio(declaredType)) return null;
    const mimeType = audioMimeType(declaredType);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > SONG_MAX_BYTES) return null;
    return { bytes, mimeType };
  } finally {
    clearTimeout(timer);
  }
}

// ── What the sender reads ───────────────────────────────────────────────────

/** One row's second line: who performed it, and on what. */
export const songSubtitle = (song: Song): string =>
  [song.artist, song.album].filter(Boolean).join(" — ");

/**
 * The sentence sent beside a thirty-second preview.
 *
 * It says what the audio is before it says where the rest is, because somebody
 * listening rather than looking hears this first and should not spend the clip
 * wondering why it stopped.
 */
export function formatPreview(params: { song: Song; language: Language }): string {
  const { song, language } = params;
  const lines = [`🎵 *${song.title}*`];
  const subtitle = songSubtitle(song);
  if (subtitle) lines.push(subtitle);
  lines.push("");
  lines.push(say("songPreviewNote", language));
  if (song.trackUrl) lines.push(say("songFullLink", language).replace("{url}", song.trackUrl));
  return lines.join("\n");
}

/** The sentence sent beside a complete, freely licensed recording. */
export function formatFreeRecording(params: {
  song: Song;
  recording: FreeRecording;
  language: Language;
}): string {
  const { song, recording, language } = params;
  const lines = [`🎵 *${song.title}*`];
  const subtitle = songSubtitle(song);
  if (subtitle) lines.push(subtitle);
  lines.push("");
  lines.push(say("songFreeNote", language));
  if (recording.pageUrl) {
    lines.push(say("songFreeLicence", language).replace("{url}", recording.pageUrl));
  }
  return lines.join("\n");
}

/**
 * What is said when the catalogue has the track but the audio cannot be sent.
 *
 * A preview that fails to download is not a dead end: the link still plays the
 * whole thing, and saying so is more use than an apology.
 */
export function formatLinkOnly(params: { song: Song; language: Language }): string {
  const { song, language } = params;
  const lines = [`🎵 *${song.title}*`];
  const subtitle = songSubtitle(song);
  if (subtitle) lines.push(subtitle);
  if (song.trackUrl) {
    lines.push("");
    lines.push(say("songFullLink", language).replace("{url}", song.trackUrl));
  }
  return lines.join("\n");
}
