// Fixed phrases, said from a recording on our own disk instead of a provider.
//
// "Processing your request…", "Stopped. Nothing was sent.", "Go ahead — send me
// your question.": the same few sentences, in twenty languages, synthesised and
// paid for again every time a voice sender hears them. This answers them from a
// prerecorded clip stored on the Data Hub's persistent disk, and calls no
// text-to-speech provider to do it.
//
// ── What it is not ──────────────────────────────────────────────────────────
//
// Not a voice for anything new. A phrase is recognised only when the reply is,
// word for word, one of the registered strings from `whatsappStrings.ts` — the
// texts are read from there, not copied here, so a reworded notice stops
// matching instead of being said in its old words. Anything else, an AI answer
// included, takes the ordinary path. Notices with variables (the plan limit, the
// allowance warning) are not registered at all: they carry a number and a link,
// and the subscription messages stay exactly as they are.
//
// ── The policy, in order ────────────────────────────────────────────────────
//
//   1. Switched off (the default), or no processing service: nothing changes.
//   2. Not a registered phrase: the ordinary path.
//   3. A registered phrase with a verified clip in the *same language the text
//      is in*: send the clip.
//   4. A registered phrase without one — no manifest entry, a file that is
//      missing, the wrong size, a bad checksum, not an Ogg stream — is sent as
//      its written copy. It is never synthesised (that is the cost this exists
//      to remove) and never said in another language.
//
// A clip is trusted only after it matches the manifest: the byte count and the
// SHA-256 recorded when it was prepared, and the Ogg capture pattern at the
// front. The file lives where `/datahub/file` serves it — read-only, behind the
// processor's token, no path taken from the caller.
//
// Bounded: at most MAX_CLIP_BYTES per clip and MAX_CACHED_CLIPS in memory, a
// timeout on the one request, and no retries here (a miss is a text fallback).
//
// Logs carry a response id, a language and a reason. Never the text, a number, a
// URL or a byte.

import { LOCAL_AUDIO_ASSETS, LOCAL_AUDIO_DATASET, LOCAL_AUDIO_VERSION, LOCAL_RESPONSES, RELEASE_1 } from "./localAudioManifest.ts";
import { processorConfig, type EnvReader } from "./whatsappProcessor.ts";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./whatsappLanguages.ts";
import { UI_STRINGS } from "./whatsappStrings.ts";
import { speakableText, type LocalSpeech, type LocalSpeechResolver } from "./whatsappVoiceReply.ts";

export { LOCAL_AUDIO_VERSION };

/** The largest clip served: a few seconds of Opus is a few kilobytes. */
export const MAX_CLIP_BYTES = 512 * 1024;
export const MAX_CACHED_CLIPS = 48;
export const CLIP_CACHE_TTL_MS = 60 * 60 * 1000;
export const CLIP_FETCH_TIMEOUT_MS = 4_000;
export const CLIP_MIME = "audio/ogg";

export type ClipStatus = "active" | "disabled";

export interface ClipEntry {
  /** Size of the file, in bytes. */
  bytes: number;
  /** SHA-256 of the file, lowercase hex. */
  sha256: string;
  /** Playing time, in milliseconds. */
  durationMs: number;
  status: ClipStatus;
  /** ISO date the clip was last checked against its text and format. */
  verifiedAt: string;
  /** True only once a person has listened to the clip and approved it. Absent = not reviewed. */
  reviewed?: boolean;
}

export type FallbackReason =
  | "not_listed"
  | "disabled"
  | "service_off"
  | "fetch_failed"
  | "too_large"
  | "size_mismatch"
  | "checksum_mismatch"
  | "not_ogg";

/** Same sentence, however it was spaced or punctuated by whoever wrote the string. */
/** The words of a registered response, by language: an interface string, or the phrase's own curated text. */
function localizedText(response: { uiKey?: string; text?: Readonly<Record<string, string>> }): Record<string, string | undefined> | undefined {
  if (response.text) return response.text;
  return response.uiKey ? (UI_STRINGS[response.uiKey as keyof typeof UI_STRINGS] as Record<string, string | undefined> | undefined) : undefined;
}

const compare = (text: string): string => speakableText(text).replace(/\s+/g, " ").trim().toLowerCase();

export const clipName = (id: string, language: string): string => `${id}.${language}.ogg`;

export interface PhraseMatch { id: string; language: SupportedLanguage }

let phraseIndex: Map<string, PhraseMatch[]> | null = null;

/** Every registered phrase in every language, keyed by its comparison form. Built once, then read. */
function index(): Map<string, PhraseMatch[]> {
  if (phraseIndex) return phraseIndex;
  const built = new Map<string, PhraseMatch[]>();
  for (const [id, response] of Object.entries(LOCAL_RESPONSES)) {
    const localized = localizedText(response);
    for (const language of SUPPORTED_LANGUAGES) {
      const text = localized?.[language];
      if (!text) continue;
      const key = compare(text);
      if (!key) continue;
      const list = built.get(key) ?? [];
      list.push({ id, language });
      built.set(key, list);
    }
  }
  phraseIndex = built;
  return built;
}

/**
 * Which registered phrase, in which language, this exact text is — or null.
 * `preferred` only breaks a tie between languages that write the same words.
 */
export function matchPhrase(text: string, preferred?: string | null): PhraseMatch | null {
  const hits = index().get(compare(text));
  if (!hits || hits.length === 0) return null;
  const ids = new Set(hits.map((h) => h.id));
  if (ids.size > 1) return null;
  return hits.find((h) => h.language === preferred) ?? hits[0];
}

/** True when the text is one of the registered phrases, whatever the state of its recording. */
export const isRegisteredPhrase = (text: string): boolean => matchPhrase(text) !== null;

// ── The one place a clip is read ────────────────────────────────────────────

const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // The view, not a slice of its buffer: see the crypto.subtle realm note.
  return hex(await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
}

/** "OggS": the capture pattern every Ogg page starts with. */
export const isOggStream = (bytes: Uint8Array): boolean =>
  bytes.length > 27 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;

export type ClipResult =
  | { ok: true; bytes: Uint8Array; entry: ClipEntry }
  | { ok: false; reason: FallbackReason };

/**
 * The body, or null once it passes `max` bytes. Reads in pieces and stops, so a
 * server that sends more than it said (or says nothing) cannot make this buffer
 * the processor's whole 20 MB cap.
 */
async function readAtMost(response: Response, max: number): Promise<Uint8Array | null> {
  if (!response.body) {
    const all = new Uint8Array(await response.arrayBuffer());
    return all.length > max ? null : all;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) { await reader.cancel().catch(() => undefined); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

interface CacheRow { bytes: Uint8Array; sha256: string; expires: number }
const clipCache = new Map<string, CacheRow>();
export const clearClipCache = (): void => clipCache.clear();

export interface LoadDeps {
  assets?: Readonly<Record<string, ClipEntry>>;
  read?: EnvReader;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** A verified clip for this id and language, or the reason there is not one. */
export async function loadClip(id: string, language: string, deps: LoadDeps = {}): Promise<ClipResult> {
  const name = clipName(id, language);
  const entry = (deps.assets ?? LOCAL_AUDIO_ASSETS)[name];
  if (!entry) return { ok: false, reason: "not_listed" };
  if (entry.status !== "active") return { ok: false, reason: "disabled" };
  if (entry.bytes > MAX_CLIP_BYTES) return { ok: false, reason: "too_large" };

  const now = (deps.now ?? Date.now)();
  const cached = clipCache.get(name);
  if (cached && cached.sha256 === entry.sha256 && cached.expires > now) return { ok: true, bytes: cached.bytes, entry };

  const config = processorConfig(deps.read);
  if (!config) return { ok: false, reason: "service_off" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIP_FETCH_TIMEOUT_MS);
  let bytes: Uint8Array;
  try {
    const query = new URLSearchParams({ dataset: LOCAL_AUDIO_DATASET, path: name });
    const response = await (deps.fetchImpl ?? fetch)(`${config.url}/datahub/file?${query}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!response.ok) return { ok: false, reason: "fetch_failed" };
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > MAX_CLIP_BYTES) return { ok: false, reason: "too_large" };
    const limited = await readAtMost(response, MAX_CLIP_BYTES);
    if (!limited) return { ok: false, reason: "too_large" };
    bytes = limited;
  } catch {
    return { ok: false, reason: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }

  if (bytes.length > MAX_CLIP_BYTES) return { ok: false, reason: "too_large" };
  if (bytes.length !== entry.bytes) return { ok: false, reason: "size_mismatch" };
  if (!isOggStream(bytes)) return { ok: false, reason: "not_ogg" };
  if ((await sha256Hex(bytes)) !== entry.sha256) return { ok: false, reason: "checksum_mismatch" };

  if (clipCache.size >= MAX_CACHED_CLIPS) clipCache.delete(clipCache.keys().next().value as string);
  clipCache.set(name, { bytes, sha256: entry.sha256, expires: now + CLIP_CACHE_TTL_MS });
  return { ok: true, bytes, entry };
}

// ── The resolver `speakReply` takes ─────────────────────────────────────────

/** Whether the feature is switched on. Off unless WHATSAPP_LOCAL_AUDIO is exactly "1". */
export function localAudioEnabled(read: EnvReader): boolean {
  return (read("WHATSAPP_LOCAL_AUDIO") ?? "").trim() === "1";
}

export interface ResolverOptions extends LoadDeps {
  /** The sender's language, for a tie between languages that write a phrase identically. */
  preferred?: string | null;
  /** Called once per decision: a response id, a language and an outcome. Never the text. */
  report?: (event: { id: string; language: string; outcome: "audio" | "text"; reason?: FallbackReason }) => void;
}

/**
 * The resolver to hand to `speakReply`, or null when the feature is off or there
 * is no processing service to read clips through (so callers keep the exact
 * behaviour they had).
 */
export function localSpeechResolver(read: EnvReader, options: ResolverOptions = {}): LocalSpeechResolver | null {
  if (!localAudioEnabled(read) || processorConfig(read) === null) return null;
  return async (segment: string): Promise<LocalSpeech> => {
    const match = matchPhrase(segment, options.preferred);
    if (!match) return null;
    const clip = await loadClip(match.id, match.language, { ...options, read });
    if ("reason" in clip) {
      options.report?.({ id: match.id, language: match.language, outcome: "text", reason: clip.reason });
      return { kind: "text" };
    }
    options.report?.({ id: match.id, language: match.language, outcome: "audio" });
    return { kind: "audio", bytes: clip.bytes, mimeType: CLIP_MIME, clip: clipName(match.id, match.language), sha256: clip.entry.sha256 };
  };
}

// ── Checking the registry, without sending anything ────────────────────────

export interface RegistryProblem { id: string; language?: string; problem: string }

export interface RegistryReport {
  version: string;
  responses: number;
  expectedClips: number;
  active: number;
  disabled: number;
  missing: string[];
  problems: RegistryProblem[];
  /** The first release's clips: which exist, which do not. */
  release1: { expected: number; active: number; missing: string[] };
}

/**
 * The state of the whole registry against the strings and the manifest. Pure:
 * reads nothing from a disk and sends nothing, so it is what the tests, the
 * preparation script and a health check all share.
 */
export function inspectRegistry(assets: Readonly<Record<string, ClipEntry>> = LOCAL_AUDIO_ASSETS): RegistryReport {
  const problems: RegistryProblem[] = [];
  const missing: string[] = [];
  let expected = 0;
  let active = 0;
  let disabled = 0;
  const seen = new Set<string>();

  for (const [id, response] of Object.entries(LOCAL_RESPONSES)) {
    const localized = localizedText(response);
    if (!localized) { problems.push({ id, problem: "no_such_string" }); continue; }
    for (const language of SUPPORTED_LANGUAGES) {
      const text = localized[language];
      if (!text && response.text) continue;
      if (!text) { problems.push({ id, language, problem: "no_text_in_language" }); continue; }
      expected += 1;
      if (/[{}]/.test(text)) problems.push({ id, language, problem: "has_variables" });
      if (speakableText(text).length === 0) problems.push({ id, language, problem: "nothing_speakable" });
      const name = clipName(id, language);
      seen.add(name);
      const entry = assets[name];
      if (!entry) { missing.push(name); continue; }
      if (entry.status === "active") active += 1; else disabled += 1;
      if (entry.status === "active" && entry.reviewed !== true) problems.push({ id, language, problem: "active_without_review" });
      if (!/^[0-9a-f]{64}$/.test(entry.sha256)) problems.push({ id, language, problem: "bad_checksum_format" });
      if (!Number.isInteger(entry.bytes) || entry.bytes <= 0 || entry.bytes > MAX_CLIP_BYTES) problems.push({ id, language, problem: "bad_size" });
      if (!Number.isFinite(entry.durationMs) || entry.durationMs <= 0 || entry.durationMs > 60_000) problems.push({ id, language, problem: "bad_duration" });
      if (!/^\d{4}-\d{2}-\d{2}/.test(entry.verifiedAt)) problems.push({ id, language, problem: "bad_verified_at" });
    }
  }
  for (const name of Object.keys(assets)) {
    if (!seen.has(name)) problems.push({ id: name, problem: "entry_without_registered_phrase" });
  }
  const release1Names = RELEASE_1.ids.flatMap((id) => RELEASE_1.languages.map((language) => clipName(id, language)));
  const release1 = {
    expected: release1Names.length,
    active: release1Names.filter((n) => assets[n]?.status === "active").length,
    missing: release1Names.filter((n) => !assets[n]),
  };
  return { version: LOCAL_AUDIO_VERSION, responses: Object.keys(LOCAL_RESPONSES).length, expectedClips: expected, active, disabled, missing, problems, release1 };
}
