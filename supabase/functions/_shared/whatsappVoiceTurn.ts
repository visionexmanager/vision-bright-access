// A voice note becoming a question, as one function with its steps handed to it.
//
// Nothing here is new work. Downloading is `whatsappMedia.ts`, which checks the
// host against Meta's before it fetches anything and enforces the size ceiling
// twice; transcription is `whatsappTranscribe.ts`, Groq first and OpenAI second.
// Both have been in production since long before this engine existed and are
// called, not reimplemented.
//
// What this adds is the same thing the provider seam added to the text side: a
// place where the steps are arguments. The webhook passes the real download and
// the real transcriber; a test passes functions that return exactly the case it
// is about — a corrupt file, a silent recording, a provider that never answers
// — so "the transcription failed" means this function returned that, rather
// than a string appearing near another string in a source file.
//
// It also adds the one thing the pair genuinely lacked: a clock. Transcription
// had no timeout, and Meta redelivers a webhook that does not answer promptly,
// so a provider hanging did not eventually succeed — it produced a second copy
// of the same voice note.
//
// Pure in the sense that matters: it contacts nothing itself.

import type { MediaFailure, MediaResult } from "./whatsappMedia.ts";
import type { TranscriptionFailure, TranscriptionResult } from "./whatsappTranscribe.ts";

/** The two steps, injected. The webhook supplies the real ones. */
export interface VoiceTurnDeps {
  download: (mediaId: string) => Promise<MediaResult>;
  transcribe: (input: { bytes: Uint8Array; mimeType: string }) => Promise<TranscriptionResult>;
  /** Injected for tests; the default is the real clock. */
  now?: () => number;
}

/** Why a voice note produced no question. `timeout` is this file's own. */
export type VoiceFailure = TranscriptionFailure | "timeout";

export type VoiceTurn =
  | { status: "heard"; text: string; provider: string; mimeType: string; bytes: number; ms: number }
  | { status: "media_failed"; reason: MediaFailure; ms: number }
  | { status: "not_heard"; reason: VoiceFailure; ms: number };

/**
 * How long to wait for a transcriber.
 *
 * Shorter than the model's own budget: a voice note is the *first* half of the
 * work, and the answer still has to be generated and possibly spoken inside
 * the same delivery. Twenty seconds is far past a normal Whisper turnaround for
 * a message somebody recorded on a phone.
 */
export const DEFAULT_TRANSCRIBE_TIMEOUT_MS = 20_000;

/**
 * Explicit guards for the two `{ ok: boolean }` results this composes.
 *
 * `tsconfig.app.json` sets `strict: false`, and without `strictNullChecks` a
 * boolean discriminant widens to `boolean` — so `if (!result.ok)` does not
 * narrow the union and `result.reason` is an error. A type predicate narrows
 * regardless of the setting, and says out loud what the `!` was quietly relying
 * on. Both are one-liners over the existing types; neither invents a shape.
 */
const mediaFailed = (result: MediaResult): result is Extract<MediaResult, { ok: false }> =>
  !result.ok;

const notTranscribed = (
  result: TranscriptionResult,
): result is Extract<TranscriptionResult, { ok: false }> => !result.ok;

class TranscribeTimeout extends Error {
  constructor() {
    super("transcription timed out");
    this.name = "TranscribeTimeout";
  }
}

/**
 * Download, transcribe, and say plainly how it ended.
 *
 * Three endings, all values: heard, the media could not be fetched, or nothing
 * could be made of it. Nothing throws — the caller's job on the two failures is
 * the same shape, and a function that sometimes throws makes that harder to get
 * right rather than easier.
 */
export async function voiceToText(
  mediaId: string,
  deps: VoiceTurnDeps,
  options: { timeoutMs?: number } = {},
): Promise<VoiceTurn> {
  const clock = deps.now ?? Date.now;
  const startedAt = clock();
  const elapsed = () => clock() - startedAt;

  let media: MediaResult;
  try {
    media = await deps.download(mediaId);
  } catch {
    // A thrown download is the same outcome as a refused one as far as the
    // sender is concerned, and the reason is the one that tells them to resend.
    return { status: "media_failed", reason: "download_failed", ms: elapsed() };
  }
  if (mediaFailed(media)) return { status: "media_failed", reason: media.reason, ms: elapsed() };

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TRANSCRIBE_TIMEOUT_MS;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TranscribeTimeout()), timeoutMs);
    });

    const heard: TranscriptionResult = await Promise.race([
      deps.transcribe({ bytes: media.bytes, mimeType: media.mimeType }),
      timeout,
    ]);

    if (notTranscribed(heard)) return { status: "not_heard", reason: heard.reason, ms: elapsed() };

    const text = heard.text.trim();
    // A transcriber that answers with whitespace has heard nothing, whatever it
    // says about that. Sending it on would spend a model call on an empty
    // question and answer somebody's silence.
    if (!text) return { status: "not_heard", reason: "empty", ms: elapsed() };

    return {
      status: "heard",
      text,
      provider: heard.provider,
      mimeType: media.mimeType,
      bytes: media.bytes.byteLength,
      ms: elapsed(),
    };
  } catch (error) {
    if (error instanceof TranscribeTimeout) {
      return { status: "not_heard", reason: "timeout", ms: elapsed() };
    }
    // Never the message: a provider's error can echo the request, and the
    // request is somebody's voice.
    return { status: "not_heard", reason: "provider_error", ms: elapsed() };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * The failure to show a sender, for a reason this file invented.
 *
 * `timeout` has no notice of its own on purpose: to the person waiting it is
 * indistinguishable from a provider that answered badly, and "try again" is the
 * right advice for both. Everything else keeps the notice it already had.
 */
export const noticeReasonFor = (reason: VoiceFailure): TranscriptionFailure =>
  reason === "timeout" ? "provider_error" : reason;
