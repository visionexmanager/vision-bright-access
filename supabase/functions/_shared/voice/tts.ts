// Text to speech, in one place.
//
// Four call sites synthesised speech independently — the WhatsApp voice reply,
// `speech-generate`, `text-to-speech` and `ai-voice-chat` — with three models
// between them and four different ideas about what a failure is. None of them
// was wrong; they were written at different times for different channels, and
// nothing held them together. This is the thing that holds them together.
//
// ── What this module owns ───────────────────────────────────────────────────
//
// How a provider is called, what a failure means, and what audio comes back.
// One request shape, one result shape, one place where a provider's URL, body
// and error vocabulary are written down.
//
// ── What it deliberately does not own ───────────────────────────────────────
//
// *Policy.* Which model a feature uses, which voice, which format, how long the
// text may be, whether the result is cached, uploaded to Meta, streamed to a
// browser or stored — all of that stays at the call site, because all of it
// differs on purpose. The WhatsApp reply is `tts-1`/`alloy`/opus because a
// voice note is an optional extra on top of a reply that already went out; the
// assistant voices are `gpt-4o-mini-tts` with style instructions because they
// are the product. Collapsing those into one default would be a behaviour
// change wearing a refactor's clothes.
//
// So: a caller says exactly what it wants, and gets audio or a classified
// failure. Nothing here decides anything on a caller's behalf.
//
// Pure apart from `fetch`: no database, no storage, no channel. `fetchImpl` and
// `read` are injectable so the suite can drive every branch without a network
// or a Deno environment.

/**
 * The providers this repository has keys for. Mistral (Voxtral) was added on
 * 2026-09-25 as the voice-cloning provider while ELEVENLABS_API_KEY is unset:
 * it clones from a short sample and speaks Arabic, on the MISTRAL_API_KEY the
 * chat fallback already uses.
 */
export type TtsProvider = "openai" | "elevenlabs" | "mistral";

/** Container formats a caller may ask for. */
export type TtsFormat = "mp3" | "opus" | "wav" | "flac" | "aac" | "ogg";

export type EnvReader = (name: string) => string | undefined;

export interface TtsRequest {
  text: string;
  provider: TtsProvider;
  /** The provider's model id. Named by the caller; never defaulted here. */
  model: string;
  /** OpenAI voice name, or an ElevenLabs or Mistral voice id. */
  voice: string;
  format: TtsFormat;
  /** Omitted from the request when undefined, so a body stays byte-identical. */
  speed?: number;
  /** `gpt-4o-mini-tts` style direction. Ignored by models that have no use for it. */
  instructions?: string;
  fetchImpl?: typeof fetch;
  read?: EnvReader;
  /**
   * Told about a successful execution, once — never the text, the audio or the
   * voice (Phase 2K-1). Optional and best-effort: it is not awaited, and one
   * that throws changes nothing about the result. The provider registry's
   * recorder is the only caller that passes one; see `ttsRecorder.ts`.
   */
  record?: (execution: TtsExecution) => void;
}

/** What one successful synthesis tells the recorder. */
export interface TtsExecution {
  provider: TtsProvider;
  /** The model id actually sent to the provider. */
  model: string;
  ms: number;
}

/**
 * Why synthesis did not produce audio.
 *
 * Classified rather than thrown, because the four callers answer differently: a
 * WhatsApp reply falls back to text and says nothing, `speech-generate` shows
 * the sender a sentence naming the provider, `ai-voice-chat` returns the
 * transcript with no audio. They need the *kind* of failure, not a string.
 */
export type TtsFailure =
  | { reason: "invalid_input" }
  | { reason: "no_key"; provider: TtsProvider }
  | { reason: "rejected"; provider: TtsProvider; status: number; detail: string }
  | { reason: "empty"; provider: TtsProvider }
  | { reason: "transport"; provider: TtsProvider };

export type TtsResult =
  | {
    outcome: "audio";
    bytes: Uint8Array;
    mimeType: string;
    provider: TtsProvider;
    model: string;
    voice: string;
  }
  | { outcome: "failed"; failure: TtsFailure };

const denoEnv: EnvReader = (name) =>
  (globalThis as { Deno?: { env?: { get(key: string): string | undefined } } }).Deno?.env?.get(name);

/** The environment variable each provider's key lives in. */
export const KEY_FOR: Record<TtsProvider, string> = {
  openai: "OPENAI_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
  mistral: "MISTRAL_API_KEY",
};

/** Voxtral's model id (docs.mistral.ai, read 2026-09-25). */
export const MISTRAL_TTS_MODEL = "voxtral-mini-tts-2603";

/** What Mistral calls each format: it has no aac, and opus comes in an Ogg container. */
const MISTRAL_FORMAT: Record<TtsFormat, string> = {
  mp3: "mp3", wav: "wav", flac: "flac", opus: "opus", ogg: "opus", aac: "mp3",
};

const MISTRAL_MIME: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", opus: "audio/ogg",
};

/**
 * What OpenAI calls each format, and what it actually returns.
 *
 * `ogg` is not one of OpenAI's names: a caller asking for an OGG container gets
 * `opus`, which is what WhatsApp wants and what the voice reply has always
 * asked for.
 */
const OPENAI_FORMAT: Record<TtsFormat, string> = {
  mp3: "mp3", wav: "wav", flac: "flac", opus: "opus", aac: "aac", ogg: "opus",
};

const OPENAI_MIME: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac",
  opus: "audio/ogg", aac: "audio/aac",
};

/** ElevenLabs mime, keyed on what the *caller asked for*. See `elevenLabsMime`. */
const ELEVENLABS_MIME: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
};

/**
 * ElevenLabs returns mp3 for everything except `wav`, and the existing code
 * nonetheless labels the result by the *requested* format — so asking for
 * `ogg` yields mp3 bytes labelled `audio/ogg`. That is preserved here rather
 * than corrected: this phase changes no behaviour, and no current caller asks
 * ElevenLabs for `ogg`. It is written down so the next phase can decide.
 */
function elevenLabsMime(format: TtsFormat): string {
  return ELEVENLABS_MIME[format] ?? "audio/mpeg";
}

/**
 * The model id a request sends. For ElevenLabs, the one rule that looks like a
 * bug and is not: `tts-1` reaching this provider means "the caller did not
 * choose an ElevenLabs model", because `tts-1` is the OpenAI default that
 * flows through the shared config.
 */
export function providerModel(request: Pick<TtsRequest, "provider" | "model">): string {
  if (request.provider === "elevenlabs") {
    return request.model && request.model !== "tts-1" ? request.model : "eleven_multilingual_v2";
  }
  // Same rule for Mistral: anything that is not a Voxtral id is the shared
  // OpenAI default flowing through, not a choice.
  if (request.provider === "mistral") {
    return request.model?.startsWith("voxtral") ? request.model : MISTRAL_TTS_MODEL;
  }
  return request.model;
}

/** One provider call, as a URL and an init. Pure: builds, never sends. */
export function ttsRequestFor(
  request: TtsRequest,
  key: string,
): { url: string; init: RequestInit } {
  if (request.provider === "elevenlabs") {
    // The one rule that looks like a bug and is not: `tts-1` reaching this
    // provider means "the caller did not choose an ElevenLabs model", because
    // `tts-1` is the OpenAI default that flows through the shared config.
    const model = providerModel(request);
    const outputFormat = request.format === "wav" ? "pcm_16000" : "mp3_44100_128";
    return {
      url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(request.voice)}?output_format=${outputFormat}`,
      init: {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: request.text,
          model_id: model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: Math.min(1.2, Math.max(0.7, request.speed ?? 1)),
          },
        }),
      },
    };
  }

  if (request.provider === "mistral") {
    // POST /v1/audio/speech answers JSON: { audio_data: <base64> }. It refuses
    // `speed` and `instructions`, so neither is sent.
    return {
      url: "https://api.mistral.ai/v1/audio/speech",
      init: {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          model: providerModel(request),
          input: request.text,
          voice_id: request.voice,
          response_format: MISTRAL_FORMAT[request.format],
        }),
      },
    };
  }

  // Every optional field is omitted rather than sent as a default: a body that
  // gains a `speed` or an `instructions` field is a different request, and the
  // WhatsApp path has never sent either.
  const body: Record<string, unknown> = {
    model: request.model,
    input: request.text,
    voice: request.voice,
    response_format: OPENAI_FORMAT[request.format],
  };
  if (request.speed !== undefined) body.speed = Math.min(4, Math.max(0.25, request.speed));
  if (request.instructions !== undefined) body.instructions = request.instructions;

  return {
    url: "https://api.openai.com/v1/audio/speech",
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  };
}

/** The mime type a successful call yields, for the provider and format asked for. */
export function mimeFor(provider: TtsProvider, format: TtsFormat): string {
  if (provider === "elevenlabs") return elevenLabsMime(format);
  if (provider === "mistral") return MISTRAL_MIME[MISTRAL_FORMAT[format]] ?? "audio/mpeg";
  return OPENAI_MIME[OPENAI_FORMAT[format]] ?? "audio/mpeg";
}

/**
 * The audio bytes in a successful response.
 *
 * OpenAI and ElevenLabs send the audio itself. Mistral sends JSON with the
 * audio base64-encoded in `audio_data` (its SDK's SpeechResponse), so that one
 * is decoded here — once, for every caller.
 */
async function audioBytesOf(provider: TtsProvider, response: Response): Promise<Uint8Array> {
  if (provider !== "mistral") return new Uint8Array(await response.arrayBuffer());
  const body = await response.json() as { audio_data?: unknown };
  if (typeof body?.audio_data !== "string") return new Uint8Array(0);
  const binary = atob(body.audio_data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** What the provider said went wrong, in as much detail as it offered. */
async function detailOf(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`;
  try {
    const json = await response.json();
    return json?.error?.message ?? json?.detail?.message ?? json?.detail ?? fallback;
  } catch {
    try {
      const text = await response.text();
      return text ? text.slice(0, 200) : fallback;
    } catch {
      return fallback;
    }
  }
}

/**
 * Call the provider and hand back the raw response.
 *
 * For callers that stream the audio onward instead of buffering it — the
 * browser-facing `text-to-speech` returns `response.body` directly, and
 * buffering it here would change how quickly a listener hears the first word.
 * The body is left untouched on success; on failure it is read to classify.
 */
export async function synthesizeResponse(
  request: TtsRequest,
): Promise<{ outcome: "response"; response: Response } | { outcome: "failed"; failure: TtsFailure }> {
  const started = Date.now();
  const call = await callProvider(request);
  if (call.outcome !== "response") return call;
  if (request.provider === "mistral") {
    // Mistral's body is JSON, not audio, so it cannot be streamed onward as-is;
    // it is decoded and handed back as an audio response instead.
    let bytes: Uint8Array;
    try {
      bytes = await audioBytesOf("mistral", call.response);
    } catch {
      return { outcome: "failed", failure: { reason: "transport", provider: "mistral" } };
    }
    if (bytes.byteLength === 0) return { outcome: "failed", failure: { reason: "empty", provider: "mistral" } };
    reportExecution(request, started);
    return {
      outcome: "response",
      response: new Response(bytes.slice().buffer, { headers: { "Content-Type": mimeFor("mistral", request.format) } }),
    };
  }
  // The provider answered with audio; the body is the caller's to stream.
  reportExecution(request, started);
  return call;
}

/** Tell the recorder, if there is one, about a successful execution. Never throws. */
function reportExecution(request: TtsRequest, started: number): void {
  if (!request.record) return;
  try {
    request.record({ provider: request.provider, model: providerModel(request), ms: Date.now() - started });
  } catch {
    // Recording is never allowed to cost anyone their audio.
  }
}

async function callProvider(
  request: TtsRequest,
): Promise<{ outcome: "response"; response: Response } | { outcome: "failed"; failure: TtsFailure }> {
  if (!request.text.trim()) return { outcome: "failed", failure: { reason: "invalid_input" } };

  const read = request.read ?? denoEnv;
  const key = read(KEY_FOR[request.provider]);
  if (!key) return { outcome: "failed", failure: { reason: "no_key", provider: request.provider } };

  const { url, init } = ttsRequestFor(request, key);
  try {
    const response = await (request.fetchImpl ?? fetch)(url, init);
    if (!response.ok) {
      return {
        outcome: "failed",
        failure: {
          reason: "rejected",
          provider: request.provider,
          status: response.status,
          detail: await detailOf(response),
        },
      };
    }
    return { outcome: "response", response };
  } catch {
    return { outcome: "failed", failure: { reason: "transport", provider: request.provider } };
  }
}

/** Call the provider and buffer the audio. The shape three of the four want. */
export async function synthesize(request: TtsRequest): Promise<TtsResult> {
  const started = Date.now();
  const call = await callProvider(request);
  if (call.outcome === "failed") return { outcome: "failed", failure: call.failure };

  let bytes: Uint8Array;
  try {
    bytes = await audioBytesOf(request.provider, call.response);
  } catch {
    return { outcome: "failed", failure: { reason: "transport", provider: request.provider } };
  }
  if (bytes.byteLength === 0) {
    return { outcome: "failed", failure: { reason: "empty", provider: request.provider } };
  }

  // Only now is it a success: audio came back and was not empty.
  reportExecution(request, started);

  return {
    outcome: "audio",
    bytes,
    mimeType: mimeFor(request.provider, request.format),
    provider: request.provider,
    model: request.model,
    voice: request.voice,
  };
}

/**
 * A failure as a sentence for somebody who can act on it.
 *
 * The wording is carried over unchanged from `speech-generate`, which is the
 * only caller that shows a provider failure to a person: it names the key to
 * check, the plan to look at, or the voice that no longer exists. The other
 * three callers never show these — they fall back to text — so this is
 * deliberately not part of the result shape.
 */
export function describeTtsFailure(failure: TtsFailure): string {
  if (failure.reason === "invalid_input") return "text is required";

  if (failure.reason === "no_key") {
    if (failure.provider === "openai") return "OPENAI_API_KEY not configured";
    if (failure.provider === "mistral") {
      return "MISTRAL_API_KEY is not configured in Supabase Edge Function secrets. " +
        "This voice was cloned via Mistral and needs that key to speak.";
    }
    return "ELEVENLABS_API_KEY is not configured in Supabase Edge Function secrets. " +
      "This voice was cloned via ElevenLabs and needs that key to speak — add it in Project Settings → Edge Functions → Secrets.";
  }

  if (failure.reason === "rejected") {
    const { provider, status, detail } = failure;
    if (provider === "openai") {
      const map: Record<number, string> = {
        401: "OpenAI API key is invalid or revoked. Check OPENAI_API_KEY in Supabase secrets.",
        403: "OpenAI API key lacks permission for text-to-speech. Verify the key's allowed models.",
        429: "OpenAI rate limit reached. Please wait a moment and try again.",
        500: "OpenAI service error. This is temporary — please retry in a few seconds.",
        503: "OpenAI is temporarily unavailable. Please retry shortly.",
      };
      return map[status] ?? `OpenAI TTS error (${status}): ${detail}`;
    }
    if (provider === "mistral") {
      const map: Record<number, string> = {
        401: "Mistral API key is invalid or revoked. Check MISTRAL_API_KEY in Supabase secrets.",
        403: "Mistral declined this text (content moderation) or the key lacks access to Voxtral.",
        404: "This voice no longer exists at Mistral — it may have been deleted or wasn't cloned successfully.",
        422: `Invalid request to Mistral: ${detail}`,
        429: "Mistral rate limit reached. Please wait a moment and try again.",
      };
      return map[status] ?? `Mistral TTS error (${status}): ${detail}`;
    }
    const map: Record<number, string> = {
      401: "ElevenLabs API key is invalid or revoked. Check ELEVENLABS_API_KEY in Supabase secrets.",
      403: "ElevenLabs API key lacks permission for this voice.",
      404: "This voice no longer exists on ElevenLabs — it may have been deleted or wasn't cloned successfully.",
      422: `Invalid request to ElevenLabs: ${detail}`,
      429: "ElevenLabs rate limit or quota reached. Please wait or check your ElevenLabs plan usage.",
    };
    return map[status] ?? `ElevenLabs TTS error (${status}): ${detail}`;
  }

  const name = failure.provider === "openai" ? "OpenAI" : failure.provider === "mistral" ? "Mistral" : "ElevenLabs";
  return failure.reason === "empty"
    ? `${name} returned no audio.`
    : `${name} could not be reached. Please retry shortly.`;
}
