// Which provider can speak, and hear, which language.
//
// This file exists so that "can we do Vietnamese?" has one answer that the code
// and the documentation both read from, instead of an assumption made
// separately at each call site.
//
// ── Two columns, never conflated ────────────────────────────────────────────
//
// `claim` is what the vendor's own documentation says, as understood when this
// table was written. It is not evidence. `evidence` is what **Visionex has
// measured**, and today that is `unmeasured` for every language, because no
// baseline run has happened yet — see `docs/voice-quality-baseline.md`.
//
// A language with `claim: "documented"` and `evidence: "unmeasured"` means "the
// provider says it works and nobody here has checked". That is the honest state
// of almost everything below, and it is deliberately visible rather than
// rounded up to "supported".
//
// `unknown` means exactly that: nobody has confirmed the vendor supports it and
// nobody has confirmed they do not. It is treated as *not capable* for routing,
// because guessing wrong sends somebody audio in the wrong language.
//
// Pure data and lookups. No `Deno`, no fetch, no channel.

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../whatsappLanguages.ts";

export type { SupportedLanguage };

/** What the vendor's documentation claims. Not evidence of anything. */
export type VendorClaim = "documented" | "unknown" | "unsupported";

/** What Visionex has actually measured. */
export type Evidence = "measured" | "unmeasured";

export type SttProviderName = "groq" | "openai";
export type TtsProviderName = "openai" | "elevenlabs";

export interface LanguageCapability {
  language: SupportedLanguage;
  stt: Record<SttProviderName, VendorClaim>;
  ttsClaim: Record<TtsProviderName, VendorClaim>;
  /** What Visionex has proved, per capability. Both start `unmeasured`. */
  evidence: { stt: Evidence; tts: Evidence };
  note?: string;
}

/**
 * Both STT providers run a Whisper-family model, and Whisper's published
 * language set covers all twenty Visionex locales — so the STT claim is
 * uniform. That uniformity is the *claim*, not a result: Whisper's accuracy
 * varies enormously across these languages, and only the baseline can say by
 * how much.
 */
const WHISPER_ALL: Record<SttProviderName, VendorClaim> = { groq: "documented", openai: "documented" };

/**
 * ElevenLabs `eleven_multilingual_v2` does not cover every Visionex locale.
 *
 * Four are recorded as `unknown` rather than guessed at: Persian, Urdu, Bengali
 * and Vietnamese were not confirmed against a current vendor source while this
 * table was written. `unknown` routes away from ElevenLabs, so the effect is
 * the same as unsupported until somebody verifies it — which is the safe
 * direction to be wrong in.
 */
const ELEVENLABS_UNKNOWN: ReadonlySet<string> = new Set(["fa", "ur", "bn", "vi"]);

function capabilityFor(language: SupportedLanguage): LanguageCapability {
  const elevenlabs: VendorClaim = ELEVENLABS_UNKNOWN.has(language) ? "unknown" : "documented";
  return {
    language,
    stt: WHISPER_ALL,
    ttsClaim: { openai: "documented", elevenlabs },
    evidence: { stt: "unmeasured", tts: "unmeasured" },
    ...(elevenlabs === "unknown"
      ? { note: "ElevenLabs coverage unconfirmed; OpenAI is the defined provider for this language." }
      : {}),
  };
}

/** The table, keyed by language. Built from the one canonical locale list. */
export const CAPABILITIES: Readonly<Record<SupportedLanguage, LanguageCapability>> = Object.freeze(
  Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language, capabilityFor(language)]),
  ) as Record<SupportedLanguage, LanguageCapability>,
);

export const isSupportedLanguage = (value: string | null | undefined): value is SupportedLanguage =>
  !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

/**
 * The STT providers that may be tried for this language, in order.
 *
 * Groq first, then OpenAI — the order the WhatsApp path has always used, for
 * cost. A language nobody claims to support returns an empty list, and the
 * caller fails explicitly rather than sending audio to a provider that will
 * return confident nonsense.
 *
 * An unknown or absent language falls back to the full chain: Whisper detects
 * the spoken language itself, so "we do not know what this is" is not a reason
 * to refuse to listen.
 */
export function sttProvidersFor(language?: string | null): SttProviderName[] {
  const order: SttProviderName[] = ["groq", "openai"];
  if (!isSupportedLanguage(language)) return order;
  const capability = CAPABILITIES[language];
  return order.filter((provider) => capability.stt[provider] === "documented");
}

/**
 * The TTS provider for this language, honouring a preference when it is capable.
 *
 * Returns null when nothing claims the language, which the caller must treat as
 * a refusal. Silence is a worse answer than text, but audio in the wrong
 * language is worse than both — a screen-reader user cannot see that it went
 * wrong.
 */
export function ttsProviderFor(
  language?: string | null,
  preferred?: TtsProviderName,
): TtsProviderName | null {
  const order: TtsProviderName[] = preferred === "elevenlabs"
    ? ["elevenlabs", "openai"]
    : ["openai", "elevenlabs"];
  if (!isSupportedLanguage(language)) {
    // No language named: the caller's preference stands, defaulting to OpenAI,
    // which is what every current TTS call site already does.
    return order[0];
  }
  const capability = CAPABILITIES[language];
  return order.find((provider) => capability.ttsClaim[provider] === "documented") ?? null;
}

/** Every language this build can attempt, for the documentation generator. */
export const capabilityRows = (): LanguageCapability[] =>
  SUPPORTED_LANGUAGES.map((language) => CAPABILITIES[language]);
