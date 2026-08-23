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
 * Longest single voice note.
 *
 * Past this a voice note stops being convenient and becomes a lecture nobody
 * can skim, and the synthesis cost rises with every character.
 */
export const MAX_SPOKEN_CHARS = 900;

/**
 * How many voice notes one reply may become.
 *
 * A reply is clamped at 3900 characters, and this used to be spoken only if the
 * whole of it fitted in one 900-character note — so every thorough answer, which
 * is exactly the kind somebody asks for out loud, arrived as text and nothing
 * else. The sender heard silence and read that as the feature being broken. A
 * long answer is now spoken in order, in pieces that end on sentence
 * boundaries, and this count is what bounds the cost: 2700 characters spoken
 * at the very most, with the text reply carrying every word either way.
 */
export const MAX_SPOKEN_PARTS = 3;

/**
 * How a conversation wants its replies delivered.
 *
 *   mirror - the medium the sender used. A voice note is answered out loud, a
 *            typed message in writing. The default, and the one nobody has to
 *            ask for: sending a voice note already says how you want to be
 *            answered, and making somebody set a preference to get that is
 *            asking them to configure the obvious.
 *   always - spoken even when they typed, because they asked for that.
 *   never  - text only, because they asked for that.
 */
export type VoiceMode = "mirror" | "always" | "never";

export const DEFAULT_VOICE_MODE: VoiceMode = "mirror";

/** Read the column safely: an unknown or missing value means the default. */
export function voiceModeOf(value: string | null | undefined): VoiceMode {
  return value === "always" || value === "never" || value === "mirror" ? value : DEFAULT_VOICE_MODE;
}

/** Whether this particular reply should also be spoken. */
export function shouldSpeak(params: {
  mode: VoiceMode;
  /** Whether the message being answered was itself a voice note. */
  spokenInput: boolean;
  replyText: string;
  isCannedNotice: boolean;
}): boolean {
  if (params.mode === "never") return false;
  if (params.mode === "mirror" && !params.spokenInput) return false;
  // The welcome and the menus stay text: they are lists of links and taps,
  // which is the one thing audio is worse at than text.
  if (params.isCannedNotice) return false;
  return speakableText(params.replyText).length > 0;
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

/**
 * Cut a reply into voice notes that each end where a sentence does.
 *
 * Splitting on a character count alone would cut mid-word, and mid-word in
 * Arabic is often mid-meaning. Sentence enders are matched for both scripts —
 * the Arabic question mark is `؟`, not `?` — and a single sentence too long for
 * one note is split on the last space that fits, because a sentence that long
 * is a list, and any word boundary reads better than none.
 */
export function speechSegments(
  text: string,
  limit = MAX_SPOKEN_CHARS,
  maxParts = MAX_SPOKEN_PARTS,
): string[] {
  const spoken = speakableText(text);
  if (!spoken) return [];

  // The delimiter stays with the sentence it closes.
  const sentences = spoken
    .split(/(?<=[.!?؟…])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const segments: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) segments.push(current.trim());
    current = "";
  };

  for (const sentence of sentences) {
    if (segments.length >= maxParts) break;

    let rest = sentence;
    // A sentence that cannot fit in a note of its own is broken on spaces.
    while (rest.length > limit) {
      flush();
      if (segments.length >= maxParts) return segments.slice(0, maxParts);
      const window = rest.slice(0, limit);
      const cut = window.lastIndexOf(" ");
      const head = cut > limit / 2 ? window.slice(0, cut) : window;
      segments.push(head.trim());
      rest = rest.slice(head.length).trim();
    }

    if (!current) current = rest;
    else if (current.length + 1 + rest.length <= limit) current = `${current} ${rest}`;
    else {
      flush();
      current = rest;
    }
  }

  if (segments.length < maxParts) flush();
  return segments.slice(0, maxParts);
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
  if (!key) {
    console.error("[whatsapp-tts] no OPENAI_API_KEY — the reply went out as text only");
    return { ok: false };
  }

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
    if (bytes.byteLength === 0) {
      console.error("[whatsapp-tts] synthesis returned no audio");
      return { ok: false };
    }
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
    if (!body.id) console.error("[whatsapp-tts] media upload returned no id");
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
 * voice note is a smaller problem than an error message about one. Every
 * failure is now also printed. Nothing about a spoken reply is recorded in the
 * transcript — by design, it is the same words as the text row above it — so
 * without these lines a reply that was never spoken looked exactly like a reply
 * nobody had asked to hear, which is the state this feature was reported in.
 *
 * Parts are sent one at a time and a failed part ends the sequence: three notes
 * arriving out of order would be worse than two in order.
 */
export async function speakReply(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  text: string;
}): Promise<boolean> {
  const segments = speechSegments(params.text);
  if (segments.length === 0) return false;

  let spoken = 0;
  for (const segment of segments) {
    const speech = await synthesiseSpeech({ text: segment });
    if (!speech.ok) break;

    const mediaId = await uploadWhatsAppMedia({
      phoneNumberId: params.phoneNumberId,
      token: params.token,
      bytes: speech.bytes,
      mimeType: speech.mimeType,
    });
    if (!mediaId) break;

    const sent = await sendWhatsAppAudio({
      phoneNumberId: params.phoneNumberId,
      token: params.token,
      to: params.to,
      mediaId,
    });
    if (!sent) break;
    spoken += 1;
  }

  if (spoken === 0) {
    console.error("[whatsapp-tts] nothing was spoken; the reply stands as text");
    return false;
  }
  console.log(`[whatsapp-tts] spoke a reply in ${spoken}/${segments.length} parts`);
  return true;
}
