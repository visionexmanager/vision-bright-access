// Speaking a reply back.
//
// Opt-in only. A voice note cannot be skimmed, searched, quoted or read in a
// meeting, and it arrives in whatever room the sender happens to be in — so the
// text reply is always sent as well, and the audio is an addition rather than a
// replacement. If anything in this path fails, the customer has already been
// answered.
//
// Sending audio is two calls, not one: upload the bytes to the phone number's
// media store to get an id, then send a message referencing that id.

import { GRAPH_BASE } from "./meta.ts";
import { toBlob } from "./whatsappAttachments.ts";

function env(name: string): string | undefined {
  const deno = (globalThis as {
    Deno?: { env?: { get(key: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name);
}

/**
 * Longest reply worth speaking.
 *
 * Past this a voice note stops being convenient and becomes a lecture nobody
 * can skim, and the synthesis cost rises with every character.
 */
export const MAX_SPOKEN_CHARS = 900;

/** Whether this particular reply should also be spoken. */
export function shouldSpeak(params: {
  voiceRepliesEnabled: boolean;
  replyText: string;
  isCannedNotice: boolean;
}): boolean {
  if (!params.voiceRepliesEnabled) return false;
  // Canned notices (welcome, handover, rate limit) stay text: they carry links
  // and instructions that are useless read aloud.
  if (params.isCannedNotice) return false;
  const text = params.replyText.trim();
  return text.length > 0 && text.length <= MAX_SPOKEN_CHARS;
}

/**
 * Strip what does not survive being read aloud.
 *
 * A URL read character by character is noise; the text reply that accompanies
 * every voice note still carries it, so nothing is lost.
 */
export function speakableText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_~`#]+/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type SpeechResult =
  | { ok: true; bytes: Uint8Array; mimeType: string }
  | { ok: false };

/**
 * Synthesise speech with OpenAI `tts-1`.
 *
 * Chosen over ElevenLabs purely on cost — both keys exist, and this is an
 * optional extra on top of a reply that has already been delivered, so the
 * cheaper one is the right default. Opus in an OGG container is what WhatsApp
 * wants for a voice note.
 */
export async function synthesiseSpeech(params: {
  text: string;
  voice?: string;
  fetchImpl?: typeof fetch;
}): Promise<SpeechResult> {
  const key = env("OPENAI_API_KEY");
  if (!key) return { ok: false };

  const doFetch = params.fetchImpl ?? fetch;
  try {
    const res = await doFetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "tts-1",
        voice: params.voice ?? "alloy",
        input: params.text,
        response_format: "opus",
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp-tts] synthesis rejected:", res.status);
      return { ok: false };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) return { ok: false };
    return { ok: true, bytes, mimeType: "audio/ogg" };
  } catch {
    console.error("[whatsapp-tts] synthesis transport error");
    return { ok: false };
  }
}

/** Upload bytes to the phone number's media store. Returns the media id. */
export async function uploadWhatsAppMedia(params: {
  phoneNumberId: string;
  token: string;
  bytes: Uint8Array;
  mimeType: string;
  filename?: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const doFetch = params.fetchImpl ?? fetch;
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", params.mimeType);
  form.append(
    "file",
    toBlob(params.bytes, params.mimeType),
    params.filename ?? "reply.ogg",
  );

  try {
    const res = await doFetch(`${GRAPH_BASE}/${params.phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.token}` },
      body: form,
    });
    if (!res.ok) {
      console.error("[whatsapp-tts] media upload rejected:", res.status);
      return null;
    }
    const body = await res.json() as { id?: string };
    return body.id ?? null;
  } catch {
    console.error("[whatsapp-tts] media upload transport error");
    return null;
  }
}

/** Send an already-uploaded audio id as a voice note. */
export async function sendWhatsAppAudio(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  mediaId: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const doFetch = params.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${GRAPH_BASE}/${params.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "audio",
        audio: { id: params.mediaId },
      }),
    });
    if (!res.ok) console.error("[whatsapp-tts] audio send rejected:", res.status);
    return res.ok;
  } catch {
    console.error("[whatsapp-tts] audio send transport error");
    return false;
  }
}

/**
 * Speak a reply that has already been sent as text.
 *
 * Every failure is swallowed: the customer has their answer, and a missing
 * voice note is a smaller problem than an error message about one.
 */
export async function speakReply(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  text: string;
}): Promise<boolean> {
  const spoken = speakableText(params.text);
  if (!spoken) return false;

  const speech = await synthesiseSpeech({ text: spoken.slice(0, MAX_SPOKEN_CHARS) });
  if (!speech.ok) return false;

  const mediaId = await uploadWhatsAppMedia({
    phoneNumberId: params.phoneNumberId,
    token: params.token,
    bytes: speech.bytes,
    mimeType: speech.mimeType,
  });
  if (!mediaId) return false;

  return await sendWhatsAppAudio({
    phoneNumberId: params.phoneNumberId,
    token: params.token,
    to: params.to,
    mediaId,
  });
}
