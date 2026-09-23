// Speech to text for WhatsApp voice notes.
//
// The provider chain itself — Groq first, OpenAI second — now lives in
// `_shared/voice/stt.ts`, the seam this channel shares with `speech-transcribe`.
// Groq serves whisper-large-v3-turbo at a small fraction of OpenAI's per-minute
// price and is markedly faster, which matters when a person is waiting on a
// reply; OpenAI's whisper-1 is the fallback. What stays here is WhatsApp's own
// channel policy: the audio-length ceiling (checked before a provider is ever
// asked, so a hopeless clip costs nothing), and this channel's four-outcome
// vocabulary with a sentence in twenty languages for each.

import { channelFailureOf, transcribe } from "./voice/stt.ts";
import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";
import { trace } from "./whatsappTelemetry.ts";

export { filenameForMime } from "./voice/stt.ts";

/** Voice notes longer than this are declined rather than billed for. */
export const MAX_AUDIO_SECONDS = 300;

/**
 * Assumed bit rate per format, used only to guess a duration from a size.
 *
 * One number for every format was wrong in the expensive direction. WhatsApp
 * records voice notes as Opus at roughly 16–24 kbit/s, but the same `audio`
 * message type also carries a *forwarded* file — an MP3 or an M4A at 128 kbit/s
 * and up. Measured against 16 kbit/s, two minutes of ordinary music-quality
 * audio looks like sixteen minutes, and was refused as "too long" without ever
 * being listened to. Each format is now measured against its own rate, and the
 * rates are the generous end of each range: over-estimating the bit rate
 * under-estimates the duration, which errs towards transcribing something
 * slightly long rather than refusing something perfectly short. The byte
 * ceiling in `whatsappMedia.ts` is what actually bounds the cost.
 */
export const ASSUMED_BITRATES: Readonly<Record<string, number>> = {
  "audio/ogg": 24_000,
  "audio/opus": 24_000,
  "audio/webm": 24_000,
  "audio/amr": 12_800,
  "audio/mpeg": 128_000,
  "audio/mp4": 128_000,
  "audio/aac": 128_000,
  "audio/wav": 256_000,
  "audio/x-wav": 256_000,
};

/** The rate to measure a format against; the Opus rate for anything unknown. */
export function assumedBitrate(mimeType: string | undefined): number {
  const base = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  return ASSUMED_BITRATES[base] ?? 24_000;
}

/**
 * Rough duration from byte length, used only to decline something absurd
 * before paying to transcribe it. Never precise, and never meant to be: it
 * exists to catch the hour-long recording, not to time anything.
 */
export function estimateAudioSeconds(byteLength: number, mimeType = "audio/ogg"): number {
  return (byteLength * 8) / assumedBitrate(mimeType);
}

export type TranscriptionFailure = "too_long" | "no_provider" | "empty" | "provider_error";

export type TranscriptionResult =
  | { ok: true; text: string; provider: "groq" | "openai" }
  | { ok: false; reason: TranscriptionFailure };

/**
 * Transcribe a voice note.
 *
 * Whisper detects the spoken language itself, so nothing is passed to bias it:
 * a hint would be a guess made from the *typed* language of earlier messages,
 * and people switch. An empty transcript is a real outcome — silence, or noise
 * — and is reported rather than sent to the model as an empty question.
 *
 * The provider chain (Groq, then OpenAI) is `_shared/voice/stt.ts`'s — this
 * function's own job is entirely the two things `stt.ts` deliberately does not
 * own: the length ceiling below, and turning its four-way `VoiceFailure` into
 * the four sentences this channel already has, in twenty languages.
 */
export async function transcribeVoice(params: {
  bytes: Uint8Array;
  mimeType: string;
  fetchImpl?: typeof fetch;
  /**
   * The delivery's correlation id, for the lines this prints.
   *
   * Optional, and used for nothing but a log suffix. It is what lets a failed
   * synthesis or an unreadable download be tied to the delivery that asked
   * for it, without the log line naming the person who sent it.
   */
  trace?: string;
}): Promise<TranscriptionResult> {
  const seconds = estimateAudioSeconds(params.bytes.byteLength, params.mimeType);
  if (seconds > MAX_AUDIO_SECONDS) {
    console.error(`[whatsapp-stt] declined ~${Math.round(seconds)}s of audio as too long${trace(params.trace)}`);
    return { ok: false, reason: "too_long" };
  }

  const heard = await transcribe({
    bytes: params.bytes,
    mimeType: params.mimeType,
    fetchImpl: params.fetchImpl,
  });

  if (heard.outcome === "transcript") {
    // An attempt before the one that answered may be a real failure (logged,
    // so a fallback is visible) or just an unconfigured provider (not worth a
    // line — it was never tried).
    for (const attempt of heard.attempts) {
      if (attempt.failure.reason === "no_key") continue;
      console.error(`[whatsapp-stt] ${attempt.provider} ${attempt.failure.reason}, falling back${trace(params.trace)}`);
    }
    return { ok: true, text: heard.text, provider: heard.provider };
  }

  for (const attempt of heard.attempts) {
    if (attempt.failure.reason === "no_key") continue; // never attempted; nothing failed
    console.error(`[whatsapp-stt] ${attempt.provider} ${attempt.failure.reason}${trace(params.trace)}`);
  }
  if (heard.attempts.length > 0 && heard.attempts.every((a) => a.failure.reason === "no_key")) {
    console.error(`[whatsapp-stt] no transcription provider is configured${trace(params.trace)}`);
  }

  // `invalid_input` (empty bytes) has no counterpart in this channel's
  // four-way vocabulary; "empty" is the sentence a sender with nothing
  // transcribable should read either way.
  const mapped = channelFailureOf(heard.failure);
  return { ok: false, reason: mapped === "invalid_input" ? "empty" : mapped };
}

/** Told to the user when their voice note could not be turned into text. */
export function transcriptionFailureNotice(
  language: Language,
  reason: TranscriptionFailure,
): string {
  const key = {
    too_long: "voiceTooLong",
    empty: "voiceEmpty",
    no_provider: "voiceNoProvider",
    provider_error: "voiceUnclear",
  } as const;
  return say(key[reason], language);
}
