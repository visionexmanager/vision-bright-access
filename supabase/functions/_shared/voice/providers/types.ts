// The shape a voice provider has to have.
//
// This is the seam a future local model plugs into. When a GPU exists,
// `providers/local.ts` implements `SttAdapter` — and possibly `TtsAdapter` —
// and appears in the registry beside Groq and OpenAI. Nothing in the callers,
// the channels or the capability table changes.
//
// ── Why an adapter rather than a switch statement ───────────────────────────
//
// A `switch (provider)` inside the seam would work today and would have to be
// edited in three places the day a fourth provider arrives. An adapter is a
// value: the registry can be extended, a test can substitute a fake without a
// network, and a local provider can be registered only when its environment
// says the weights are present.
//
// Pure types plus one small contract. No `Deno`, no fetch.

import type { SttProviderName, SupportedLanguage, TtsProviderName } from "../capabilities.ts";

export type EnvReader = (name: string) => string | undefined;

/** Why a provider produced no result. Shared by both capabilities. */
export type VoiceFailure =
  | { reason: "invalid_input" }
  | { reason: "no_key"; provider: string }
  | { reason: "no_capable_provider"; language: string }
  | { reason: "rejected"; provider: string; status: number; detail: string }
  | { reason: "empty"; provider: string }
  | { reason: "transport"; provider: string };

export interface SttInput {
  bytes: Uint8Array;
  mimeType: string;
  /** Required by the multipart API, and it decides how the audio is decoded. */
  filename: string;
  /**
   * A hint, never a constraint, and off by default.
   *
   * Whisper detects the spoken language itself. The WhatsApp path deliberately
   * passes nothing, because the only hint available there is the language of
   * *earlier typed messages*, and people switch mid-conversation. A caller that
   * genuinely knows — a website form where the user picked a language — may
   * pass one.
   */
  language?: SupportedLanguage;
  fetchImpl?: typeof fetch;
  read?: EnvReader;
}

export type SttOutcome =
  | { outcome: "transcript"; text: string; provider: SttProviderName; model: string; ms: number }
  | { outcome: "failed"; failure: VoiceFailure; ms: number };

export interface SttAdapter {
  readonly provider: SttProviderName;
  readonly model: string;
  /** The environment variable this adapter needs, so the seam can skip it early. */
  readonly keyName: string;
  transcribe(input: SttInput): Promise<SttOutcome>;
}

/**
 * The text-to-speech equivalent, declared here so the local provider has one
 * interface to implement for both capabilities.
 *
 * Today's TTS lives in `../tts.ts`, which already encapsulates OpenAI and
 * ElevenLabs behind one request shape and is used by all four call sites. It is
 * deliberately **not** rewritten into an adapter yet: doing so would churn a
 * seam that shipped last phase without adding a capability. When a local TTS
 * model arrives, `tts.ts` grows a registry of these and the call sites do not
 * change.
 */
export interface TtsAdapter {
  readonly provider: TtsProviderName | "local";
  readonly model: string;
  readonly keyName: string;
  synthesize(input: {
    text: string;
    voice: string;
    format: string;
    language?: SupportedLanguage;
    fetchImpl?: typeof fetch;
    read?: EnvReader;
  }): Promise<
    | { outcome: "audio"; bytes: Uint8Array; mimeType: string; ms: number }
    | { outcome: "failed"; failure: VoiceFailure; ms: number }
  >;
}

/** The default environment probe. Absent under Vitest, which is why it is soft. */
export const denoEnv: EnvReader = (name) =>
  (globalThis as { Deno?: { env?: { get(key: string): string | undefined } } }).Deno?.env?.get(name);
