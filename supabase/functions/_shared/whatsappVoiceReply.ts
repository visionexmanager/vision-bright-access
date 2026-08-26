// Answering in the medium the question arrived in.
//
// ── What changed, and why ───────────────────────────────────────────────────
//
// Audio used to be an *addition*: the text always went out, and a voice note
// followed it when a stored preference said so. That meant somebody who asked a
// question out loud received the answer twice — once to read and once to hear —
// and somebody who had once asked for voice kept getting audio for questions
// they typed weeks later, on a train, in a meeting.
//
// Now the medium of the answer is the medium of the question. A voice note is
// answered with a voice note and nothing else; a typed message is answered in
// writing and nothing else. No stored preference can make it sticky, because
// the only thing that knows which one a person wants right now is the message
// they just sent.
//
// The interface is the exception, and stays text: menus, onboarding questions,
// language lists and refusals. A list of things to tap cannot be a voice note,
// and a failure notice that needs a second provider to be heard is a failure
// notice that can itself go missing.
//
// Sending audio is two calls, not one: upload the bytes to the phone number's
// media store to get an id, then send a message referencing that id.

import { GRAPH_BASE } from "./meta.ts";
import { synthesize } from "./voice/tts.ts";
import { toBlob } from "./whatsappAttachments.ts";
import { clampUnits } from "./whatsappSafety.ts";
import { trace } from "./whatsappTelemetry.ts";
import {
  isCacheableSpeech,
  neverThrows,
  speechCacheKey,
  SPEECH_CACHE_TTL_MS,
  type SpeechCacheStore,
} from "./whatsappSpeechCache.ts";

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
 * A long answer is spoken in order, in pieces that end on sentence boundaries,
 * and this count is what bounds the cost: 2700 characters at the very most.
 *
 * It is also the reason a spoken answer is no longer put through `splitAnswer`
 * first. That split exists for WhatsApp's 4096-character text ceiling, which
 * does not apply to audio at all — and three text parts each becoming three
 * voice notes is nine voice notes for one question, which is not an answer,
 * it is a podcast.
 */
export const MAX_SPOKEN_PARTS = 3;

/**
 * How a conversation wants its replies delivered.
 *
 * Kept as a type and a column reader because the preference parser still
 * recognises the phrases people say — but it no longer decides anything. The
 * medium of an answer is the medium of the question and nothing else; see
 * `replyMedium` for why.
 */
export type VoiceMode = "mirror" | "always" | "never";

export const DEFAULT_VOICE_MODE: VoiceMode = "mirror";

/** Read the column safely: an unknown or missing value means the default. */
export function voiceModeOf(value: string | null | undefined): VoiceMode {
  return value === "always" || value === "never" || value === "mirror" ? value : DEFAULT_VOICE_MODE;
}

/** How one reply travels. There is no third option and no "both". */
export type ReplyMedium = "text" | "voice";

/**
 * The kinds of message that are an *answer* rather than the interface talking.
 *
 * Both mirror the medium — a refusal to somebody who asked out loud is spoken
 * exactly as an answer is. What the distinction decides is what happens when
 * synthesis *fails*: see `deliverReply`, where an answer that could not be
 * spoken is replaced by a short apology rather than dumped as a wall of text,
 * and a notice that could not be spoken is simply written out, because it was
 * already one short safe sentence.
 */
const ANSWER_KINDS: ReadonlySet<string> = new Set(["reply"]);

/**
 * The medium one reply goes out in.
 *
 * The inbound message decides, and nothing else does. A voice note is answered
 * out loud and *only* out loud; a typed message is answered in writing and only
 * in writing. Nobody receives the same thing twice in two forms, which is what
 * used to happen and what made a spoken reply feel like an echo rather than an
 * answer.
 *
 * Every user-facing response, not only the answer. A refusal, an apology, a
 * "that service isn't open yet" — somebody who asked out loud hears all of it,
 * because half a conversation in audio and half on screen is worse than either
 * on its own for the person this channel is built for.
 *
 * ── Why no preference is consulted ──────────────────────────────────────────
 *
 * There used to be a stored `voice_mode`, and it could say "always speak" or
 * "never speak". Both are wrong here, and wrong in the same way: they make the
 * medium sticky. Somebody who sent one voice note last Tuesday would get audio
 * for a question they typed on a train today, and somebody who once asked for
 * text would get silence in reply to a voice note they recorded because their
 * hands were full. The question in hand is the only thing that knows which of
 * those a person wants right now, so it is the only thing asked.
 *
 * Pure, and deliberately not async: the decision is separable from the sending,
 * which is what lets the suite assert the transport of a whole conversation
 * without a Meta account or a synthesis bill.
 */
export function replyMedium(params: {
  /** Whether the message being answered was itself a voice note. */
  spokenInput: boolean;
  /** Text with nothing speakable in it — a bare URL — cannot be a voice note. */
  body?: string;
}): ReplyMedium {
  if (!params.spokenInput) return "text";
  if (params.body !== undefined && speakableText(params.body).length === 0) return "text";
  return "voice";
}

/**
 * Strip what does not survive being read aloud.
 *
 * A URL read character by character is noise, and markdown emphasis read aloud
 * is a star. What is left is what a person would actually say — and if that
 * turns out to be nothing at all, `replyMedium` sends the reply as text
 * instead, because an empty voice note is worse than a short message.
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
      // Whole characters only. A voice note is synthesised from these bytes,
      // and half a surrogate pair is a character the synthesiser cannot say.
      const window = clampUnits(rest, limit);
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
/**
 * The model and the voice, named rather than repeated.
 *
 * They were both defaults inside `synthesiseSpeech` until the cache needed
 * them: a cache key has to include everything that changes the audio, and a
 * default buried in a call site is exactly the kind of thing that changes one
 * day and silently starts returning the old voice from cache.
 */
export const SPEECH_MODEL = "tts-1";
export const DEFAULT_VOICE = "alloy";

export async function synthesiseSpeech(params: {
  text: string;
  voice?: string;
  fetchImpl?: typeof fetch;
}): Promise<SpeechResult> {
  // The call itself moved to `voice/tts.ts`, which every other synthesising
  // path now uses as well. What stays here is this channel's policy — the
  // model, the voice, opus in an OGG container — and this channel's answer to
  // a failure, which is silence plus a log line, because the text reply has
  // already been delivered and a missing voice note is an absent extra rather
  // than a lost answer.
  const result = await synthesize({
    text: params.text,
    provider: "openai",
    model: SPEECH_MODEL,
    voice: params.voice ?? DEFAULT_VOICE,
    format: "opus",
    fetchImpl: params.fetchImpl,
    read: env,
  });

  if (result.outcome === "audio") return { ok: true, bytes: result.bytes, mimeType: result.mimeType };

  // The same four sentences this file has always logged, chosen by the same
  // four conditions. A voice note that failed must still be diagnosable from
  // the log alone, and nothing here names the sender or the words.
  const { failure } = result;
  if (failure.reason === "no_key") {
    console.error("[whatsapp-tts] no OPENAI_API_KEY — the reply went out as text only");
  } else if (failure.reason === "rejected") {
    console.error("[whatsapp-tts] synthesis rejected:", failure.status);
  } else if (failure.reason === "empty") {
    console.error("[whatsapp-tts] synthesis returned no audio");
  } else {
    console.error("[whatsapp-tts] synthesis transport error");
  }
  return { ok: false };
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
 * The three calls one voice note costs, as a unit that can be substituted.
 *
 * A miss pays all three. A hit pays only `send`, which is the whole point of
 * the cache.
 */
export interface SpeechOperations {
  synthesise(text: string): Promise<SpeechResult>;
  upload(bytes: Uint8Array, mimeType: string, phoneNumberId: string, token: string): Promise<string | null>;
  send(mediaId: string, phoneNumberId: string, token: string, to: string): Promise<boolean>;
}

const DEFAULT_SPEECH_OPS: SpeechOperations = {
  synthesise: (text) => synthesiseSpeech({ text }),
  upload: (bytes, mimeType, phoneNumberId, token) =>
    uploadWhatsAppMedia({ phoneNumberId, token, bytes, mimeType }),
  send: (mediaId, phoneNumberId, token, to) =>
    sendWhatsAppAudio({ phoneNumberId, token, to, mediaId }),
};

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
  /**
   * The delivery's correlation id, for the lines this prints.
   *
   * Optional, and used for nothing but a log suffix. It is what lets a failed
   * synthesis or an unreadable download be tied to the delivery that asked
   * for it, without the log line naming the person who sent it.
   */
  trace?: string;
  /**
   * Where already-synthesised voice notes are remembered, if anywhere.
   *
   * Omitted means every segment is synthesised and uploaded, which is what this
   * function did before the cache existed and is what it still does in every
   * test that does not ask for one. A cache is an optimisation on a path that
   * already worked; it is never a dependency.
   */
  cache?: SpeechCacheStore | null;
  /**
   * The three operations a voice note is made of, injectable.
   *
   * The same seam `deliverReply` already has, and for the same reason it gives:
   * a suite can drive a cache hit, a cache miss, and a cached id Meta has
   * forgotten, through the real policy, counting what actually happened —
   * without a Meta account, a synthesis bill, or a single assertion about the
   * shape of this file.
   *
   * That is not a luxury here. The branch that matters most is the one where a
   * cached id is refused and the segment is synthesised again, and it is
   * unreachable from a test that cannot make a send fail.
   */
  ops?: Partial<SpeechOperations>;
}): Promise<boolean> {
  const ops: SpeechOperations = { ...DEFAULT_SPEECH_OPS, ...(params.ops ?? {}) };
  // Wrapped rather than trusted. The parameter's type is an interface, so the
  // store is whatever the caller passed, and a throw from it would come out of
  // a function whose whole contract is that it never costs somebody their
  // answer. The live store already swallows its errors; this makes that true of
  // any store.
  const store = params.cache ? neverThrows(params.cache) : null;
  const segments = speechSegments(params.text);
  if (segments.length === 0) return false;

  let spoken = 0;
  let reused = 0;

  for (const segment of segments) {
    // ── Has this exact sentence already been said? ─────────────────────
    //
    // The main menu, the twenty language names and every refusal notice are
    // fixed strings that are synthesised again for every sender who hears
    // them. A hit skips the synthesis *and* the upload, so the whole segment
    // costs one Graph call instead of three.
    //
    // The key is computed only for text short enough to be worth a row — see
    // `isCacheableSpeech`. A long answer is almost certainly unique, and
    // hashing it would buy a row that is never hit again.
    const key = store && isCacheableSpeech(segment)
      ? await speechCacheKey({
          phoneNumberId: params.phoneNumberId,
          voice: DEFAULT_VOICE,
          model: SPEECH_MODEL,
          text: segment,
        })
      : null;

    let mediaId = key ? await store!.get(key) : null;
    const fromCache = mediaId !== null;

    if (!mediaId) {
      const speech = await ops.synthesise(segment);
      if (!speech.ok) break;

      mediaId = await ops.upload(speech.bytes, speech.mimeType, params.phoneNumberId, params.token);
      if (!mediaId) break;
    }

    let sent = await ops.send(mediaId, params.phoneNumberId, params.token, params.to);

    // ── A cached id Meta no longer recognises ──────────────────────────
    //
    // Meta keeps uploaded media for thirty days and the TTL sits well inside
    // that, but "well inside" is not "never". When a send fails on an id that
    // came from the cache, the row is dropped and the segment takes the
    // ordinary path once. That single retry is the entire cost of a stale
    // entry, and it is why a cache miss and a cache lie both end with the
    // customer hearing their answer.
    //
    // Only for a cached id. Retrying a freshly uploaded one would be retrying
    // a genuine send failure, which is the case where stopping is right.
    if (!sent && fromCache && key) {
      console.log(`[whatsapp-tts] a cached voice note was refused; synthesising again${trace(params.trace)}`);
      await store!.drop(key);

      const speech = await ops.synthesise(segment);
      if (!speech.ok) break;
      const fresh = await ops.upload(speech.bytes, speech.mimeType, params.phoneNumberId, params.token);
      if (!fresh) break;
      mediaId = fresh;
      sent = await ops.send(mediaId, params.phoneNumberId, params.token, params.to);
    }

    if (!sent) break;
    spoken += 1;
    if (fromCache) reused += 1;

    // Written after the send, never before. A row that promises audio which
    // was never successfully delivered would hand the same broken id to
    // everybody who hears this sentence next.
    if (key && !fromCache) {
      await store!.put(key, mediaId, new Date(Date.now() + SPEECH_CACHE_TTL_MS));
    }
  }

  if (spoken === 0) {
    console.error(`[whatsapp-tts] nothing was spoken; the reply stands as text${trace(params.trace)}`);
    return false;
  }
  // The reuse count is how "is this cache doing anything" is answered, and it
  // is answered here rather than by a column, because a counter in the table
  // would mean a database write on the very path the cache exists to shorten.
  console.log(
    `[whatsapp-tts] spoke a reply in ${spoken}/${segments.length} parts, ${reused} from cache${trace(params.trace)}`,
  );
  return true;
}

// ── Delivering one reply ─────────────────────────────────────────────────────
//
// The decision above and the two ways of sending, joined — with the sending
// handed in rather than reached for. That is the whole reason this function
// exists instead of an `if` in the webhook: a suite can drive a text question,
// a voice question, a failed synthesis and four alternating turns through the
// real policy and count what actually went out, without a Meta account, a
// synthesis bill, or a single assertion about the shape of the source.

export interface ReplyTransport {
  /** Send the words. Returns whether Meta accepted them. */
  sendText(body: string): Promise<boolean>;
  /** Speak the words. Returns whether at least one voice note was delivered. */
  speak(body: string): Promise<boolean>;
}

export interface ReplyDelivery {
  /** What was chosen, before anything was attempted. */
  medium: ReplyMedium;
  /** Whether the sender received it. */
  sent: boolean;
  /**
   * Set when audio was chosen, could not be produced, and the minimal notice
   * went out in its place. Logged; never a second copy of the answer.
   */
  spokenFailed: boolean;
}

/**
 * Send one reply, in one medium, exactly once.
 *
 * ── When synthesis fails ────────────────────────────────────────────────────
 *
 * This is the one documented exception to "a voice sender receives no text",
 * and it exists because the alternative is silence. Somebody who asked a
 * question and hears nothing back cannot tell a broken synthesiser from a
 * broken assistant, and for a blind sender that silence is the whole failure.
 *
 * What goes out depends on what could not be spoken, and neither case is ever
 * a second copy of something already delivered:
 *
 *   an answer  - replaced by the short failure sentence the caller passes in.
 *                Emphatically *not* the answer as text: a voice question
 *                answered with a wall of text is the assistant ignoring how it
 *                was asked, and that is the behaviour this whole change
 *                removes. The answer is not lost — the caller has already put
 *                it in the transcript, where the team triaging the thread sees
 *                exactly what the assistant said.
 *
 *   a notice   - written out as itself. It is already one short, translated,
 *                provider-free sentence, and replacing "I couldn't hear that
 *                voice note" with "something went wrong" would tell the sender
 *                less than the thing it replaced.
 */
export async function deliverReply(
  params: {
    body: string;
    kind: string;
    spokenInput: boolean;
    /** Short, translated, and safe to show. Used only if an *answer* cannot be spoken. */
    failureNotice: string;
    /** The delivery's correlation id, for the one line this prints. */
    trace?: string;
  },
  transport: ReplyTransport,
): Promise<ReplyDelivery> {
  const medium = replyMedium({ spokenInput: params.spokenInput, body: params.body });

  if (medium === "text") {
    return { medium, sent: await transport.sendText(params.body), spokenFailed: false };
  }

  if (await transport.speak(params.body)) {
    return { medium, sent: true, spokenFailed: false };
  }

  // A kind, and nothing else. Not the answer, not the transcript, not the
  // number: this repository is public and its CI logs are world-readable.
  console.error(`[whatsapp-tts] a spoken reply could not be delivered: kind=${params.kind}${trace(params.trace)}`);
  const fallback = ANSWER_KINDS.has(params.kind) ? params.failureNotice : params.body;
  const sent = await transport.sendText(fallback);
  return { medium, sent, spokenFailed: true };
}
