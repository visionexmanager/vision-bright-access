// Answering a spoken greeting or farewell with the recording of the same word.
//
// One narrow case, off unless WHATSAPP_LOCAL_ACK is "1" *and* WHATSAPP_LOCAL_AUDIO
// is "1": a VOICE NOTE whose whole transcript is "hello" or "goodbye" (or the
// Arabic "سلام" / "مرحبا") is answered with the matching prerecorded word, with no
// model call and no synthesis. It mirrors a pleasantry; it never answers a question.
//
// What keeps it conservative:
//   - voice notes only: a typed message keeps the written path it has today;
//   - the WHOLE transcript must be one of a short, exact list (after dropping case,
//     punctuation and Arabic vowel marks). "hello, what are your prices" is not a
//     greeting, nor is "hello" followed by anything;
//   - only when the clip is ACTIVE in the manifest, i.e. a person has listened to
//     it. A disabled or absent clip means no match and the message takes exactly
//     the path it took before;
//   - the caller applies it only after every flow, gate and entitlement check that
//     already exists, so it can change what an allowed sender is answered, never who
//     is answered or what is charged.
//
// "Thanks" is deliberately absent: replying "Thanks." to someone's thanks is not
// natural, and no "you're welcome" recording exists.

import { LOCAL_AUDIO_ASSETS, LOCAL_RESPONSES } from "./localAudioManifest.ts";
import { clipName, localAudioEnabled } from "./localAudio.ts";
import type { EnvReader } from "./whatsappProcessor.ts";

export const ACK_FLAG = "WHATSAPP_LOCAL_ACK";

export type AckId = "ack_hello" | "ack_goodbye";
export interface AckMatch { id: AckId; language: "en" | "ar"; reply: string }

/** Whole-message transcripts, already normalised, and the response each one mirrors. */
const PHRASES: ReadonlyArray<{ id: AckId; language: "en" | "ar"; says: readonly string[] }> = [
  { id: "ack_hello", language: "en", says: ["hello", "hi", "hey"] },
  { id: "ack_goodbye", language: "en", says: ["goodbye", "bye", "bye bye"] },
  { id: "ack_hello", language: "ar", says: ["سلام", "مرحبا"] },
];

/** Case, trailing punctuation and Arabic vowel marks only. Letters and word order are untouched. */
export function normaliseAck(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[\s.,!?؟،؛:;"'“”‘’…]+/g, " ")
    .trim()
    .toLowerCase();
}

export const localAckEnabled = (read: EnvReader): boolean =>
  (read(ACK_FLAG) ?? "").trim() === "1" && localAudioEnabled(read);

/** The mirror reply for a spoken greeting or farewell, or null. Pure; checks nothing about clips. */
export function matchAck(transcript: string | null | undefined): AckMatch | null {
  if (!transcript || transcript.length > 40) return null;
  const heard = normaliseAck(transcript);
  if (!heard) return null;
  for (const phrase of PHRASES) {
    if (!phrase.says.includes(heard)) continue;
    const reply = LOCAL_RESPONSES[phrase.id]?.text?.[phrase.language];
    return reply ? { id: phrase.id, language: phrase.language, reply } : null;
  }
  return null;
}

/** Whether a person has approved the clip for this match. A disabled or absent clip is not usable. */
export const ackClipActive = (match: AckMatch): boolean =>
  LOCAL_AUDIO_ASSETS[clipName(match.id, match.language)]?.status === "active";

/** The one decision the webhook asks: the match to answer with, or null to carry on as before. */
export function ackFor(transcript: string | null | undefined, read: EnvReader): AckMatch | null {
  if (!localAckEnabled(read)) return null;
  const match = matchAck(transcript);
  return match && ackClipActive(match) ? match : null;
}
