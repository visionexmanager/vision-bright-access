// Speech to text for WhatsApp voice notes.
//
// Groq first, OpenAI second. Both keys are already synced by deploy.yml, so
// this adds no vendor and no new credential. The order is a cost decision:
// Groq serves whisper-large-v3-turbo at a small fraction of OpenAI's per-minute
// price and is markedly faster, which matters when a person is waiting on a
// reply. OpenAI's whisper-1 is the fallback, and is what the rest of the
// project already uses (`speech-transcribe`), so behaviour degrades to
// something known rather than to nothing.

import { toBlob } from "./whatsappAttachments.ts";

function env(name: string): string | undefined {
  const deno = (globalThis as {
    Deno?: { env?: { get(key: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name);
}

/** Voice notes longer than this are declined rather than billed for. */
export const MAX_AUDIO_SECONDS = 300;

/**
 * Rough duration from byte length, used only to decline something absurd
 * before paying to transcribe it. WhatsApp voice notes are Opus at roughly
 * 16 kbit/s, so a byte is about half a millisecond.
 */
export function estimateAudioSeconds(byteLength: number, bitsPerSecond = 16_000): number {
  return (byteLength * 8) / bitsPerSecond;
}

export type TranscriptionFailure = "too_long" | "no_provider" | "empty" | "provider_error";

export type TranscriptionResult =
  | { ok: true; text: string; provider: "groq" | "openai" }
  | { ok: false; reason: TranscriptionFailure };

interface Provider {
  name: "groq" | "openai";
  endpoint: string;
  model: string;
  envKey: string;
}

const PROVIDERS: readonly Provider[] = [
  {
    name: "groq",
    endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
    model: "whisper-large-v3-turbo",
    envKey: "GROQ_API_KEY",
  },
  {
    name: "openai",
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
    model: "whisper-1",
    envKey: "OPENAI_API_KEY",
  },
];

/** A filename is required by the multipart API and decides how it is decoded. */
export function filenameForMime(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
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
 * Transcribe a voice note.
 *
 * Whisper detects the spoken language itself, so nothing is passed to bias it:
 * a hint would be a guess made from the *typed* language of earlier messages,
 * and people switch. An empty transcript is a real outcome — silence, or noise
 * — and is reported rather than sent to the model as an empty question.
 */
export async function transcribeVoice(params: {
  bytes: Uint8Array;
  mimeType: string;
  fetchImpl?: typeof fetch;
}): Promise<TranscriptionResult> {
  const seconds = estimateAudioSeconds(params.bytes.byteLength);
  if (seconds > MAX_AUDIO_SECONDS) return { ok: false, reason: "too_long" };

  const doFetch = params.fetchImpl ?? fetch;
  const available = PROVIDERS.filter((p) => !!env(p.envKey));
  if (available.length === 0) return { ok: false, reason: "no_provider" };

  for (const provider of available) {
    try {
      const form = new FormData();
      form.append(
        "file",
        toBlob(params.bytes, params.mimeType),
        filenameForMime(params.mimeType),
      );
      form.append("model", provider.model);
      form.append("response_format", "text");

      const res = await doFetch(provider.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${env(provider.envKey)}` },
        body: form,
      });

      if (!res.ok) {
        // Never log the body: it can echo request content.
        console.error(`[whatsapp-stt] ${provider.name} rejected: ${res.status}`);
        continue;
      }

      const text = (await res.text()).trim();
      if (!text) return { ok: false, reason: "empty" };
      return { ok: true, text, provider: provider.name };
    } catch {
      console.error(`[whatsapp-stt] ${provider.name} transport error`);
    }
  }
  return { ok: false, reason: "provider_error" };
}

/** Told to the user when their voice note could not be turned into text. */
export function transcriptionFailureNotice(
  language: "ar" | "en",
  reason: TranscriptionFailure,
): string {
  const en: Record<TranscriptionFailure, string> = {
    too_long: "That voice note is longer than I can process. Please send a shorter one, or type your question.",
    empty: "I couldn't hear anything in that voice note. Please try again somewhere quieter, or type your question.",
    no_provider: "I can't listen to voice notes right now. Please type your question and I'll help.",
    provider_error: "I couldn't understand that voice note. Please try again, or type your question.",
  };
  const ar: Record<TranscriptionFailure, string> = {
    too_long: "الرسالة الصوتية أطول مما أستطيع معالجته. أرسل واحدة أقصر أو اكتب سؤالك.",
    empty: "لم أسمع شيئاً في الرسالة الصوتية. جرّب في مكان أهدأ أو اكتب سؤالك.",
    no_provider: "لا أستطيع الاستماع للرسائل الصوتية حالياً. اكتب سؤالك وسأساعدك.",
    provider_error: "لم أفهم الرسالة الصوتية. حاول مرة أخرى أو اكتب سؤالك.",
  };
  return language === "ar" ? ar[reason] : en[reason];
}
