// Speech to text, in one place.
//
// The counterpart to `tts.ts`. Two call sites transcribe audio today — the
// WhatsApp voice note and the website's `speech-transcribe` — with different
// providers, different limits and different ideas about failure. This is the
// contract they will share.
//
// ── What this module owns ───────────────────────────────────────────────────
//
// Which providers may be tried for a language, in what order, what a failure
// means, and what a transcript looks like when it comes back.
//
// ── What it deliberately does not own ───────────────────────────────────────
//
// *Channel policy.* How long an audio clip may be, what the sender is told when
// it is too long, whether the transcript is stored, how it is logged, and what
// happens next. The WhatsApp path caps at 300 seconds and answers a failure
// with a sentence in twenty languages; the website caps at 25 MB and answers
// with JSON. Both stay where they are.
//
// ── The fallback rule, and why it is capability-aware ───────────────────────
//
// A chain that tries every provider in order regardless of language is how a
// system ends up confidently transcribing Bengali with something that has never
// seen it. The order comes from `capabilities.ts`, and a language no provider
// claims fails as `no_capable_provider` rather than being sent anywhere.
//
// Today both providers run a Whisper-family model whose published language set
// covers all twenty locales, so in practice the chain is Groq then OpenAI
// everywhere. That is the *claim*, not a measurement — the moment a local
// provider is registered with a narrower language list, this rule starts doing
// visible work.
//
// Pure apart from `fetch`, which the adapters take by injection.

import { sttProvidersFor, type SttProviderName, type SupportedLanguage } from "./capabilities.ts";
import { groqWhisper } from "./providers/groq.ts";
import { openaiWhisper } from "./providers/openai.ts";
import type { EnvReader, SttAdapter, VoiceFailure } from "./providers/types.ts";
import { denoEnv } from "./providers/types.ts";

export type { SttProviderName, VoiceFailure };

/**
 * Every adapter this build can use, by name.
 *
 * A future `local.ts` is registered here and becomes available to every caller
 * at once. Nothing else has to change: the order comes from the capability
 * table, and the callers ask for a language rather than a provider.
 */
const ADAPTERS: Readonly<Record<SttProviderName, SttAdapter>> = {
  groq: groqWhisper,
  openai: openaiWhisper,
};

export interface TranscribeRequest {
  bytes: Uint8Array;
  mimeType: string;
  /** Defaults from the mime type. The API needs one to decode the audio. */
  filename?: string;
  /**
   * A hint, and off by default.
   *
   * The WhatsApp path passes nothing on purpose: the only hint available there
   * is the language of earlier *typed* messages, and people switch mid-thread.
   * A website form where somebody chose a language may pass one.
   */
  language?: SupportedLanguage;
  /** Overrides the capability-derived order. For tests and for one-off routing. */
  providers?: SttProviderName[];
  fetchImpl?: typeof fetch;
  read?: EnvReader;
}

/** One provider's turn, kept so a caller can log why the chain moved on. */
export interface TranscribeAttempt {
  provider: SttProviderName;
  model: string;
  failure: VoiceFailure;
  ms: number;
}

export type TranscribeResult =
  | {
    outcome: "transcript";
    text: string;
    provider: SttProviderName;
    model: string;
    ms: number;
    /** Providers that failed before this one succeeded. Usually empty. */
    attempts: TranscribeAttempt[];
  }
  | { outcome: "failed"; failure: VoiceFailure; attempts: TranscribeAttempt[] };

/** A filename is required by the multipart API, and it decides the decoder. */
export function filenameForMime(mime: string): string {
  const base = (mime ?? "").split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "audio/ogg": "voice.ogg",
    "audio/opus": "voice.opus",
    "audio/mpeg": "voice.mp3",
    "audio/mp4": "voice.m4a",
    "audio/aac": "voice.aac",
    "audio/amr": "voice.amr",
    "audio/wav": "voice.wav",
    "audio/x-wav": "voice.wav",
    "audio/webm": "voice.webm",
  };
  return map[base] ?? "voice.ogg";
}

/**
 * Transcribe audio, trying the providers that claim the language in order.
 *
 * A provider with no key is skipped rather than attempted — a missing key is a
 * deployment fact, not a transcription failure, and spending a request to
 * discover it would be slower and no more informative. It still appears in
 * `attempts`, so "why did this go to OpenAI?" has an answer.
 *
 * The first transcript wins. An *empty* transcript is a failure, not a result,
 * and the chain moves on: silence at one provider is worth a second opinion,
 * and an empty question must never reach the model.
 */
export async function transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
  const attempts: TranscribeAttempt[] = [];

  if (!request.bytes || request.bytes.byteLength === 0) {
    return { outcome: "failed", failure: { reason: "invalid_input" }, attempts };
  }

  const order = request.providers ?? sttProvidersFor(request.language);
  if (order.length === 0) {
    return {
      outcome: "failed",
      failure: { reason: "no_capable_provider", language: request.language ?? "unknown" },
      attempts,
    };
  }

  const read = request.read ?? denoEnv;
  const input = {
    bytes: request.bytes,
    mimeType: request.mimeType,
    filename: request.filename ?? filenameForMime(request.mimeType),
    language: request.language,
    fetchImpl: request.fetchImpl,
    read,
  };

  for (const name of order) {
    const adapter = ADAPTERS[name];
    if (!adapter) continue;

    if (!read(adapter.keyName)) {
      attempts.push({
        provider: adapter.provider,
        model: adapter.model,
        failure: { reason: "no_key", provider: adapter.provider },
        ms: 0,
      });
      continue;
    }

    const heard = await adapter.transcribe(input);
    if (heard.outcome === "transcript") {
      return {
        outcome: "transcript",
        text: heard.text,
        provider: heard.provider,
        model: heard.model,
        ms: heard.ms,
        attempts,
      };
    }
    attempts.push({
      provider: adapter.provider,
      model: adapter.model,
      failure: heard.failure,
      ms: heard.ms,
    });
  }

  // Every provider failed. The last failure is the most informative one to
  // hand back — it is the one that got furthest.
  const last = attempts[attempts.length - 1];
  return {
    outcome: "failed",
    failure: last?.failure ?? { reason: "no_capable_provider", language: request.language ?? "unknown" },
    attempts,
  };
}

/**
 * The failure, reduced to the four outcomes a channel actually distinguishes.
 *
 * `whatsappTranscribe.ts` already answers each of these with its own sentence
 * in twenty languages, and the website answers with JSON. This maps the seam's
 * vocabulary onto theirs without either of them learning the seam's.
 */
export type ChannelFailure = "no_provider" | "empty" | "provider_error" | "invalid_input";

export function channelFailureOf(failure: VoiceFailure): ChannelFailure {
  if (failure.reason === "invalid_input") return "invalid_input";
  if (failure.reason === "no_key" || failure.reason === "no_capable_provider") return "no_provider";
  if (failure.reason === "empty") return "empty";
  return "provider_error";
}
